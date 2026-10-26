import { ApiError } from "@/domain/auth/api";
import { requestLodgeFinancialResource } from "./api";
import {
  validateLodgeFinancialSummary,
  type FetchLodgeFinancialSummary,
} from "./summary-state";

/** Global totals arrive atomically; no statement balance or page sums are used as a fallback. */
export const readLodgeFinancialSummary: FetchLodgeFinancialSummary = async (
  token,
  lodgeId,
  signal,
) => {
  if (!/^[1-9]\d*$/.test(lodgeId)) {
    throw new ApiError("Loja inválida.", 400, "validation");
  }
  const response = await requestLodgeFinancialResource(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/financial/summary`,
    signal,
  );
  return validateLodgeFinancialSummary(response, lodgeId);
};
