import { computed } from "vue";
import { getMemberPaymentRecency } from "./api";
import { useQuery } from "@/lib/query";
import { token, lodgeId } from "@/lib/session";

export type PaymentRecency = {
  member_id: string;
  last_payment_at: string | null;
  reference_at: string | null;
  reference_source:
    "member_payment" | "adjustment" | "opening_balance" | "first_period" | null;
  days_since_last_payment: number | null;
};
export function paymentRecencyTone(days: number | null) {
  if (days === null) return "neutral";
  if (days <= 30) return "green";
  if (days <= 60) return "yellow";
  if (days <= 80) return "orange";
  return "red";
}
export function usePaymentRecency(ids: () => string[]) {
  const query = useQuery(
    () =>
      ids().length
        ? getMemberPaymentRecency(token.value, lodgeId.value, ids())
        : Promise.resolve([]),
    ids,
  );
  const byMember = computed(
    () => new Map(query.data.value?.map((item) => [item.member_id, item])),
  );
  return { ...query, byMember };
}
