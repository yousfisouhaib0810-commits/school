import assert from "node:assert/strict";
import crypto from "node:crypto";
import { before, describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import { Prisma } from "@school/database";
import { Plan } from "@school/shared";

const STRIPE_WEBHOOK_SECRET = "whsec_test_school_platform";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "evt_test_123";
const SESSION_ID = "cs_test_123";

interface PaymentEventCreateInput {
  data: {
    tenantId: string;
    provider: string;
    eventId: string;
    eventType: string;
  };
}

interface SubscriptionFindFirstInput {
  where: {
    tenantId: string;
    userId: string;
    deletedAt: null;
  };
  select: { id: true };
}

interface SubscriptionUpdateManyInput {
  where: {
    id: string;
    tenantId: string;
  };
  data: {
    stripeCheckoutSessionId: string;
    plan: Plan;
    status: "ACTIVE";
  };
}

interface TenantUpdateManyInput {
  where: {
    id: string;
    deletedAt: null;
  };
  data: {
    plan: Plan;
  };
}

interface TransactionClientStub {
  paymentEvent: {
    create(input: PaymentEventCreateInput): Promise<void>;
  };
  subscription: {
    findFirst(input: SubscriptionFindFirstInput): Promise<{ id: string } | null>;
    updateMany(input: SubscriptionUpdateManyInput): Promise<{ count: number }>;
    create(input: { data: SubscriptionUpdateManyInput["data"] & { tenantId: string; userId: string } }): Promise<void>;
  };
  tenant: {
    updateMany(input: TenantUpdateManyInput): Promise<{ count: number }>;
  };
}

interface PrismaStub {
  $transaction<T>(operation: (tx: TransactionClientStub) => Promise<T>): Promise<T>;
}

interface PaymentState {
  eventIds: Set<string>;
  paymentEventsCreated: number;
  subscriptionPlan: Plan;
  tenantPlan: Plan;
  stripeCheckoutSessionId?: string;
}

function duplicateEventError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Duplicate Stripe event", {
    code: "P2002",
    clientVersion: "test",
  });
}

function toPrismaClientStub(stub: PrismaStub): PrismaClient {
  return stub as unknown as PrismaClient;
}

function createPrismaStub(state: PaymentState): PrismaStub {
  const tx: TransactionClientStub = {
    paymentEvent: {
      async create(input) {
        const key = `${input.data.tenantId}:${input.data.provider}:${input.data.eventId}`;
        if (state.eventIds.has(key)) {
          throw duplicateEventError();
        }
        state.eventIds.add(key);
        state.paymentEventsCreated += 1;
      },
    },
    subscription: {
      async findFirst(input) {
        return input.where.tenantId === TENANT_ID && input.where.userId === USER_ID ? { id: "sub_1" } : null;
      },
      async updateMany(input) {
        if (input.where.tenantId === TENANT_ID) {
          state.subscriptionPlan = input.data.plan;
          state.stripeCheckoutSessionId = input.data.stripeCheckoutSessionId;
          return { count: 1 };
        }
        return { count: 0 };
      },
      async create(input) {
        state.subscriptionPlan = input.data.plan;
        state.stripeCheckoutSessionId = input.data.stripeCheckoutSessionId;
      },
    },
    tenant: {
      async updateMany(input) {
        if (input.where.id === TENANT_ID) {
          state.tenantPlan = input.data.plan;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };

  return {
    async $transaction(operation) {
      return operation(tx);
    },
  };
}

function signedPayload(plan: Plan): { raw: string; signature: string } {
  const raw = JSON.stringify({
    id: EVENT_ID,
    type: "checkout.session.completed",
    data: {
      object: {
        id: SESSION_ID,
        metadata: {
          tenantId: TENANT_ID,
          userId: USER_ID,
          plan,
        },
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest("hex");

  return {
    raw,
    signature: `t=${timestamp},v1=${digest}`,
  };
}

async function buildApp(state: PaymentState): Promise<ReturnType<typeof Fastify>> {
  const routeModule = await import("./stripe.js");
  const routeCandidate: unknown = routeModule.default;
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid Stripe webhook route plugin");
  }

  const app = Fastify();
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(state)));
  await app.register(routeCandidate as FastifyPluginAsync);
  return app;
}

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
});

describe("Stripe webhook", () => {
  it("rejects invalid signatures without writing payment state", async () => {
    const state: PaymentState = {
      eventIds: new Set(),
      paymentEventsCreated: 0,
      subscriptionPlan: Plan.FREE,
      tenantPlan: Plan.FREE,
    };
    const app = await buildApp(state);
    const { raw } = signedPayload(Plan.PRO);

    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=bad-signature",
      },
      payload: raw,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Invalid signature" });
    assert.equal(state.paymentEventsCreated, 0);
    assert.equal(state.subscriptionPlan, Plan.FREE);
    assert.equal(state.tenantPlan, Plan.FREE);

    await app.close();
  });

  it("processes signed checkout.session.completed events once", async () => {
    const state: PaymentState = {
      eventIds: new Set(),
      paymentEventsCreated: 0,
      subscriptionPlan: Plan.FREE,
      tenantPlan: Plan.FREE,
    };
    const app = await buildApp(state);
    const { raw, signature } = signedPayload(Plan.ENTERPRISE);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      payload: raw,
    });
    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      payload: raw,
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(duplicateResponse.statusCode, 200);
    assert.deepEqual(firstResponse.json(), { received: true });
    assert.deepEqual(duplicateResponse.json(), { received: true });
    assert.equal(state.paymentEventsCreated, 1);
    assert.equal(state.subscriptionPlan, Plan.ENTERPRISE);
    assert.equal(state.tenantPlan, Plan.ENTERPRISE);
    assert.equal(state.stripeCheckoutSessionId, SESSION_ID);

    await app.close();
  });
});
