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
];
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
        .refine((value) => !RESERVED_SUBDOMAINS.includes(value), {
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
export const authLoginResponseSchema = z.object({
    accessToken: z.string().min(1),
    user: authUserSchema,
});
export const authRegisterResponseSchema = authLoginResponseSchema.extend({
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
export const videoProgressSchema = z.object({
    lessonId: z.string().uuid(),
    secondsWatched: z.number().int().min(0),
    isCompleted: z.boolean().optional(),
});
export const videoProgressUpdateSchema = videoProgressSchema.omit({
    lessonId: true,
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
export var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["ADMIN"] = "ADMIN";
    Role["TEACHER"] = "TEACHER";
    Role["STUDENT"] = "STUDENT";
})(Role || (Role = {}));
export var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "ACTIVE";
    TenantStatus["SUSPENDED"] = "SUSPENDED";
})(TenantStatus || (TenantStatus = {}));
export var Plan;
(function (Plan) {
    Plan["FREE"] = "FREE";
    Plan["PRO"] = "PRO";
    Plan["ENTERPRISE"] = "ENTERPRISE";
})(Plan || (Plan = {}));
//# sourceMappingURL=index.js.map