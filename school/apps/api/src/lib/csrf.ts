import crypto from "node:crypto";
import { env } from "../env.js";

const CSRF_RANDOM_BYTES = 32;
const CSRF_TOKEN_PARTS = 2;

function signTokenValue(value: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createCsrfToken(): string {
  const value = crypto.randomBytes(CSRF_RANDOM_BYTES).toString("base64url");
  return `${value}.${signTokenValue(value)}`;
}

export function isValidCsrfToken(token: string | undefined): token is string {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== CSRF_TOKEN_PARTS) {
    return false;
  }

  const [value, signature] = parts;
  if (!value || !signature) {
    return false;
  }

  return timingSafeEqualText(signature, signTokenValue(value));
}

export function areSameCsrfToken(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right || !isValidCsrfToken(left) || !isValidCsrfToken(right)) {
    return false;
  }

  return timingSafeEqualText(left, right);
}
