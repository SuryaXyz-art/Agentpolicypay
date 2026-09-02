import type { Receipt } from "./receipt";

export type StorageResult = {
  rootHash: `0x${string}`;
  txHash: string;
  mode: "0g-storage";
  byteLength: number;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

export function canonicalJson(value: unknown) {
  return stableStringify(value);
}

export async function uploadJsonToStorage(value: unknown): Promise<StorageResult> {
  const data = canonicalJson(value);
  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data })
  });
  const result = await response.json() as Partial<StorageResult> & { error?: string };
  if (!response.ok || !result.rootHash) {
    throw new Error(result.error ?? "0G Storage upload failed.");
  }

  return {
    rootHash: result.rootHash as `0x${string}`,
    txHash: result.txHash ?? "",
    mode: "0g-storage",
    byteLength: result.byteLength ?? new TextEncoder().encode(data).byteLength
  };
}

export async function uploadReceiptToStorage(receipt: Receipt): Promise<StorageResult> {
  return uploadJsonToStorage(receipt);
}

export async function verifyStoredJson<T = unknown>(rootHash: string): Promise<T> {
  const response = await fetch(`/api/storage/download?rootHash=${encodeURIComponent(rootHash)}`);
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error ?? "Unable to download and verify the 0G Storage object.");
  }
  return await response.json() as T;
}

/** @deprecated Use uploadReceiptToStorage and retain the root hash, not a URI placeholder. */
export async function storeReceiptOn0G(receipt: Receipt): Promise<string> {
  const result = await uploadReceiptToStorage(receipt);
  return result.rootHash;
}
