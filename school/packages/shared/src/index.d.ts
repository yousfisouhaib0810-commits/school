import { z } from "zod";
export declare const RESERVED_SUBDOMAINS: readonly ["admin", "api", "www", "mail", "ftp", "app", "auth", "login", "signup", "root", "support", "billing", "dashboard", "static", "cdn", "assets", "media", "blog", "docs", "help"];
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    subdomain: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    name: string;
    subdomain: string;
    email: string;
    password: string;
}, {
    name: string;
    subdomain: string;
    email: string;
    password: string;
}>;
export declare const tokenPayloadSchema: z.ZodObject<{
    sub: z.ZodString;
    role: z.ZodEnum<["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]>;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sub: string;
    tenantId: string;
    role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
}, {
    sub: string;
    tenantId: string;
    role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
}>;
export declare const authUserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
}, {
    id: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
}>;
export declare const authLoginResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        role: z.ZodEnum<["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    }, {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    };
    accessToken: string;
}, {
    user: {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    };
    accessToken: string;
}>;
export declare const authRegisterResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        role: z.ZodEnum<["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    }, {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    }>;
} & {
    tenant: z.ZodObject<{
        id: z.ZodString;
        subdomain: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        subdomain: string;
    }, {
        id: string;
        subdomain: string;
    }>;
}, "strip", z.ZodTypeAny, {
    tenant: {
        id: string;
        subdomain: string;
    };
    user: {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    };
    accessToken: string;
}, {
    tenant: {
        id: string;
        subdomain: string;
    };
    user: {
        id: string;
        email: string;
        role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
    };
    accessToken: string;
}>;
export declare const tenantUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    logoUrl?: string | null | undefined;
}, {
    name?: string | undefined;
    logoUrl?: string | null | undefined;
}>;
export declare const lessonParamsSchema: z.ZodObject<{
    lessonId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    lessonId: string;
}, {
    lessonId: string;
}>;
export declare const subjectSchema: z.ZodObject<{
    title: z.ZodString;
    color: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    color: string;
}, {
    title: string;
    color?: string | undefined;
}>;
export declare const stageSchema: z.ZodObject<{
    subjectId: z.ZodString;
    title: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    subjectId: string;
}, {
    title: string;
    subjectId: string;
}>;
export declare const lessonSchema: z.ZodObject<{
    stageId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    videoUid: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    stageId: string;
    description?: string | undefined;
    videoUid?: string | undefined;
}, {
    title: string;
    stageId: string;
    description?: string | undefined;
    videoUid?: string | undefined;
}>;
export declare const videoProgressSchema: z.ZodObject<{
    lessonId: z.ZodString;
    secondsWatched: z.ZodNumber;
    isCompleted: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    lessonId: string;
    secondsWatched: number;
    isCompleted?: boolean | undefined;
}, {
    lessonId: string;
    secondsWatched: number;
    isCompleted?: boolean | undefined;
}>;
export declare const videoProgressUpdateSchema: z.ZodObject<Omit<{
    lessonId: z.ZodString;
    secondsWatched: z.ZodNumber;
    isCompleted: z.ZodOptional<z.ZodBoolean>;
}, "lessonId">, "strip", z.ZodTypeAny, {
    secondsWatched: number;
    isCompleted?: boolean | undefined;
}, {
    secondsWatched: number;
    isCompleted?: boolean | undefined;
}>;
export declare const landingPageBlockSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"hero">;
    props: z.ZodObject<{
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        bg: z.ZodDefault<z.ZodString>;
        ctaText: z.ZodOptional<z.ZodString>;
        ctaUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        bg: string;
        subtitle?: string | undefined;
        ctaText?: string | undefined;
        ctaUrl?: string | undefined;
    }, {
        title: string;
        subtitle?: string | undefined;
        bg?: string | undefined;
        ctaText?: string | undefined;
        ctaUrl?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "hero";
    props: {
        title: string;
        bg: string;
        subtitle?: string | undefined;
        ctaText?: string | undefined;
        ctaUrl?: string | undefined;
    };
}, {
    type: "hero";
    props: {
        title: string;
        subtitle?: string | undefined;
        bg?: string | undefined;
        ctaText?: string | undefined;
        ctaUrl?: string | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"pricing">;
    props: z.ZodObject<{
        plans: z.ZodArray<z.ZodEnum<["monthly", "yearly"]>, "many">;
        monthlyPrice: z.ZodOptional<z.ZodNumber>;
        yearlyPrice: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        plans: ("monthly" | "yearly")[];
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
    }, {
        plans: ("monthly" | "yearly")[];
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "pricing";
    props: {
        plans: ("monthly" | "yearly")[];
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
    };
}, {
    type: "pricing";
    props: {
        plans: ("monthly" | "yearly")[];
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"text">;
    props: z.ZodObject<{
        content: z.ZodString;
        align: z.ZodDefault<z.ZodEnum<["left", "center", "right"]>>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        align: "left" | "center" | "right";
    }, {
        content: string;
        align?: "left" | "center" | "right" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    props: {
        content: string;
        align: "left" | "center" | "right";
    };
}, {
    type: "text";
    props: {
        content: string;
        align?: "left" | "center" | "right" | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"cta">;
    props: z.ZodObject<{
        text: z.ZodString;
        url: z.ZodString;
        variant: z.ZodDefault<z.ZodEnum<["primary", "secondary"]>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        text: string;
        variant: "primary" | "secondary";
    }, {
        url: string;
        text: string;
        variant?: "primary" | "secondary" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "cta";
    props: {
        url: string;
        text: string;
        variant: "primary" | "secondary";
    };
}, {
    type: "cta";
    props: {
        url: string;
        text: string;
        variant?: "primary" | "secondary" | undefined;
    };
}>]>;
export declare const landingPageSchema: z.ZodObject<{
    blocks: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"hero">;
        props: z.ZodObject<{
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            bg: z.ZodDefault<z.ZodString>;
            ctaText: z.ZodOptional<z.ZodString>;
            ctaUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            bg: string;
            subtitle?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        }, {
            title: string;
            subtitle?: string | undefined;
            bg?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "hero";
        props: {
            title: string;
            bg: string;
            subtitle?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        };
    }, {
        type: "hero";
        props: {
            title: string;
            subtitle?: string | undefined;
            bg?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        };
    }>, z.ZodObject<{
        type: z.ZodLiteral<"pricing">;
        props: z.ZodObject<{
            plans: z.ZodArray<z.ZodEnum<["monthly", "yearly"]>, "many">;
            monthlyPrice: z.ZodOptional<z.ZodNumber>;
            yearlyPrice: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        }, {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "pricing";
        props: {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        };
    }, {
        type: "pricing";
        props: {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        };
    }>, z.ZodObject<{
        type: z.ZodLiteral<"text">;
        props: z.ZodObject<{
            content: z.ZodString;
            align: z.ZodDefault<z.ZodEnum<["left", "center", "right"]>>;
        }, "strip", z.ZodTypeAny, {
            content: string;
            align: "left" | "center" | "right";
        }, {
            content: string;
            align?: "left" | "center" | "right" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        props: {
            content: string;
            align: "left" | "center" | "right";
        };
    }, {
        type: "text";
        props: {
            content: string;
            align?: "left" | "center" | "right" | undefined;
        };
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cta">;
        props: z.ZodObject<{
            text: z.ZodString;
            url: z.ZodString;
            variant: z.ZodDefault<z.ZodEnum<["primary", "secondary"]>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            text: string;
            variant: "primary" | "secondary";
        }, {
            url: string;
            text: string;
            variant?: "primary" | "secondary" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "cta";
        props: {
            url: string;
            text: string;
            variant: "primary" | "secondary";
        };
    }, {
        type: "cta";
        props: {
            url: string;
            text: string;
            variant?: "primary" | "secondary" | undefined;
        };
    }>]>, "many">;
    published: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    blocks: ({
        type: "hero";
        props: {
            title: string;
            bg: string;
            subtitle?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        };
    } | {
        type: "pricing";
        props: {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        };
    } | {
        type: "text";
        props: {
            content: string;
            align: "left" | "center" | "right";
        };
    } | {
        type: "cta";
        props: {
            url: string;
            text: string;
            variant: "primary" | "secondary";
        };
    })[];
    published: boolean;
}, {
    blocks: ({
        type: "hero";
        props: {
            title: string;
            subtitle?: string | undefined;
            bg?: string | undefined;
            ctaText?: string | undefined;
            ctaUrl?: string | undefined;
        };
    } | {
        type: "pricing";
        props: {
            plans: ("monthly" | "yearly")[];
            monthlyPrice?: number | undefined;
            yearlyPrice?: number | undefined;
        };
    } | {
        type: "text";
        props: {
            content: string;
            align?: "left" | "center" | "right" | undefined;
        };
    } | {
        type: "cta";
        props: {
            url: string;
            text: string;
            variant?: "primary" | "secondary" | undefined;
        };
    })[];
    published?: boolean | undefined;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
export type AuthRegisterResponse = z.infer<typeof authRegisterResponseSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type StageInput = z.infer<typeof stageSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type VideoProgressInput = z.infer<typeof videoProgressSchema>;
export type VideoProgressUpdateInput = z.infer<typeof videoProgressUpdateSchema>;
export type LandingPageBlock = z.infer<typeof landingPageBlockSchema>;
export type LandingPageInput = z.infer<typeof landingPageSchema>;
export declare enum Role {
    SUPER_ADMIN = "SUPER_ADMIN",
    ADMIN = "ADMIN",
    TEACHER = "TEACHER",
    STUDENT = "STUDENT"
}
export declare enum TenantStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED"
}
export declare enum Plan {
    FREE = "FREE",
    PRO = "PRO",
    ENTERPRISE = "ENTERPRISE"
}
//# sourceMappingURL=index.d.ts.map