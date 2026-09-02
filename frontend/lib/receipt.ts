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
  /** Legacy local receipts may have this field; live receipts use txHash. */
  mockTxHash?: string;
  receiptHash: string;
  localStatus?: "LOCAL_ONLY" | "STORAGE_UPLOADED" | "ON_CHAIN_RECORDED" | "ERROR";
  storageMode?: "0g-storage";
  onChainPaymentId?: string;
  txHash?: string;
  transactionHash?: string;
  intentHash?: string;
  chainId?: number;
  amountBaseUnits?: string;
  preReceiptRoot?: string;
  finalReceiptRoot?: string;
  storageRoot?: string;
  storageTxHash?: string;
  storageError?: string;
  contractError?: string;
  id: string;
  owner: string;
  agentWallet: string;
  memo: string;
  decision: { approved: boolean; reason: string };
  storageUri?: string;
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
  const { receiptHash: _receiptHash, id: _id, storageUri: _storageUri, storageRoot: _storageRoot, storageTxHash: _storageTxHash, ...hashable } = receipt as Receipt;
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
  const receiptSeed = await sha256Hex(stableStringify(basePayload));
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
    storageUri: undefined,
    createdAt: timestamp
  };
  const receiptHash = await hashReceipt(unsignedReceipt);

  return {
    ...unsignedReceipt,
    receiptHash,
    localStatus: "LOCAL_ONLY"
  };
}

export type OnChainReceiptInput = {
  owner: string;
  agent: string;
  receiver: string;
  amount: number;
  amountBaseUnits: string;
  policyId: string;
  intentHash: string;
  paymentTxHash: string;
  preReceiptRoot: string;
  reason: string;
  finalReceiptRoot?: string;
  storageRoot?: string;
  storageTxHash?: string;
  chainId: number;
};

export async function createOnChainReceipt(input: OnChainReceiptInput): Promise<Receipt> {
  const timestamp = new Date().toISOString();
  const receiptId = `rcpt-${input.intentHash.slice(2, 14)}`;
  const checks: PolicyCheck[] = [
    { label: "Agent approved", passed: true },
    { label: "Receiver allowed", passed: true },
    { label: "Below max per transaction", passed: true },
    { label: "Within daily limit", passed: true },
    { label: "Reason provided", passed: input.reason.trim().length > 0 }
  ];
  const unsignedReceipt: Omit<Receipt, "receiptHash"> = {
    receiptId,
    user: input.owner,
    agent: input.agent,
    receiver: input.receiver,
    amount: input.amount,
    amountBaseUnits: input.amountBaseUnits,
    policyId: input.policyId,
    reason: input.reason,
    status: "APPROVED",
    riskLevel: "LOW",
    checks,
    timestamp,
    id: receiptId,
    owner: input.owner,
    agentWallet: input.agent,
    memo: input.reason,
    decision: { approved: true, reason: "Eligible intent executed by the guarded vault." },
    txHash: input.paymentTxHash,
    transactionHash: input.paymentTxHash,
    intentHash: input.intentHash,
    chainId: input.chainId,
    preReceiptRoot: input.preReceiptRoot,
    finalReceiptRoot: input.finalReceiptRoot,
    storageRoot: input.storageRoot,
    storageTxHash: input.storageTxHash,
    storageMode: "0g-storage",
    onChainPaymentId: input.intentHash,
    localStatus: "ON_CHAIN_RECORDED",
    createdAt: timestamp
  };
  const receiptHash = await hashReceipt(unsignedReceipt);
  return { ...unsignedReceipt, receiptHash };
}

/** Importable, read-only UI representation of the funded Wave 3 mainnet proof. */
export async function createVerifiedWave3Receipt(): Promise<Receipt> {
  const receipt = await createOnChainReceipt({
    owner: "0x9cdA1F1B46381a8fA831de315dB2F8ba8B813FFc",
    agent: "0x9cdA1F1B46381a8fA831de315dB2F8ba8B813FFc",
    receiver: "0x43e931272144bD746c00AB1c4f05fD536Db4Af78",
    amount: 0.001,
    amountBaseUnits: "1000000000000000",
    policyId: "1",
    intentHash: "0xe4331f420afcba429e898194cd8ad3351f772d8b70af1b8720da4ccc671c093f",
    paymentTxHash: "0x76130405d42e024c4431d0b38398f11b3574f789d16eba2f5450ae689c8b4402",
    preReceiptRoot: "0x01ab3a98cef0f996585fdc17ad0e3c2748c3d0dec44ba1351cc131ae8eaee0d6",
    finalReceiptRoot: "0x63448259a19b4c82925118c90de292beefd485a60a57d4f7394899d2469d7674",
    storageRoot: "0x63448259a19b4c82925118c90de292beefd485a60a57d4f7394899d2469d7674",
    storageTxHash: "0x9d13d36880017196b0e773bbfd1cb4fd64fac06b0cbb201ae71459f14d947318",
    reason: "Wave 3 funded low-value mainnet proof",
    chainId: 16661
  });
  const completedAt = "2026-09-01T18:58:14.610Z";
  const verified = {
    ...receipt,
    receiptId: "wave3-mainnet-proof",
    id: "wave3-mainnet-proof",
    timestamp: completedAt,
    createdAt: completedAt
  };
  return { ...verified, receiptHash: await hashReceipt(verified) };
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

