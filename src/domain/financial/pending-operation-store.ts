import * as SecureStore from "@/lib/browser-storage";

export type ExpensePendingAction = "create" | "update" | "cancel";
export type PendingState = "prepared" | "unknown" | "conflict";
type PendingOperationBase = {
  version: 1;
  operationId: string;
  idempotencyKey: string;
  userId: string;
  lodgeId: string;
  bodyJson: string;
};
export type ExpensePendingOperation = PendingOperationBase & {
  action: ExpensePendingAction;
  method: "POST" | "PATCH";
  path: string;
  resourceId?: string;
};
export type PeriodClosePendingOperation = PendingOperationBase & {
  action: "period-close";
  method: "POST";
  path: string;
  resourceId: string;
};
export type FinancialPostingAction =
  | "member-payment"
  | "lodge-income"
  | "lodge-adjustment"
  | "member-adjustment"
  | "operation-reversal";
export type FinancialPostingPendingOperation = PendingOperationBase & {
  action: FinancialPostingAction;
  method: "POST";
  path: string;
  resourceId?: string;
};
export type PendingOperation =
  | ExpensePendingOperation
  | PeriodClosePendingOperation
  | FinancialPostingPendingOperation;
export function isFinancialPostingPendingOperation(
  operation: PendingOperation,
): operation is FinancialPostingPendingOperation {
  return [
    "member-payment",
    "lodge-income",
    "lodge-adjustment",
    "member-adjustment",
    "operation-reversal",
  ].includes(operation.action);
}
type Manifest = {
  version: 1;
  operationId: string;
  blockCount: number;
  state: PendingState;
};
export type PendingRead =
  | { kind: "none" }
  | { kind: "ready"; operation: PendingOperation; state: PendingState }
  | { kind: "incomplete" };

export function isPeriodClosePendingOperation(
  operation: PendingOperation,
): operation is PeriodClosePendingOperation {
  return operation.action === "period-close";
}

export function isExpensePendingOperation(
  operation: PendingOperation,
): operation is ExpensePendingOperation {
  return (
    operation.action === "create" ||
    operation.action === "update" ||
    operation.action === "cancel"
  );
}

const PREFIX = "entre-colunas.expense.pending.v1";
const CHUNK_MAX_UTF8_BYTES = 1024;
let writes: Promise<unknown> = Promise.resolve();

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation, operation);
  writes = result.catch(() => undefined);
  return result;
}

function contextKey(userId: string, lodgeId: string): string {
  if (!userId.trim() || !lodgeId.trim())
    throw new Error("A intenção precisa de usuário e loja.");
  return `${PREFIX}.${encodeURIComponent(userId)}.${encodeURIComponent(lodgeId)}`;
}

function utf8Length(value: string): number {
  let length = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    length += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return length;
}

export function splitUtf8(
  value: string,
  maxBytes = CHUNK_MAX_UTF8_BYTES,
): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes < 4)
    throw new RangeError("O bloco deve suportar ao menos quatro bytes UTF-8.");
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const char of value) {
    const size = utf8Length(char);
    if (bytes + size > maxBytes && chunk) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk || chunks.length === 0) chunks.push(chunk);
  return chunks;
}

function manifestKey(context: string) {
  return `${context}.manifest`;
}
function blockKey(context: string, operationId: string, index: number) {
  return `${context}.block.${operationId}.${index}`;
}

