import { describe, it, expect } from "vitest";
import { calendarDate, label } from "../../src/lib/format";
describe("calendar dates", () => {
  it.each(["America/Sao_Paulo", "Pacific/Honolulu", "Asia/Tokyo"])(
    "preserves admission day in %s",
    (timezone) => {
      const previous = process.env.TZ;
      try {
        process.env.TZ = timezone;
        expect(calendarDate("2026-09-01T00:00:00.000Z")).toBe("01/09/2026");
        expect(calendarDate("2024-02-29")).toBe("29/02/2024");
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );
  it("rejects invalid calendar dates", () => {
    expect(calendarDate("2026-02-30")).toBe("—");
    expect(calendarDate(null)).toBe("—");
  });
  it("translates expense registration", () =>
    expect(label("expense_registration")).toBe("Registro de despesa"));
});
