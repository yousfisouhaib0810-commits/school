import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedTenantOrigin } from "./origins.js";

describe("isAllowedTenantOrigin", () => {
  it("allows the configured platform domain and its tenant subdomains", () => {
    const allowedOrigins = new Set(["https://school.zinox.me"]);

    assert.equal(isAllowedTenantOrigin("https://school.zinox.me", allowedOrigins, "school.zinox.me", "production"), true);
    assert.equal(isAllowedTenantOrigin("https://bbbb.school.zinox.me", allowedOrigins, "school.zinox.me", "production"), true);
    assert.equal(isAllowedTenantOrigin("https://academy.school.zinox.me", allowedOrigins, "school.zinox.me", "production"), true);
  });

  it("rejects unrelated domains and suffix tricks", () => {
    const allowedOrigins = new Set(["https://school.zinox.me"]);

    assert.equal(isAllowedTenantOrigin("https://evil.com", allowedOrigins, "school.zinox.me", "production"), false);
    assert.equal(isAllowedTenantOrigin("https://school.zinox.me.evil.com", allowedOrigins, "school.zinox.me", "production"), false);
    assert.equal(isAllowedTenantOrigin("https://evil-school.zinox.me", allowedOrigins, "school.zinox.me", "production"), false);
  });
});
