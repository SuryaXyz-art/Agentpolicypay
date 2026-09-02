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

async function confirmed(txPromise, label) {
  const tx = await txPromise;
  const receipt = await tx.wait(2, 60000);
  if (!receipt || receipt.status !== 1) throw new Error(`${label} failed.`);
  return receipt;
}

function eventFrom(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) return parsed;
    } catch {}
  }
  throw new Error(`${eventName} event was not found.`);
}

async function uploadAndVerify(indexer, rpcUrl, signer, payload) {
  const bytes = new TextEncoder().encode(payload);
  const data = new MemData(bytes);
  const [tree, treeError] = await data.merkleTree();
  if (treeError) throw treeError;
  const expectedRoot = tree.rootHash();
  const [result, uploadError] = await indexer.upload(data, rpcUrl, signer);
  if (uploadError) throw uploadError;
  const rootHash = "rootHash" in result ? result.rootHash : result.rootHashes[0];
  const transactionHash = "txHash" in result ? result.txHash : result.txHashes[0];
  if (!rootHash || rootHash.toLowerCase() !== expectedRoot.toLowerCase()) {
    throw new Error("Storage upload root differs from the computed Merkle root.");
  }

  let returned = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const [blob, downloadError] = await indexer.downloadToBlob(rootHash, { proof: true });
    if (!downloadError) {
      returned = await blob.text();
      break;
    }
    lastError = downloadError;
    if (attempt < 12) await delay(5000);
  }
  if (returned === null) throw lastError || new Error("Storage proof retrieval timed out.");
  if (returned !== payload) throw new Error("Storage retrieval did not match the uploaded bytes.");
  return {
    rootHash,
    transactionHash,
    byteLength: bytes.byteLength,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

async function main() {
  const rpcUrl = required("OG_RPC_URL");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 16661n) throw new Error(`Unexpected chain ${network.chainId}.`);

  const owner = new ethers.Wallet(required("PRIVATE_KEY"), provider);
  const storageSigner = new ethers.Wallet(required("OG_STORAGE_PRIVATE_KEY"), provider);
  const registryAddress = required("NEXT_PUBLIC_REGISTRY_ADDRESS");
  const guardAddress = required("NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS");
  const registryArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "contracts", "AgentPolicyRegistry.sol", "AgentPolicyRegistry.json"), "utf8"));
  const guardArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "contracts", "AgentPaymentGuard.sol", "AgentPaymentGuard.json"), "utf8"));
  const registry = new ethers.Contract(registryAddress, registryArtifact.abi, owner);
  const guard = new ethers.Contract(guardAddress, guardArtifact.abi, owner);
  const indexer = new Indexer(required("OG_STORAGE_INDEXER_RPC"));

  const maxPerTx = ethers.parseEther("0.01");
  const dailyLimit = ethers.parseEther("0.02");
  const threshold = ethers.parseEther("0.005");
  const vaultDeposit = ethers.parseEther("0.02");
  const paymentAmount = ethers.parseEther("0.001");
  const aboveThresholdAmount = ethers.parseEther("0.006");

  const policyReceipt = await confirmed(
    registry.createPolicy(maxPerTx, dailyLimit, threshold, true),
    "Policy creation"
  );
  const policyEvent = eventFrom(policyReceipt, registry, "PolicyCreated");
  const policyId = policyEvent.args.policyId;

  const approvals = {};
  approvals.agent = await confirmed(guard.approveAgent(policyId, owner.address), "Agent approval");
  approvals.receiver = await confirmed(guard.allowService(policyId, storageSigner.address), "Receiver allowlisting");
  approvals.deposit = await confirmed(guard.deposit(policyId, { value: vaultDeposit }), "Vault deposit");

  const latestBlock = await provider.getBlock("latest");
  const expiry = BigInt(latestBlock.timestamp + 3600);
  const preReceiptPayload = JSON.stringify({
    schema: "apolo-mind/wave3/pre-receipt/v1",
    chainId: 16661,
    policyId: policyId.toString(),
    agent: owner.address,
    receiver: storageSigner.address,
    amountBaseUnits: paymentAmount.toString(),
    expiry: expiry.toString(),
    purpose: "Authorized low-value Aristotle settlement proof",
    createdAt: new Date().toISOString()
  });
  const preReceipt = await uploadAndVerify(indexer, rpcUrl, storageSigner, preReceiptPayload);
  const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Wave 3 funded low-value mainnet proof"));
  const decisionRoot = ethers.keccak256(ethers.toUtf8Bytes(preReceiptPayload));

  const preview = await guard.previewIntent(policyId, owner.address, storageSigner.address, paymentAmount, expiry);
  if (!preview.allowed || preview.needsApproval) throw new Error("Low-value intent preview was not eligible for direct execution.");

  const intentReceipt = await confirmed(
    guard.createIntent(policyId, storageSigner.address, paymentAmount, expiry, reasonHash, decisionRoot, preReceipt.rootHash),
    "Payment intent creation"
  );
  const intentEvent = eventFrom(intentReceipt, guard, "PaymentIntentCreated");
  const intentHash = intentEvent.args.intentHash;
  const receiverBalanceBefore = await provider.getBalance(storageSigner.address);
  const executionReceipt = await confirmed(guard.executeIntent(intentHash), "Payment execution");
  const receiverBalanceAfter = await provider.getBalance(storageSigner.address);
  if (receiverBalanceAfter - receiverBalanceBefore !== paymentAmount) {
    throw new Error("Receiver balance delta does not equal the guarded payment amount.");
  }

  const finalReceiptPayload = JSON.stringify({
    schema: "apolo-mind/wave3/final-receipt/v1",
    chainId: 16661,
    policyId: policyId.toString(),
    intentHash,
    agent: owner.address,
    receiver: storageSigner.address,
    amountBaseUnits: paymentAmount.toString(),
    preReceiptRoot: preReceipt.rootHash,
    paymentTransaction: executionReceipt.hash,
    executedBlock: executionReceipt.blockNumber,
    finalizedAt: new Date().toISOString()
  });
  const finalReceipt = await uploadAndVerify(indexer, rpcUrl, storageSigner, finalReceiptPayload);
  const finalizationReceipt = await confirmed(
    guard.finalizeReceiptRoot(intentHash, finalReceipt.rootHash),
    "Final receipt-root binding"
  );
  const payment = await guard.getPayment(intentHash);
  if (payment.finalReceiptRoot.toLowerCase() !== finalReceipt.rootHash.toLowerCase()) {
    throw new Error("On-chain final receipt root does not match 0G Storage.");
  }

  const highPreview = await guard.previewIntent(policyId, owner.address, storageSigner.address, aboveThresholdAmount, expiry);
  if (!highPreview.allowed || !highPreview.needsApproval) throw new Error("Above-threshold preview did not require owner approval.");
  const highReceipt = await confirmed(
    guard.createIntent(policyId, storageSigner.address, aboveThresholdAmount, expiry, reasonHash, decisionRoot, preReceipt.rootHash),
    "Above-threshold intent creation"
  );
  const highIntentHash = eventFrom(highReceipt, guard, "PaymentIntentCreated").args.intentHash;
  let rejectionConfirmed = false;
  try {
    await guard.executeIntent.staticCall(highIntentHash);
  } catch {
    rejectionConfirmed = true;
  }
  if (!rejectionConfirmed) throw new Error("Above-threshold execution unexpectedly succeeded without approval.");
  const cancellationReceipt = await confirmed(guard.cancelIntent(highIntentHash), "Above-threshold intent cancellation");

  const [availableBalance, reservedBalance] = await guard.getBalance(policyId);
  const evidence = {
    schema: "apolo-mind/wave3/mainnet-payment-proof/v1",
    chainId: 16661,
    owner: owner.address,
    agent: owner.address,
    receiver: storageSigner.address,
    registryAddress,
    paymentGuardAddress: guardAddress,
    policyId: policyId.toString(),
    policyCreationTransaction: policyReceipt.hash,
    agentApprovalTransaction: approvals.agent.hash,
    receiverAllowlistTransaction: approvals.receiver.hash,
    vaultDepositTransaction: approvals.deposit.hash,
    vaultDeposit: ethers.formatEther(vaultDeposit),
    paymentAmount: ethers.formatEther(paymentAmount),
    intentHash,
    intentCreationTransaction: intentReceipt.hash,
    paymentExecutionTransaction: executionReceipt.hash,
    receiverBalanceDelta: ethers.formatEther(receiverBalanceAfter - receiverBalanceBefore),
    preReceipt,
    finalReceipt,
    receiptFinalizationTransaction: finalizationReceipt.hash,
    aboveThresholdAmount: ethers.formatEther(aboveThresholdAmount),
    aboveThresholdIntentHash: highIntentHash,
    aboveThresholdCreationTransaction: highReceipt.hash,
    executionWithoutApprovalRejected: rejectionConfirmed,
    cancellationTransaction: cancellationReceipt.hash,
    availableVaultBalance: ethers.formatEther(availableBalance),
    reservedVaultBalance: ethers.formatEther(reservedBalance),
    proofVerified: true,
    completedAt: new Date().toISOString(),
    status: "VERIFIED"
  };
  const evidenceDir = path.join(root, "artifacts", "wave3");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `mainnet-payment-${Date.now()}.json`);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...evidence, evidencePath: path.relative(root, evidencePath) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
