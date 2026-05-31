import { SignJWT, jwtVerify } from "jose";
import type { FastifyInstance } from "fastify";
import { tokenPayloadSchema } from "@school/shared";
import type { TokenPayload } from "@school/shared";

import { env } from "../env.js";

const accessSecret = new TextEncoder().encode(env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const sameSiteCookiePolicy = env.NODE_ENV === "production" ? "none" : "strict";

export function generateAccessToken(
  _fastify: FastifyInstance,
  payload: TokenPayload
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export function generateRefreshToken(
  _fastify: FastifyInstance,
  payload: TokenPayload
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshSecret);
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    return tokenPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    return tokenPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: sameSiteCookiePolicy,
  path: "/",
  maxAge: 15 * 60,
} as const;

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: sameSiteCookiePolicy,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60,
} as const;
