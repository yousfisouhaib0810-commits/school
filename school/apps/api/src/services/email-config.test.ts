import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("email configuration helpers", () => {
  it("rejects missing and placeholder Resend sender values", async () => {
    const { getEmailDomain, isConfiguredValue, isUsableEmailSender } = await import("./email-config.js");

    assert.equal(isConfiguredValue(undefined), false);
    assert.equal(isConfiguredValue("replace-with-resend-key"), false);
    assert.equal(isUsableEmailSender("School <noreply@your-domain.com>"), false);
    assert.equal(isUsableEmailSender("noreply@example.com"), false);
    assert.equal(getEmailDomain("School <noreply@school.example.dz>"), "school.example.dz");
  });

  it("accepts a concrete sender domain", async () => {
    const { isUsableEmailSender } = await import("./email-config.js");

    assert.equal(isUsableEmailSender("School Platform <noreply@school-platform.dz>"), true);
  });
});
