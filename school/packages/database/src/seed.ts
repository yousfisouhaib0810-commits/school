import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const DEMO_TENANT_SUBDOMAIN = "demo";
const DEMO_TENANT_NAME = "Demo Academy";
const DEMO_USERS = [
  { email: "admin@demo.com", name: "Demo Admin", role: "ADMIN" },
  { email: "teacher@demo.com", name: "Demo Teacher", role: "TEACHER" },
  { email: "student@demo.com", name: "Demo Student", role: "STUDENT" },
] as const;

function getDemoAdminPassword(): string {
  const password = process.env.SEED_DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("SEED_DEMO_ADMIN_PASSWORD must be set to at least 8 characters");
  }

  return password;
}

const demoAdminPassword = getDemoAdminPassword();

async function upsertDemoTenant() {
  return prisma.tenant.upsert({
    where: { subdomain: DEMO_TENANT_SUBDOMAIN },
    update: {},
    create: {
      subdomain: DEMO_TENANT_SUBDOMAIN,
      name: DEMO_TENANT_NAME,
      status: "ACTIVE",
      plan: "PRO",
    },
  });
}

async function upsertDemoUsers(tenantId: string) {
  const passwordHash = await argon2.hash(demoAdminPassword);
  const verifiedAt = new Date();

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: user.email,
          tenantId,
        },
      },
      update: {
        name: user.name,
        role: user.role,
        emailVerifiedAt: verifiedAt,
        deletedAt: null,
      },
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
        tenantId,
        emailVerifiedAt: verifiedAt,
      },
    });
  }
}

async function findOrCreateSubject(tenantId: string) {
  const existing = await prisma.subject.findFirst({
    where: { tenantId, title: "Mathematics", deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.subject.create({
    data: { title: "Mathematics", color: "#3B82F6", tenantId, sortOrder: 0 },
  });
}

async function findOrCreateStage(tenantId: string, subjectId: string) {
  const existing = await prisma.stage.findFirst({
    where: { tenantId, subjectId, title: "Algebra Basics", deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.stage.create({
    data: { title: "Algebra Basics", subjectId, tenantId, sortOrder: 0 },
  });
}

async function findOrCreateLesson(tenantId: string, stageId: string) {
  const existing = await prisma.lesson.findFirst({
    where: { tenantId, stageId, title: "Introduction to Variables", deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.lesson.create({
    data: {
      title: "Introduction to Variables",
      description: "Learn what variables are and how to use them",
      stageId,
      tenantId,
      sortOrder: 0,
    },
  });
}

async function upsertDemoSubscription(tenantId: string) {
  const student = await prisma.user.findUnique({
    where: { email_tenantId: { email: "student@demo.com", tenantId } },
    select: { id: true },
  });

  if (!student) {
    throw new Error("Demo student was not created");
  }

  const existing = await prisma.subscription.findFirst({
    where: { tenantId, userId: student.id, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    await prisma.subscription.updateMany({
      where: { id: existing.id, tenantId },
      data: { plan: "PRO", status: "ACTIVE" },
    });
    return;
  }

  await prisma.subscription.create({
    data: { tenantId, userId: student.id, plan: "PRO", status: "ACTIVE" },
  });
}

async function upsertDemoLandingPage(tenantId: string) {
  const blocks = [
    {
      type: "hero",
      props: {
        title: "Demo Academy",
        subtitle: "A production-like demo tenant for validating school workflows.",
        bg: "#ffffff",
        ctaText: "Browse courses",
        ctaUrl: "/courses",
      },
    },
    {
      type: "pricing",
      props: { plans: ["monthly", "yearly"], monthlyPrice: 5000, yearlyPrice: 15000 },
    },
  ];
  const existing = await prisma.landingPage.findFirst({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    await prisma.landingPage.updateMany({
      where: { id: existing.id, tenantId },
      data: { blocks, published: true },
    });
    return;
  }

  await prisma.landingPage.create({ data: { tenantId, blocks, published: true } });
}

async function upsertDemoLiveSession(tenantId: string) {
  const existing = await prisma.liveSession.findFirst({
    where: { tenantId, title: "Demo Live Session", deletedAt: null },
    select: { id: true },
  });
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (existing) {
    await prisma.liveSession.updateMany({
      where: { id: existing.id, tenantId },
      data: { scheduledAt, isLive: false },
    });
    return;
  }

  await prisma.liveSession.create({
    data: {
      tenantId,
      title: "Demo Live Session",
      zoomMeetingId: "jitsi-demo-live-session",
      jitsiRoomName: "demo-live-session",
      jitsiJoinUrl: "https://meet.jit.si/demo-live-session",
      scheduledAt,
    },
  });
}

async function seed() {
  const demoTenant = await upsertDemoTenant();
  await upsertDemoUsers(demoTenant.id);

  const mathSubject = await findOrCreateSubject(demoTenant.id);
  const stage = await findOrCreateStage(demoTenant.id, mathSubject.id);
  await findOrCreateLesson(demoTenant.id, stage.id);
  await upsertDemoSubscription(demoTenant.id);
  await upsertDemoLandingPage(demoTenant.id);
  await upsertDemoLiveSession(demoTenant.id);

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
