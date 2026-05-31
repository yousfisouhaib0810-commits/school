import type { PrismaClient } from "@school/database";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "TEACHER"]);

export async function canAccessPaidTenantContent(input: {
  prisma: PrismaClient;
  tenantId: string;
  userRole: string;
}): Promise<boolean> {
  if (STAFF_ROLES.has(input.userRole)) {
    return true;
  }

  const tenant = await input.prisma.tenant.findFirst({
    where: {
      id: input.tenantId,
      deletedAt: null,
      status: "ACTIVE",
      plan: { not: "FREE" },
    },
    select: { id: true },
  });

  return Boolean(tenant);
}
