import type { Receipt } from "./receipt";

export type StorageResult = {
  uri: string;
  mode: "demo" | "0g-storage";
};

export async function uploadReceiptToStorage(receipt: Receipt): Promise<StorageResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (process.env.NEXT_PUBLIC_ENABLE_REAL_0G_STORAGE === "true") {
    throw new Error("0G Storage SDK is not wired yet. Disable real storage or add the SDK integration.");
  }

  return {
    uri: `demo-0g://receipts/${receipt.receiptHash.slice(2)}`,
    mode: "demo"
  };
}

export async function storeReceiptOn0G(receipt: Receipt): Promise<string> {
  const result = await uploadReceiptToStorage(receipt);
  return result.uri;
}
