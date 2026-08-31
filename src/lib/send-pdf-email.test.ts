import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPdfEmail } from "./send-pdf-email";

describe("sendPdfEmail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after a simulated delay", async () => {
    const promise = sendPdfEmail("someone@example.com");

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });
});
