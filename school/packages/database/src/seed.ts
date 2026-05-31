import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

function getDemoAdminPassword(): string {
  const password = process.env.SEED_DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("SEED_DEMO_ADMIN_PASSWORD must be set to at least 8 characters");
  }

  return password;
}

const demoAdminPassword = getDemoAdminPassword();

async function seed() {
  const demoTenant = await prisma.tenant.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      subdomain: "demo",
      name: "Demo Academy",
      status: "ACTIVE",
      plan: "PRO",
    },
  });

  const passwordHash = await argon2.hash(demoAdminPassword);

  await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: "admin@demo.com",
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      email: "admin@demo.com",
      passwordHash,
      name: "Demo Admin",
      role: "ADMIN",
      tenantId: demoTenant.id,
    },
  });

  const mathSubject = await prisma.subject.create({
    data: {
      title: "Mathematics",
      color: "#3B82F6",
      tenantId: demoTenant.id,
      sortOrder: 0,
    },
  });

  const stage1 = await prisma.stage.create({
    data: {
      title: "Algebra Basics",
      subjectId: mathSubject.id,
      tenantId: demoTenant.id,
      sortOrder: 0,
    },
  });

  await prisma.lesson.create({
    data: {
      title: "Introduction to Variables",
      description: "Learn what variables are and how to use them",
      stageId: stage1.id,
      tenantId: demoTenant.id,
      sortOrder: 0,
    },
  });

  process.stdout.write(`Seed completed for tenant ${demoTenant.subdomain}\n`);
}

seed()
  .catch((e) => {
    process.stderr.write(`Seed failed: ${e instanceof Error ? e.message : "Unknown error"}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
