import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CHARGILY_SECRET = "test-chargily-secret";
const CHARGILY_API_URL = "https://chargily.test/checkouts";

const checkoutSuccessResponseSchema = z.object({
  checkoutUrl: z.string().url(),
  id: z.string().min(1),
});

const chargilyRequestSchema = z.object({
  amount: z.number(),
  currency: z.literal("dzd"),
  success_url: z.string().url(),
  failure_url: z.string().url(),
  metadata: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    plan: z.enum(["PRO", "ENTERPRISE"]),
  }),
});

interface CapturedCheckoutRequest {
  url?: string;
  authorization?: string;
  body?: z.infer<typeof chargilyRequestSchema>;
}

function unwrapDefaultExport(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === "function") {
      return current;
    }

    if (typeof current !== "object" || current === null || !("default" in current)) {
      return current;
    }

    current = (current as { default: unknown }).default;
  }

  return current;
}

async function loadPaymentsRoute(): Promise<FastifyPluginAsync> {
  const routeModule = await import("./payments/route.js");
  const routeCandidate = unwrapDefaultExport(routeModule);
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid payments route plugin");
  }

  return routeCandidate as FastifyPluginAsync;
}

async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();
  const paymentsRoute = await loadPaymentsRoute();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "ADMIN";
    request.tenantId = TENANT_ID;
  });

  await app.register(paymentsRoute);
  return app;
}

function installChargilyFetchMock(capturedRequest: CapturedCheckoutRequest): typeof fetch {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [url, init] = args;
    capturedRequest.url = String(url);
    const headers = new Headers(init?.headers);
    capturedRequest.authorization = headers.get("authorization") ?? undefined;
    if (typeof init?.body === "string") {
      capturedRequest.body = chargilyRequestSchema.parse(JSON.parse(init.body));
    }

    return new Response(
      JSON.stringify({
        checkout_url: "https://pay.chargily.test/checkout_123",
        id: "checkout_123",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  return originalFetch;
}

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
  process.env.CHARGILY_SECRET_KEY = CHARGILY_SECRET;
  process.env.CHARGILY_API_URL = CHARGILY_API_URL;
});

describe("payment checkout route", () => {
  it("creates a Chargily checkout with tenant-scoped metadata", async () => {
    const capturedRequest: CapturedCheckoutRequest = {};
    const originalFetch = installChargilyFetchMock(capturedRequest);
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/checkout",
        payload: {
          plan: "PRO",
          successUrl: "https://school.example/success",
          cancelUrl: "https://school.example/cancel",
        },
      });
      const body = checkoutSuccessResponseSchema.parse(response.json());

      assert.equal(response.statusCode, 200);
      assert.deepEqual(body, {
        checkoutUrl: "https://pay.chargily.test/checkout_123",
        id: "checkout_123",
      });
      assert.equal(capturedRequest.url, CHARGILY_API_URL);
      assert.equal(capturedRequest.authorization, `Bearer ${CHARGILY_SECRET}`);
      assert.deepEqual(capturedRequest.body, {
        amount: 5000,
        currency: "dzd",
        success_url: "https://school.example/success",
        failure_url: "https://school.example/cancel",
        metadata: {
          tenantId: TENANT_ID,
          userId: USER_ID,
          plan: "PRO",
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
      await app.close();
    }
  });

  it("rejects free-plan checkout without calling the payment gateway", async () => {
    let fetchWasCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (): Promise<Response> => {
      fetchWasCalled = true;
      return new Response(null, { status: 500 });
    };
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/checkout",
        payload: {
          plan: "FREE",
          successUrl: "https://school.example/success",
          cancelUrl: "https://school.example/cancel",
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), { error: "Cannot checkout free plan" });
      assert.equal(fetchWasCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
      await app.close();
    }
  });
});
