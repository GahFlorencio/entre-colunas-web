import { describe, expect, it } from "vitest";
import { phone } from "../../src/lib/format";
describe("member phone masks", () => {
  it.each([
    ["11999999999", "(11) 99999-9999"],
    ["1133334444", "(11) 3333-4444"],
    ["+55 11 99999 9999", "+55 (11) 99999-9999"],
    ["(11) 99999-9999", "(11) 99999-9999"],
    [null, "Sem telefone"],
    ["", "Sem telefone"],
    ["1234", "1234"],
  ])(
    "formats %s as %s without losing unrecognized numbers",
    (value, expected) => {
      expect(phone(value)).toBe(expected);
    },
  );
});
