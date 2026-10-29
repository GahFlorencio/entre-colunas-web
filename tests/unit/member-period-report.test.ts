import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMemberPeriodReport } from "../../src/domain/member-account/period-report";
import { requestMemberAccountResource } from "../../src/domain/member-account/api";
import { memberPeriodReport } from "../fixtures/member-period-report";
vi.mock("../../src/domain/member-account/api", () => ({
  requestMemberAccountResource: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(requestMemberAccountResource).mockReset();
});
describe("demonstrativo do membro", () => {
  it("aceita total oficial e itens completos com acréscimo exatamente uma vez", async () => {
    vi.mocked(requestMemberAccountResource).mockResolvedValue(
      memberPeriodReport(),
    );
    const report = await getMemberPeriodReport("t", "12", "21", "81");
    expect(report.total_charges).toBe(165.83);
    expect(
      report.items.filter((item) => item.type === "acrescimo"),
    ).toHaveLength(1);
  });
  it.each(["masonic_lodge_id", "member_id", "financial_period_id"])(
    "recusa relatório de outro contexto: %s",
    async (field) => {
      vi.mocked(requestMemberAccountResource).mockResolvedValue({
        ...memberPeriodReport(),
        [field]: "999",
      });
      await expect(
        getMemberPeriodReport("t", "12", "21", "81"),
      ).rejects.toThrow("inconsistente");
    },
  );
  it("recusa itens faltantes ou repetidos em vez de exportar relatório parcial", async () => {
    const report = memberPeriodReport();
    vi.mocked(requestMemberAccountResource).mockResolvedValue({
      ...report,
      items: report.items.slice(1),
    });
    await expect(getMemberPeriodReport("t", "12", "21", "81")).rejects.toThrow(
      "inconsistente",
    );
    vi.mocked(requestMemberAccountResource).mockResolvedValue({
      ...report,
      items: [...report.items, report.items[0]],
    });
    await expect(getMemberPeriodReport("t", "12", "21", "81")).rejects.toThrow(
      "inconsistente",
    );
  });
  it("não interpreta falhas como cobranças zeradas", async () => {
    vi.mocked(requestMemberAccountResource).mockRejectedValue(
      new Error("Falha na consulta"),
    );
    await expect(getMemberPeriodReport("t", "12", "21", "81")).rejects.toThrow(
      "Falha na consulta",
    );
  });
});