function validatePendingOperation(
  value: unknown,
): asserts value is PendingOperation {
  if (!value || typeof value !== "object")
    throw new Error("A operação financeira está incompleta.");
  const operation = value as Partial<PendingOperation>;
  if (
    operation.version !== 1 ||
    !operation.operationId?.trim() ||
    !operation.idempotencyKey?.trim() ||
    !operation.userId?.trim() ||
    !operation.lodgeId?.trim() ||
    !operation.bodyJson
  ) {
    throw new Error("A operação financeira está incompleta.");
  }
  const body = JSON.parse(operation.bodyJson);
  if (isFinancialPostingPendingOperation(operation as PendingOperation)) {
    const posting = operation as FinancialPostingPendingOperation;
    const id = posting.resourceId;
    const validId = (value: unknown) =>
      typeof value === "string" && /^[1-9]\d*$/.test(value);
    const needsResource = [
      "member-payment",
      "member-adjustment",
      "operation-reversal",
    ].includes(posting.action);
    if (
      posting.method !== "POST" ||
      posting.idempotencyKey.length > 255 ||
      (needsResource && !validId(id)) ||
      (!needsResource && id !== undefined)
    )
      throw new Error("Recurso financeiro inválido.");
    const suffixes = {
      "member-payment": `/member/${id}/financial/payments`,
      "lodge-income": "/financial/incomes",
      "lodge-adjustment": "/financial/adjustments",
      "member-adjustment": `/member/${id}/financial/adjustments`,
      "operation-reversal": `/financial/operations/${id}/reversals`,
    };
    if (
      posting.path !==
      `/lodge/${encodeURIComponent(posting.lodgeId)}${suffixes[posting.action]}`
    )
      throw new Error("Caminho financeiro incompatível com o contexto.");
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.length > 255
    )
      throw new Error("Descrição inválida.");
    const adjustment =
      posting.action === "lodge-adjustment" ||
      posting.action === "member-adjustment";
    const reversal = posting.action === "operation-reversal";
    const allowed = [
      "description",
      ...(!reversal ? ["value"] : []),
      ...(posting.action === "lodge-income" ? ["expense_category_id"] : []),
      ...(adjustment
        ? ["kind", "direction", "justification", "source_entry_id"]
        : []),
      ...(reversal ? ["justification"] : []),
    ];
    if (Object.keys(body).some((key) => !allowed.includes(key)))
      throw new Error("Campo financeiro não permitido.");
    if (
      !reversal &&
      (typeof body.value !== "number" ||
        !Number.isFinite(body.value) ||
        body.value < 0.01 ||
        Math.abs(body.value * 100 - Math.round(body.value * 100)) > 1e-7 ||
        !Number.isSafeInteger(Math.round(body.value * 100)))
    )
      throw new Error("Valor inválido.");
    if (posting.action === "lodge-income" && !validId(body.expense_category_id))
      throw new Error("Categoria inválida.");
    if (
      (adjustment || reversal) &&
      (typeof body.justification !== "string" || !body.justification.trim())
    )
      throw new Error("Justificativa inválida.");
    if (
      adjustment &&
      (!["adjustment", "opening_balance"].includes(body.kind) ||
        !["debit", "credit"].includes(body.direction) ||
        (body.source_entry_id !== undefined && !validId(body.source_entry_id)))
    )
      throw new Error("Ajuste inválido.");
    return;
  }
  if (operation.action === "period-close") {
    if (
      operation.method !== "POST" ||
      !operation.resourceId ||
      !/^\d+$/.test(operation.resourceId) ||
      /^0+$/.test(operation.resourceId)
    ) {
      throw new Error("O fechamento pendente não contém um período válido.");
    }
    const expectedPath = `/lodge/${encodeURIComponent(operation.lodgeId)}/financial/periods/${encodeURIComponent(operation.resourceId)}/close`;
    if (operation.path !== expectedPath)
      throw new Error(
        "O caminho do fechamento não corresponde à loja e ao período salvos.",
      );
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(body, "acrescimo") ||
      typeof body.acrescimo !== "number" ||
      !Number.isFinite(body.acrescimo) ||
      body.acrescimo < 0 ||
      Math.round(body.acrescimo * 100) !== body.acrescimo * 100
    ) {
      throw new Error(
        "O corpo do fechamento deve conter somente um acréscimo monetário válido.",
      );
    }
    return;
  }
  if (
    !["create", "update", "cancel"].includes(operation.action ?? "") ||
    !["POST", "PATCH"].includes(operation.method ?? "") ||
    typeof operation.path !== "string" ||
    !operation.path.startsWith("/lodge/")
  ) {
    throw new Error("A operação de despesa está incompleta.");
  }
}

