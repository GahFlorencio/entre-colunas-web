import { ApiError } from "@/domain/auth/api";
import { QueryGuard } from "@/domain/expenses/query-guard";

/** Published GET /lodge/{lodgeId}/financial/summary response. */
export type LodgeFinancialSummary = {
  masonic_lodge_id: string;
  cash_balance: number;
  unpaid_expenses_total: number;
  accounts_receivable_total: number;
  calculated_at: string;
};

export type LodgeFinancialSummaryState = {
  value: LodgeFinancialSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  stale: boolean;
  accessDenied: boolean;
};

export const initialLodgeFinancialSummaryState: LodgeFinancialSummaryState = {
  value: null,
  loading: false,
  refreshing: false,
  error: null,
  stale: false,
  accessDenied: false,
};

export type LodgeFinancialSummaryQueryContext = {
  token: string;
  userId: string;
  lodgeId: string;
} | null;

export type FetchLodgeFinancialSummary = (
  token: string,
  lodgeId: string,
  signal?: AbortSignal,
) => Promise<unknown>;

function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    return false;
  const instant = new Date(value);
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateLodgeFinancialSummary(
  value: unknown,
  lodgeId: string,
): LodgeFinancialSummary {
  if (
    !isRecord(value) ||
    value.masonic_lodge_id !== lodgeId ||
    typeof value.cash_balance !== "number" ||
    !Number.isFinite(value.cash_balance) ||
    typeof value.unpaid_expenses_total !== "number" ||
    !Number.isFinite(value.unpaid_expenses_total) ||
    value.unpaid_expenses_total < 0 ||
    typeof value.accounts_receivable_total !== "number" ||
    !Number.isFinite(value.accounts_receivable_total) ||
    value.accounts_receivable_total < 0 ||
    !isUtcInstant(value.calculated_at)
  ) {
    throw new ApiError(
      "A API retornou um resumo financeiro incompatível. Atualize e tente novamente.",
      undefined,
      "invalid-response",
    );
  }
  return {
    masonic_lodge_id: value.masonic_lodge_id,
    cash_balance: value.cash_balance,
    unpaid_expenses_total: value.unpaid_expenses_total,
    accounts_receivable_total: value.accounts_receivable_total,
    calculated_at: value.calculated_at,
  };
}

function contextKey(context: LodgeFinancialSummaryQueryContext): string {
  return context
    ? JSON.stringify([context.token, context.userId, context.lodgeId])
    : "";
}

function requiresDataClear(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === "unauthorized" || error.kind === "not-found")
  );
}

function messageOf(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
    ? error.message
    : "Não foi possível carregar o resumo financeiro. Tente novamente.";
}

export class LodgeFinancialSummaryController {
  private context: LodgeFinancialSummaryQueryContext = null;
  private key = "";
  private state = initialLodgeFinancialSummaryState;
  private guard = new QueryGuard();
  private active = false;
  private listeners = new Set<(state: LodgeFinancialSummaryState) => void>();

  constructor(private readonly fetchSummary: FetchLodgeFinancialSummary) {}

  getSnapshot = (): LodgeFinancialSummaryState => this.state;

  subscribe = (
    listener: (state: LodgeFinancialSummaryState) => void,
  ): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  setContext(context: LodgeFinancialSummaryQueryContext): boolean {
    const key = contextKey(context);
    if (key === this.key) return false;
    this.guard.invalidate();
    this.active = false;
    this.context = context ? { ...context } : null;
    this.key = key;
    this.state = initialLodgeFinancialSummaryState;
    this.emit();
    return true;
  }

  invalidate(clearData = true): void {
    this.guard.invalidate();
    this.active = false;
    if (clearData) {
      this.context = null;
      this.key = "";
      this.state = initialLodgeFinancialSummaryState;
    } else {
      this.state = { ...this.state, loading: false, refreshing: false };
    }
    this.emit();
  }

  clearData(): void {
    this.guard.invalidate();
    this.active = false;
    this.state = initialLodgeFinancialSummaryState;
    this.emit();
  }

  async load(refresh = false): Promise<void> {
    const context = this.context;
    const key = this.key;
    if (!context || this.active) return;
    this.active = true;
    const ticket = this.guard.begin(key);
    this.state = {
      ...this.state,
      loading: this.state.value === null,
      refreshing: refresh && this.state.value !== null,
      error: null,
    };
    this.emit();
    try {
      const response = await this.fetchSummary(context.token, context.lodgeId);
      if (!this.guard.isCurrent(ticket, this.key)) return;
      const value = validateLodgeFinancialSummary(response, context.lodgeId);
      this.state = {
        value,
        loading: false,
        refreshing: false,
        error: null,
        stale: false,
        accessDenied: false,
      };
      this.emit();
    } catch (error) {
      if (!this.guard.isCurrent(ticket, this.key)) return;
      if (requiresDataClear(error)) {
        this.state = {
          ...initialLodgeFinancialSummaryState,
          accessDenied: true,
        };
        this.emit();
      }
      this.state = {
        ...this.state,
        loading: false,
        refreshing: false,
        error: messageOf(error),
        stale: this.state.value !== null,
      };
      this.emit();
    } finally {
      if (this.guard.isCurrent(ticket, this.key)) this.active = false;
    }
  }
}
