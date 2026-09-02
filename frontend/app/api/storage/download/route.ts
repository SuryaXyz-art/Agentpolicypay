import { Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const rootHash = new URL(request.url).searchParams.get("rootHash") ?? "";
    if (!/^0x[a-fA-F0-9]{64}$/.test(rootHash)) {
      return NextResponse.json({ error: "A valid bytes32 Storage root hash is required." }, { status: 400 });
    }

    const indexerRpc = process.env.OG_STORAGE_INDEXER_RPC?.trim();
    if (!indexerRpc) {
      return NextResponse.json({ error: "OG_STORAGE_INDEXER_RPC is not configured on the server." }, { status: 503 });
    }

    const indexer = new Indexer(indexerRpc);
    const [blob, downloadError] = await indexer.downloadToBlob(rootHash, { proof: true });
    if (downloadError) throw downloadError;
    return new NextResponse(await blob.text(), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "0G Storage verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
