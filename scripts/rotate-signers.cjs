const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const envText = fs.readFileSync(envPath, "utf8");
const config = dotenv.parse(envText);

function requireValue(name) {
  const value = config[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function rewriteEnv(updates, removals = []) {
  const keys = new Set([...Object.keys(updates), ...removals]);
  const retained = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      return !match || !keys.has(match[1]);
    });
  const next = [
    "# Signers are local-only. Never commit, display, or share this file.",
    ...Object.entries(updates).map(([key, value]) => `${key}=${value}`),
    ...retained
  ].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  const tempPath = `${envPath}.rotation-tmp`;
  fs.writeFileSync(tempPath, next, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, envPath);
  try { fs.chmodSync(envPath, 0o600); } catch {}
}

async function main() {
  if (config.SIGNER_ROTATED_AT) throw new Error("Signer rotation is already recorded; refusing to rotate again.");

  const rpcUrl = config.OG_MAINNET_RPC_URL?.trim() || "https://evmrpc.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 16661n) throw new Error(`Unexpected chain ${network.chainId}.`);

  const oldWallet = new ethers.Wallet(requireValue("PRIVATE_KEY"), provider);
  const originalBalance = await provider.getBalance(oldWallet.address);
  const storageFunding = ethers.parseEther("0.1");
  if (originalBalance <= storageFunding + ethers.parseEther("0.02")) {
    throw new Error("The current signer does not have enough 0G for safe rotation, Storage funding, and gas.");
  }

  const deployer = ethers.Wallet.createRandom();
  const storage = ethers.Wallet.createRandom();
  const startedAt = new Date().toISOString();

  // Preserve the legacy signer locally until both transfers confirm, so an interrupted rotation is recoverable.
  rewriteEnv({
    PRIVATE_KEY: deployer.privateKey,
    OG_STORAGE_PRIVATE_KEY: storage.privateKey,
    LEGACY_PRIVATE_KEY: oldWallet.privateKey,
    SIGNER_ROTATION_PENDING: startedAt
  });

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? BigInt(await provider.send("eth_gasPrice", []));
  const gasLimit = 21000n;

  const storageTx = await oldWallet.sendTransaction({
    to: storage.address,
    value: storageFunding,
    gasLimit,
    gasPrice,
    type: 0
  });
  const storageReceipt = await storageTx.wait(2, 60000);
  if (!storageReceipt || storageReceipt.status !== 1) throw new Error("Storage wallet funding transaction failed.");

  const remaining = await provider.getBalance(oldWallet.address);
  const refreshedFee = await provider.getFeeData();
  const sweepGasPrice = refreshedFee.gasPrice ?? gasPrice;
  const sweepFee = gasLimit * sweepGasPrice;
  const dust = 1_000_000_000_000n;
  if (remaining <= sweepFee + dust) throw new Error("Insufficient remaining balance to sweep to the new deployer.");

  const sweepTx = await oldWallet.sendTransaction({
    to: deployer.address,
    value: remaining - sweepFee - dust,
    gasLimit,
    gasPrice: sweepGasPrice,
    type: 0
  });
  const sweepReceipt = await sweepTx.wait(2, 60000);
  if (!sweepReceipt || sweepReceipt.status !== 1) throw new Error("Deployer sweep transaction failed.");

  const completedAt = new Date().toISOString();
  rewriteEnv({
    PRIVATE_KEY: deployer.privateKey,
    OG_STORAGE_PRIVATE_KEY: storage.privateKey,
    SIGNER_ROTATED_AT: completedAt,
    DEPLOYER_ADDRESS: deployer.address,
    STORAGE_SIGNER_ADDRESS: storage.address
  }, ["LEGACY_PRIVATE_KEY", "SIGNER_ROTATION_PENDING"]);

  const evidenceDir = path.join(root, "artifacts", "wave3");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `wallet-rotation-${Date.now()}.json`);
  const evidence = {
    schema: "apolo-mind/wave3/wallet-rotation/v1",
    chainId: 16661,
    startedAt,
    completedAt,
    oldAddress: oldWallet.address,
    deployerAddress: deployer.address,
    storageSignerAddress: storage.address,
    originalBalance: ethers.formatEther(originalBalance),
    storageFunding: ethers.formatEther(storageFunding),
    storageFundingTransaction: storageTx.hash,
    deployerSweepTransaction: sweepTx.hash,
    finalOldBalance: ethers.formatEther(await provider.getBalance(oldWallet.address)),
    finalDeployerBalance: ethers.formatEther(await provider.getBalance(deployer.address)),
    finalStorageBalance: ethers.formatEther(await provider.getBalance(storage.address)),
    status: "CONFIRMED"
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...evidence, evidencePath: path.relative(root, evidencePath) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
