import type { PaymentRequest, PolicyCheck, PolicyEngineResult, RiskLevel } from "./policyEngine";
import { appendLocal, loadLocal } from "./localStore";

export type ReceiptStatus = "APPROVED" | "BLOCKED";

export type ReceiptPaymentRequest = Partial<PaymentRequest> & {
  userAddress?: string;
  user?: string;
  agentAddress?: string;
  agent?: string;
  receiverAddress?: string;
  receiver?: string;
  amount: number;
  policyId?: string;
  reason?: string;
  memo?: string;
};

export type Receipt = {
  receiptId: string;
  user: string;
  agent: string;
  receiver: string;
  amount: number;
  policyId?: string;
  reason: string;
  status: ReceiptStatus;
  riskLevel: RiskLevel;
  checks: PolicyCheck[];
  timestamp: string;
  mockTxHash: string;
  receiptHash: string;
  localStatus?: "LOCAL_ONLY" | "STORAGE_UPLOADED" | "ON_CHAIN_RECORDED" | "ERROR";
  storageMode?: "demo" | "0g-storage";
  onChainPaymentId?: string;
  txHash?: string;
  storageError?: string;
  contractError?: string;
  id: string;
  owner: string;
  agentWallet: string;
  memo: string;
  decision: { approved: boolean; reason: string };
  storageUri: string;
  createdAt: string;
};

type HashableReceipt = Omit<Receipt, "receiptHash" | "id" | "storageUri"> & { receiptHash?: string };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

async function sha256Hex(payload: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeRequest(paymentRequest: ReceiptPaymentRequest) {
  return {
    user: paymentRequest.user ?? paymentRequest.userAddress ?? "demo-user",
    agent: paymentRequest.agent ?? paymentRequest.agentAddress ?? paymentRequest.agentWallet ?? "unknown-agent",
    receiver: paymentRequest.receiver ?? paymentRequest.receiverAddress ?? "unknown-receiver",
    amount: paymentRequest.amount,
    policyId: paymentRequest.policyId,
    reason: paymentRequest.reason ?? paymentRequest.memo ?? "No reason provided"
  };
}

export async function hashReceipt(receipt: Omit<Receipt, "receiptHash"> | Receipt) {
  const { receiptHash: _receiptHash, id: _id, storageUri: _storageUri, ...hashable } = receipt as Receipt;
  return sha256Hex(stableStringify(hashable));
}

export async function generateReceipt(paymentRequest: ReceiptPaymentRequest, evaluationResult: PolicyEngineResult): Promise<Receipt> {
  const normalized = normalizeRequest(paymentRequest);
  const timestamp = new Date().toISOString();
  const status: ReceiptStatus = evaluationResult.allowed ? "APPROVED" : "BLOCKED";
  const basePayload = {
    ...normalized,
    status,
    riskLevel: evaluationResult.riskLevel,
    checks: evaluationResult.checks,
    timestamp
  };
  const mockTxHash = await sha256Hex(`${stableStringify(basePayload)}:mock-tx`);
  const receiptSeed = await sha256Hex(`${stableStringify(basePayload)}:${mockTxHash}`);
  const receiptId = `rcpt-${receiptSeed.slice(2, 14)}`;

  const unsignedReceipt: Omit<Receipt, "receiptHash"> = {
    receiptId,
    user: normalized.user,
    agent: normalized.agent,
    receiver: normalized.receiver,
    amount: normalized.amount,
    policyId: normalized.policyId,
    reason: normalized.reason,
    status,
    riskLevel: evaluationResult.riskLevel,
    checks: evaluationResult.checks,
    timestamp,
    mockTxHash,
    id: receiptId,
    owner: normalized.user,
    agentWallet: normalized.agent,
    memo: normalized.reason,
    decision: {
      approved: evaluationResult.allowed,
      reason: evaluationResult.allowed
        ? evaluationResult.reasons.at(-1) ?? "Approved by policy."
        : evaluationResult.blockedReasons[0] ?? "Blocked by policy."
    },
    storageUri: "",
    createdAt: timestamp
  };
  const receiptHash = await hashReceipt(unsignedReceipt);

  return {
    ...unsignedReceipt,
    receiptHash,
    storageUri: `demo-0g://receipts/${receiptHash.slice(2)}`,
    localStatus: "LOCAL_ONLY"
  };
}

export function saveReceipt(receipt: Receipt) {
  appendLocal<Receipt>("app.receipts", receipt);
  return receipt;
}

export function getReceipts() {
  return loadLocal<Receipt[]>("app.receipts", []);
}

export function getReceiptById(id: string) {
  return getReceipts().find((receipt) => receipt.receiptId === id || receipt.id === id);
}

export async function createReceipt(user: string, request: PaymentRequest, decision: { approved: boolean; reason: string }): Promise<Receipt> {
  return generateReceipt(
    {
      user,
      agentAddress: request.agentWallet,
      receiverAddress: request.receiver,
      amount: request.amount,
      reason: request.memo
    },
    {
      allowed: decision.approved,
      riskLevel: decision.approved ? "LOW" : "HIGH",
      reasons: decision.approved ? [decision.reason] : [],
      blockedReasons: decision.approved ? [] : [decision.reason],
      checks: [
        { label: "Agent approved", passed: decision.approved },
        { label: "Receiver allowed", passed: decision.approved },
        { label: "Below max per transaction", passed: decision.approved },
        { label: "Within daily limit", passed: decision.approved },
        { label: "Reason provided", passed: Boolean(request.memo) }
      ]
    }
  );
}

