import crypto from "node:crypto";
import type { PrismaClient } from "@school/database";
import { env } from "../env.js";
import { sendEmail } from "./email.js";

const OTP_DIGITS = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

interface VerificationTarget {
  tenantId: string;
  userId: string;
  email: string;
  academyName: string;
}

interface VerifyCodeInput {
  tenantId: string;
  email: string;
  code: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtpCode(): string {
  const max = 10 ** OTP_DIGITS;
  return crypto.randomInt(0, max).toString().padStart(OTP_DIGITS, "0");
}

function hashOtpCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

function isSameHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function buildVerificationEmail(code: string, academyName: string): string {
  const safeAcademyName = escapeHtml(academyName);

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
      <h1 style="font-size:24px;margin-bottom:12px">Verify your School Platform account</h1>
      <p>Your verification code for ${safeAcademyName} is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${code}</p>
      <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.</p>
    </div>
  `;
}

export async function createAndSendEmailVerification(
  prisma: PrismaClient,
  target: VerificationTarget
): Promise<void> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const email = normalizeEmail(target.email);

  await prisma.emailVerification.create({
    data: {
      tenantId: target.tenantId,
      userId: target.userId,
      email,
      codeHash: hashOtpCode(email, code),
      expiresAt,
    },
  });

  await sendEmail({
    to: email,
    subject: "Your School Platform verification code",
    html: buildVerificationEmail(code, target.academyName),
  });
}

export async function resendEmailVerification(
  prisma: PrismaClient,
  target: VerificationTarget
): Promise<void> {
  const email = normalizeEmail(target.email);
  const latest = await prisma.emailVerification.findFirst({
    where: {
      tenantId: target.tenantId,
      userId: target.userId,
      email,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    throw new Error("Please wait before requesting another code");
  }

  await createAndSendEmailVerification(prisma, target);
}

export async function verifyEmailCode(
  prisma: PrismaClient,
  input: VerifyCodeInput
): Promise<{ userId: string }> {
  const email = normalizeEmail(input.email);
  const verification = await prisma.emailVerification.findFirst({
    where: {
      tenantId: input.tenantId,
      email,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification || verification.expiresAt.getTime() < Date.now()) {
    throw new Error("Invalid or expired verification code");
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    throw new Error("Verification attempts exceeded");
  }

  const codeHash = hashOtpCode(email, input.code);
  if (!isSameHash(codeHash, verification.codeHash)) {
    await prisma.emailVerification.updateMany({
      where: { id: verification.id, tenantId: input.tenantId },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Invalid or expired verification code");
  }

  await prisma.$transaction([
    prisma.emailVerification.updateMany({
      where: { id: verification.id, tenantId: input.tenantId },
      data: { consumedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: verification.userId, tenantId: input.tenantId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { userId: verification.userId };
}
