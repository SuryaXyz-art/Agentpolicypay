const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { Indexer, MemData } = require("@0gfoundation/0g-storage-ts-sdk");

const root = path.resolve(__dirname, "..");
const config = dotenv.parse(fs.readFileSync(path.join(root, ".env"), "utf8"));

function required(name) {
  const value = config[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rpcUrl = required("OG_RPC_URL");
  const indexerRpc = required("OG_STORAGE_INDEXER_RPC");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 16661n) throw new Error(`Unexpected Storage chain ${network.chainId}.`);

  const signer = new ethers.Wallet(required("OG_STORAGE_PRIVATE_KEY"), provider);
  const balanceBefore = await provider.getBalance(signer.address);
  if (balanceBefore === 0n) throw new Error("The Storage signer has no native 0G for upload fees.");

  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({
    schema: "apolo-mind/wave3/storage-smoke/v1",
    network: "0g-aristotle",
    chainId: 16661,
    registryAddress: required("NEXT_PUBLIC_REGISTRY_ADDRESS"),
    paymentGuardAddress: required("NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS"),
    purpose: "Mainnet deployment receipt Storage proof",
    createdAt
  });
  const bytes = new TextEncoder().encode(payload);
  const data = new MemData(bytes);
  const [tree, treeError] = await data.merkleTree();
  if (treeError) throw treeError;
  const expectedRoot = tree.rootHash();

  const indexer = new Indexer(indexerRpc);
  const [result, uploadError] = await indexer.upload(data, rpcUrl, signer);
  if (uploadError) throw uploadError;
  const rootHash = "rootHash" in result ? result.rootHash : result.rootHashes[0];
  const transactionHash = "txHash" in result ? result.txHash : result.txHashes[0];
  if (!rootHash || rootHash.toLowerCase() !== expectedRoot.toLowerCase()) {
    throw new Error("Uploaded Storage root does not match the locally computed Merkle root.");
  }

  let downloadedText = null;
  let lastDownloadError = null;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const [blob, downloadError] = await indexer.downloadToBlob(rootHash, { proof: true });
    if (!downloadError) {
      downloadedText = await blob.text();
      break;
    }
    lastDownloadError = downloadError;
    if (attempt < 12) await delay(5000);
  }
  if (downloadedText === null) throw lastDownloadError || new Error("Storage proof retrieval timed out.");
  if (downloadedText !== payload) throw new Error("Downloaded Storage bytes differ from the uploaded receipt.");

  const balanceAfter = await provider.getBalance(signer.address);
  const completedAt = new Date().toISOString();
  const evidence = {
    schema: "apolo-mind/wave3/storage-smoke-evidence/v1",
    chainId: 16661,
    createdAt,
    completedAt,
    signerAddress: signer.address,
    indexerRpc,
    rootHash,
    expectedRoot,
    transactionHash,
    byteLength: bytes.byteLength,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    balanceBefore: ethers.formatEther(balanceBefore),
    balanceAfter: ethers.formatEther(balanceAfter),
    proofVerified: true,
    exactContentMatch: true,
    status: "VERIFIED"
  };
  const evidenceDir = path.join(root, "artifacts", "wave3");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `storage-smoke-${Date.now()}.json`);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...evidence, evidencePath: path.relative(root, evidencePath) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
