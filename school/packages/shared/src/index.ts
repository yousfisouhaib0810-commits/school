import { z } from "zod";

export const RESERVED_SUBDOMAINS = [
  "admin",
  "api",
  "www",
  "mail",
  "ftp",
  "app",
  "auth",
  "login",
  "signup",
  "root",
  "support",
  "billing",
  "dashboard",
  "static",
  "cdn",
  "assets",
  "media",
  "blog",
  "docs",
  "help",
] as const;

const RESERVED_SUBDOMAIN_SET = new Set<string>(RESERVED_SUBDOMAINS);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
    .refine((value) => !RESERVED_SUBDOMAIN_SET.has(value), {
      message: "Reserved subdomain",
    }),
});

export const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]),
  tenantId: z.string().uuid(),
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: tokenPayloadSchema.shape.role,
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
});
export const authLoginResponseSchema = authSessionResponseSchema;

export const authRegisterResponseSchema = z.object({
  requiresEmailVerification: z.literal(true),
  email: z.string().email(),
  tenant: z.object({
    id: z.string().uuid(),
    subdomain: registerSchema.shape.subdomain,
  }),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  subdomain: registerSchema.shape.subdomain,
  code: z.string().regex(/^\d{6}$/),
});

export const resendEmailVerificationSchema = z.object({
  email: z.string().email(),
  subdomain: registerSchema.shape.subdomain,
});

export const authVerifyEmailResponseSchema = authSessionResponseSchema.extend({
  tenant: z.object({
    id: z.string().uuid(),
    subdomain: registerSchema.shape.subdomain,
  }),
});

export const tenantUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export const lessonParamsSchema = z.object({
  lessonId: z.string().uuid(),
});

export const subjectSchema = z.object({
  title: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3B82F6"),
});

export const stageSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export const lessonSchema = z.object({
  stageId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  videoUid: z.string().optional(),
});

export const subjectUpdateSchema = subjectSchema.partial();
export const stageUpdateSchema = stageSchema.omit({ subjectId: true }).partial();
export const lessonUpdateSchema = lessonSchema.omit({ stageId: true }).partial();

export const reorderItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int(),
});
export const reorderSchema = z.array(reorderItemSchema);

export const videoProgressSchema = z.object({
  lessonId: z.string().uuid(),
  secondsWatched: z.number().int().min(0),
  isCompleted: z.boolean().optional(),
});

export const videoProgressUpdateSchema = videoProgressSchema.omit({
  lessonId: true,
});

export const VIDEO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
] as const;

export const videoUploadRequestSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((value) => !/[\\/\0]/.test(value), {
      message: "Invalid file name",
    }),
  fileSize: z.number().int().min(1).max(VIDEO_UPLOAD_MAX_BYTES),
  mimeType: z.enum(ALLOWED_VIDEO_MIME_TYPES),
});

export const assignVideoSchema = z.object({
  lessonId: z.string().uuid(),
  videoUid: z.string().min(1),
});

export const landingPageBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    props: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      bg: z.string().default("#ffffff"),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("pricing"),
    props: z.object({
      plans: z.array(z.enum(["monthly", "yearly"])),
      monthlyPrice: z.number().optional(),
      yearlyPrice: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal("text"),
    props: z.object({
      content: z.string(),
      align: z.enum(["left", "center", "right"]).default("center"),
    }),
  }),
  z.object({
    type: z.literal("cta"),
    props: z.object({
      text: z.string(),
      url: z.string(),
      variant: z.enum(["primary", "secondary"]).default("primary"),
    }),
  }),
]);

export const landingPageSchema = z.object({
  blocks: z.array(landingPageBlockSchema),
  published: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
export type AuthRegisterResponse = z.infer<typeof authRegisterResponseSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendEmailVerificationInput = z.infer<typeof resendEmailVerificationSchema>;
export type AuthVerifyEmailResponse = z.infer<typeof authVerifyEmailResponseSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type StageInput = z.infer<typeof stageSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type VideoProgressInput = z.infer<typeof videoProgressSchema>;
export type VideoProgressUpdateInput = z.infer<typeof videoProgressUpdateSchema>;
export type VideoUploadRequestInput = z.infer<typeof videoUploadRequestSchema>;
export type LandingPageBlock = z.infer<typeof landingPageBlockSchema>;
export type LandingPageInput = z.infer<typeof landingPageSchema>;

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
}

export enum TenantStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum Plan {
  FREE = "FREE",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
}

export const checkoutSessionSchema = z.object({
  plan: z.nativeEnum(Plan),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

export * from './live.js';
