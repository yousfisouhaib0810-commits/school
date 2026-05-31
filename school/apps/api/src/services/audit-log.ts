import type { PrismaClient } from "@school/database";

type AuditMetadataValue = string | number | boolean | null;

interface CreateTenantAuditLogInput {
  prisma: PrismaClient;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, AuditMetadataValue>;
}

export async function createTenantAuditLog(input: CreateTenantAuditLogInput): Promise<void> {
  await input.prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
    },
  });
}
