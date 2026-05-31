import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(4000),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_STREAM_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function isPlaceholderSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return normalized.includes("placeholder") || normalized.includes("replace-with");
}

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors).join(", ");
    throw new Error(`Invalid environment variables: ${fields}`);
  }

  if (
    result.data.NODE_ENV === "production" &&
    (isPlaceholderSecret(result.data.JWT_SECRET) ||
      isPlaceholderSecret(result.data.JWT_REFRESH_SECRET))
  ) {
    throw new Error("JWT secrets must be unique production secrets");
  }

  return result.data;
}

export const env = loadEnv();
