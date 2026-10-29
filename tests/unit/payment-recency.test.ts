import { describe, it, expect } from "vitest";
import { paymentRecencyTone } from "../../src/domain/members/payment-recency";
describe("payment recency colors", () => {
  it.each([
    [0, "green"],
    [1, "green"],
    [30, "green"],
    [31, "yellow"],
    [60, "yellow"],
    [61, "orange"],
    [80, "orange"],
    [81, "red"],
    [365, "red"],
    [null, "neutral"],
  ] as const)("%s days uses %s", (days, tone) => {
    expect(paymentRecencyTone(days)).toBe(tone);
  });
});
