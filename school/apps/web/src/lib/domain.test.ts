import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTenantDashboardUrl, getTenantSubdomainFromHostname } from "./domain";

describe("tenant domain helpers", () => {
  it("extracts tenant subdomains under the configured app domain", () => {
    assert.equal(getTenantSubdomainFromHostname("bbbb.school.zinox.me", "school.zinox.me"), "bbbb");
    assert.equal(getTenantSubdomainFromHostname("school.zinox.me", "school.zinox.me"), null);
    assert.equal(getTenantSubdomainFromHostname("school.zinox.me.evil.com", "school.zinox.me"), null);
  });

  it("builds tenant dashboard URLs for valid tenant subdomains", () => {
    assert.equal(getTenantDashboardUrl("bbbb", "school.zinox.me"), "https://bbbb.school.zinox.me/dashboard");
    assert.equal(getTenantDashboardUrl("bad.name", "school.zinox.me"), null);
  });
});
