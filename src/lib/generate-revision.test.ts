import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DUMMY_AI_RESPONSE, generateRevision } from "./generate-revision";

describe("generateRevision", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the dummy response after a simulated delay", async () => {
    const promise = generateRevision("Original text", "Make it shorter");

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe(DUMMY_AI_RESPONSE);
    expect(resolved).toBe(true);
  });
});
