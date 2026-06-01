import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const TEST_SECRET = "test-access-secret-with-more-than-32-characters";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT_ID = "33333333-3333-4333-8333-333333333333";
const STAGE_ID = "44444444-4444-4444-8444-444444444444";
const LESSON_ID = "55555555-5555-4555-8555-555555555555";

async function mockCsrf(page: Page) {
  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill({ json: { token: "csrf-token" } });
  });
}

async function addSuperAdminCookie(page: Page) {
  const token = await new SignJWT({
    sub: USER_ID,
    role: "SUPER_ADMIN",
    tenantId: TENANT_ID,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(TEST_SECRET));

  await page.context().addCookies([
    {
      name: "accessToken",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("teacher dashboard renders seeded subject workflow data", async ({ page }) => {
  await page.route("**/api/subjects", async (route) => {
    await route.fulfill({
      json: [
        {
          id: SUBJECT_ID,
          title: "Mathematics",
          color: "#3B82F6",
          sortOrder: 0,
          stages: [
            {
              id: STAGE_ID,
              title: "Algebra Basics",
              sortOrder: 0,
              subjectId: SUBJECT_ID,
              lessons: [
                {
                  id: LESSON_ID,
                  title: "Introduction to Variables",
                  description: "Learn what variables are and how to use them",
                  sortOrder: 0,
                  stageId: STAGE_ID,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  await page.goto("/subjects");

  await expect(page.getByText("Mathematics")).toBeVisible();
});

test("landing builder loads, previews, and saves block content", async ({ page }) => {
  await mockCsrf(page);
  await page.route("**/api/landing/admin", async (route) => {
    await route.fulfill({
      json: {
        data: {
          blocks: [
            {
              type: "hero",
              props: {
                title: "Demo Hero",
                subtitle: "Demo landing subtitle",
                bg: "#ffffff",
                ctaText: "Start",
                ctaUrl: "/register",
              },
            },
          ],
          published: false,
        },
      },
    });
  });
  await page.route("**/api/landing", async (route) => {
    await route.fulfill({ json: { success: true } });
  });

  await page.goto("/landing");
  await expect(page.locator("input").first()).toHaveValue("Demo Hero");
  await expect(page.getByText("Demo Hero")).toBeVisible();

  await page.locator("input").first().fill("Updated Hero");
  await page.locator("main button").first().click();
  await expect(page.getByText("Updated Hero")).toBeVisible();
});

test("student portal renders course journey data", async ({ page }) => {
  await page.route("**/api/video", async (route) => {
    await route.fulfill({
      json: [
        {
          id: LESSON_ID,
          title: "Introduction to Variables",
          description: "Learn what variables are and how to use them",
          videoUid: "cloudflare-video-id",
          sortOrder: 0,
        },
      ],
    });
  });

  await page.goto("/courses");

  await expect(page.getByText("Introduction to Variables")).toBeVisible();
  await expect(page.locator(`a[href="/courses/lesson/${LESSON_ID}"]`)).toHaveAttribute(
    "href",
    `/courses/lesson/${LESSON_ID}`
  );
});

test("super admin console renders tenants and audit logs", async ({ page }) => {
  await addSuperAdminCookie(page);
  await page.route("**/api/super-admin/tenants", async (route) => {
    await route.fulfill({
      json: [
        {
          id: TENANT_ID,
          subdomain: "demo",
          name: "Demo Academy",
          status: "ACTIVE",
          plan: "PRO",
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          usersCount: 3,
        },
      ],
    });
  });
  await page.route("**/api/super-admin/audit-logs", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            tenantId: TENANT_ID,
            actorUserId: USER_ID,
            action: "SUPER_ADMIN_TENANTS_VIEWED",
            entityType: "SUPER_ADMIN_DASHBOARD",
            entityId: TENANT_ID,
            metadata: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            tenant: {
              subdomain: "demo",
              name: "Demo Academy",
            },
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.goto("/dashboard");

  await expect(page.getByText("Demo Academy").first()).toBeVisible();
  await expect(page.getByText("SUPER_ADMIN_TENANTS_VIEWED")).toBeVisible();
  await expect(page.getByText("3").first()).toBeVisible();
});
