import crypto from "node:crypto";
import * as argon2 from "argon2";
import type { PrismaClient } from "@school/database";
import { env } from "../env.js";
import { sendEmail } from "./email.js";

const RESET_CODE_DIGITS = 6;
const RESET_CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

interface PasswordResetTarget {
  tenantId: string;
  userId: string;
  email: string;
  academyName: string;
}

interface ResetPasswordInput {
  tenantId: string;
  email: string;
  code: string;
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateResetCode(): string {
  const max = 10 ** RESET_CODE_DIGITS;
  return crypto.randomInt(0, max).toString().padStart(RESET_CODE_DIGITS, "0");
}

function hashResetCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(`password-reset:${normalizeEmail(email)}:${code}`)
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

function buildPasswordResetEmail(code: string, academyName: string): string {
  const safeAcademyName = escapeHtml(academyName);

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
      <h1 style="font-size:24px;margin-bottom:12px">Reset your School Platform password</h1>
      <p>Your password reset code for ${safeAcademyName} is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${code}</p>
      <p>This code expires in ${RESET_CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email.</p>
    </div>
  `;
}

export async function createAndSendPasswordReset(
  prisma: PrismaClient,
  target: PasswordResetTarget
): Promise<void> {
  const email = normalizeEmail(target.email);
  const latest = await prisma.passwordReset.findFirst({
    where: {
      tenantId: target.tenantId,
      userId: target.userId,
      email,
      consumedAt: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return;
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      tenantId: target.tenantId,
      userId: target.userId,
      email,
      codeHash: hashResetCode(email, code),
      expiresAt,
    },
  });

  await sendEmail({
    to: email,
    subject: "Your School Platform password reset code",
    html: buildPasswordResetEmail(code, target.academyName),
  });
}

export async function resetPasswordWithCode(
  prisma: PrismaClient,
  input: ResetPasswordInput
): Promise<void> {
  const email = normalizeEmail(input.email);
  const reset = await prisma.passwordReset.findFirst({
    where: {
      tenantId: input.tenantId,
      email,
      consumedAt: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!reset || reset.expiresAt.getTime() < Date.now() || reset.attempts >= MAX_ATTEMPTS) {
    throw new Error("Invalid or expired password reset code");
  }

  const codeHash = hashResetCode(email, input.code);
  if (!isSameHash(codeHash, reset.codeHash)) {
    await prisma.passwordReset.updateMany({
      where: { id: reset.id, tenantId: input.tenantId },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Invalid or expired password reset code");
  }

  const passwordHash = await argon2.hash(input.password);
  await prisma.$transaction([
    prisma.passwordReset.updateMany({
      where: { id: reset.id, tenantId: input.tenantId },
      data: { consumedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: reset.userId, tenantId: input.tenantId, deletedAt: null },
      data: { passwordHash },
    }),
  ]);
}
