import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
});

describe("csrf token helpers", () => {
  it("creates tokens that validate and compare successfully", async () => {
    const { areSameCsrfToken, createCsrfToken, isValidCsrfToken } = await import("./csrf.js");

    const token = createCsrfToken();

    assert.equal(isValidCsrfToken(token), true);
    assert.equal(areSameCsrfToken(token, token), true);
  });

  it("rejects missing, malformed, and tampered tokens", async () => {
    const { areSameCsrfToken, createCsrfToken, isValidCsrfToken } = await import("./csrf.js");

    const token = createCsrfToken();
    const [value, signature] = token.split(".");
    const tamperedToken = `${value}.${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;

    assert.equal(isValidCsrfToken(undefined), false);
    assert.equal(isValidCsrfToken("missing-signature"), false);
    assert.equal(isValidCsrfToken(tamperedToken), false);
    assert.equal(areSameCsrfToken(token, tamperedToken), false);
  });
});
