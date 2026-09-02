import hre from "hardhat";
import { existsSync } from "node:fs";
import { DeploymentBlocked, networkTarget, preflight, safeFailure, writeEvidence } from "./lib/deployment.ts";

async function main() {
  const target = networkTarget(hre.network.name, hre.network.config.chainId);
  if (existsSync(target.manifestPath)) throw new DeploymentBlocked("A Wave 3 deployment record already exists. Refusing to redeploy. Verify/reconcile the recorded transactions first.");
  const ready = await preflight();
  const record = {
    schema: "apolo-mind/wave3/deployment/v1",
    network: hre.network.name,
    chainId: target.chainId,
    rehearsalOnly: target.chainId === 31337,
    status: "PREPARED",
    createdAt: new Date().toISOString(),
    deployer: ready.address,
    maximumGasCostBaseUnits: ready.maximumCost.toString(),
    sourceVerification: "NOT_STARTED",
    contracts: ready.plans.map(plan => ({
      name: plan.name,
      address: plan.predictedAddress,
      nonce: plan.nonce,
      constructorArguments: plan.name === "AgentPaymentGuard" ? [ready.registryAddress] : [],
      creationDataHash: hre.ethers.keccak256(plan.data),
      expectedRuntimeHash: hre.ethers.keccak256(plan.expected.runtime),
      compiler: plan.expected.build.solcLongVersion,
      settings: plan.expected.build.input.settings,
      status: "NOT_SENT",
      transactionHash: null as string | null,
      blockNumber: null as number | null,
      gasUsed: null as string | null,
      runtimeHash: null as string | null,
      explorerAddress: target.explorer ? `${target.explorer}/address/${plan.predictedAddress}` : null,
      explorerTransaction: null as string | null
    }))
  };
  // Reserve the metadata filename BEFORE signing; interrupted submissions are never blindly repeated.
  writeEvidence(target.manifestPath, record, true);
  for (const [index, plan] of ready.plans.entries()) {
    const evidence = record.contracts[index];
    const sourcePath = target.manifestPath.replace(/\.json$/, `-${plan.name}-standard-input.json`);
    writeEvidence(sourcePath, plan.expected.build.input, true);
    if ((await ready.provider.getNetwork()).chainId !== BigInt(target.chainId)) throw new DeploymentBlocked("RPC network changed before signing.");
    if (await ready.provider.getTransactionCount(ready.address, "pending") !== plan.nonce) throw new DeploymentBlocked("Deployer nonce changed before signing; deployment stopped.");
    record.status = "IN_PROGRESS";
    evidence.status = "SUBMITTING";
    writeEvidence(target.manifestPath, record);
    const tx = await ready.signer.sendTransaction({ data: plan.data, nonce: plan.nonce, gasLimit: plan.gasLimit, gasPrice: ready.gasPrice, chainId: target.chainId, value: 0n, type: 0 });
    evidence.transactionHash = tx.hash;
    evidence.explorerTransaction = target.explorer ? `${target.explorer}/tx/${tx.hash}` : null;
    evidence.status = "PENDING";
    writeEvidence(target.manifestPath, record);
    console.log(`${plan.name} submitted: ${tx.hash}`);
    const receipt = await tx.wait(target.chainId === 31337 ? 1 : 2, 60000);
    if (!receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== plan.predictedAddress.toLowerCase()) throw new DeploymentBlocked("Deployment receipt missing, failed, or unexpected. Reconcile the recorded transaction; do not redeploy.");
    const code = await ready.provider.getCode(plan.predictedAddress);
    if (code.toLowerCase() !== plan.expected.runtime.toLowerCase()) throw new DeploymentBlocked("Deployed runtime bytecode differs from compiled sources.");
    evidence.blockNumber = receipt.blockNumber;
    evidence.gasUsed = receipt.gasUsed.toString();
    evidence.runtimeHash = hre.ethers.keccak256(code);
    evidence.status = "BYTECODE_MATCHED";
    writeEvidence(target.manifestPath, record);
    console.log(`${plan.name}: ${plan.predictedAddress}; bytecode matched.`);
  }
  const guard = await hre.ethers.getContractAt("AgentPaymentGuard", ready.guardAddress);
  if ((await guard.policyRegistry()).toLowerCase() !== ready.registryAddress.toLowerCase()) throw new DeploymentBlocked("Deployed vault points to an unexpected registry.");
  record.status = "DEPLOYED_BYTECODE_MATCHED";
  writeEvidence(target.manifestPath, record);
  console.log(`Deployment evidence: ${target.manifestPath}`);
  if (target.chainId !== 31337) console.log(`NEXT_PUBLIC_OG_CHAIN_ID=${target.chainId}\nNEXT_PUBLIC_REGISTRY_ADDRESS=${ready.registryAddress}\nNEXT_PUBLIC_PAYMENT_GUARD_ADDRESS=${ready.guardAddress}`);
  console.log("Deployment is not funded-payment, Storage, Compute, frontend-publication, or explorer-source-verification proof.");
}

main().catch(safeFailure);