async function readUnlocked(
  userId: string,
  lodgeId: string,
): Promise<PendingRead> {
  const context = contextKey(userId, lodgeId);
  const rawManifest = await SecureStore.getItemAsync(manifestKey(context));
  if (!rawManifest) return { kind: "none" };
  let manifest: Manifest;
  try {
    manifest = JSON.parse(rawManifest) as Manifest;
    if (
      manifest.version !== 1 ||
      !manifest.operationId ||
      !Number.isInteger(manifest.blockCount) ||
      manifest.blockCount < 1 ||
      !["prepared", "unknown", "conflict"].includes(manifest.state)
    )
      return { kind: "incomplete" };
  } catch {
    return { kind: "incomplete" };
  }
  const chunks: string[] = [];
  for (let i = 0; i < manifest.blockCount; i += 1) {
    const chunk = await SecureStore.getItemAsync(
      blockKey(context, manifest.operationId, i),
    );
    if (chunk === null) return { kind: "incomplete" };
    chunks.push(chunk);
  }
  try {
    const operation = JSON.parse(chunks.join("")) as PendingOperation;
    validatePendingOperation(operation);
    if (
      operation.operationId !== manifest.operationId ||
      operation.userId !== userId ||
      operation.lodgeId !== lodgeId
    )
      return { kind: "incomplete" };
    return { kind: "ready", operation, state: manifest.state };
  } catch {
    return { kind: "incomplete" };
  }
}

export function readPendingOperation(
  userId: string,
  lodgeId: string,
): Promise<PendingRead> {
  return serializeWrite(() => readUnlocked(userId, lodgeId));
}

export function preparePendingOperation(
  operation: PendingOperation,
): Promise<void> {
  return serializeWrite(async () => {
    const context = contextKey(operation.userId, operation.lodgeId);
    if (
      (await readUnlocked(operation.userId, operation.lodgeId)).kind !== "none"
    )
      throw new Error("Há uma operação financeira pendente neste contexto.");
    validatePendingOperation(operation);
    const serialized = JSON.stringify(operation);
    const chunks = splitUtf8(serialized);
    for (let i = 0; i < chunks.length; i += 1)
      await SecureStore.setItemAsync(
        blockKey(context, operation.operationId, i),
        chunks[i],
      );
    for (let i = 0; i < chunks.length; i += 1) {
      if (
        (await SecureStore.getItemAsync(
          blockKey(context, operation.operationId, i),
        )) !== chunks[i]
      )
        throw new Error(
          "Não foi possível conferir a operação salva com segurança.",
        );
    }
    const manifest: Manifest = {
      version: 1,
      operationId: operation.operationId,
      blockCount: chunks.length,
      state: "prepared",
    };
    await SecureStore.setItemAsync(
      manifestKey(context),
      JSON.stringify(manifest),
    );
  });
}

export function updatePendingState(
  userId: string,
  lodgeId: string,
  operationId: string,
  state: PendingState,
): Promise<boolean> {
  return serializeWrite(async () => {
    const context = contextKey(userId, lodgeId);
    const current = await readUnlocked(userId, lodgeId);
    if (
      current.kind !== "ready" ||
      current.operation.operationId !== operationId
    )
      return false;
    const raw = await SecureStore.getItemAsync(manifestKey(context));
    if (!raw) return false;
    const manifest = JSON.parse(raw) as Manifest;
    await SecureStore.setItemAsync(
      manifestKey(context),
      JSON.stringify({ ...manifest, state } satisfies Manifest),
    );
    return true;
  });
}

export function resolvePendingOperation(
  userId: string,
  lodgeId: string,
  operationId: string,
): Promise<boolean> {
  return serializeWrite(async () => {
    const context = contextKey(userId, lodgeId);
    const current = await readUnlocked(userId, lodgeId);
    if (
      current.kind !== "ready" ||
      current.operation.operationId !== operationId
    )
      return false;
    const raw = await SecureStore.getItemAsync(manifestKey(context));
    if (!raw) return false;
    const manifest = JSON.parse(raw) as Manifest;
    if (manifest.operationId !== operationId) return false;
    await SecureStore.deleteItemAsync(manifestKey(context));
    for (let i = 0; i < manifest.blockCount; i += 1)
      await SecureStore.deleteItemAsync(blockKey(context, operationId, i));
    return true;
  });
}
