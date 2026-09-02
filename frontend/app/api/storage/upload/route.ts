import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 64 * 1024;

function storageConfig() {
  return {
    rpcUrl: process.env.OG_RPC_URL?.trim(),
    indexerRpc: process.env.OG_STORAGE_INDEXER_RPC?.trim(),
    privateKey: process.env.OG_STORAGE_PRIVATE_KEY?.trim()
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_UPLOAD_BYTES * 2) {
      return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
    }

    const body = JSON.parse(rawBody) as { data?: unknown };
    if (typeof body.data !== "string" || body.data.length === 0) {
      return NextResponse.json({ error: "A canonical JSON data string is required." }, { status: 400 });
    }

    const byteLength = new TextEncoder().encode(body.data).byteLength;
    if (byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Receipt payload exceeds the 64 KiB limit." }, { status: 413 });
    }
    JSON.parse(body.data);

    const config = storageConfig();
    if (!config.rpcUrl || !config.indexerRpc || !config.privateKey) {
      return NextResponse.json({ error: "Real 0G Storage is not configured. Set OG_RPC_URL, OG_STORAGE_INDEXER_RPC, and OG_STORAGE_PRIVATE_KEY on the server." }, { status: 503 });
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(config.privateKey, provider);
    const indexer = new Indexer(config.indexerRpc);
    const file = new MemData(new TextEncoder().encode(body.data));
    const [result, uploadError] = await indexer.upload(file, config.rpcUrl, signer);
    if (uploadError) throw uploadError;

    const rootHash = "rootHash" in result ? result.rootHash : result.rootHashes[0];
    const txHash = "txHash" in result ? result.txHash : result.txHashes[0] ?? "";
    if (!/^0x[a-fA-F0-9]{64}$/.test(rootHash)) {
      throw new Error("0G Storage returned an invalid root hash.");
    }

    return NextResponse.json({ rootHash, txHash, byteLength, mode: "0g-storage" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "0G Storage upload failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
