import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("retry helper", () => {
  it("retries an async operation until it succeeds", async () => {
    const { retryAsync } = await import("./retry.js");
    let attempts = 0;

    const result = await retryAsync(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("not ready");
        }
        return "connected";
      },
      { attempts: 3, delayMs: 1 }
    );

    assert.equal(result, "connected");
    assert.equal(attempts, 3);
  });

  it("throws the final error after all attempts fail", async () => {
    const { retryAsync } = await import("./retry.js");
    let attempts = 0;

    await assert.rejects(
      retryAsync(
        async () => {
          attempts += 1;
          throw new Error("still down");
        },
        { attempts: 2, delayMs: 1 }
      ),
      /still down/
    );

    assert.equal(attempts, 2);
  });
});
