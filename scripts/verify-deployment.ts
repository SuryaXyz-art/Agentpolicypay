import hre from "hardhat";
import { readFileSync } from "node:fs";
import { contractNames, DeploymentBlocked, expectedRuntime, networkTarget, safeFailure, writeEvidence } from "./lib/deployment.ts";

async function main() {
  const target = networkTarget(hre.network.name, hre.network.config.chainId);
  if ((await hre.ethers.provider.getNetwork()).chainId !== BigInt(target.chainId)) throw new DeploymentBlocked("RPC network mismatch.");
  const record = JSON.parse(readFileSync(target.manifestPath, "utf8"));
  if (record.schema !== "apolo-mind/wave3/deployment/v1" || record.chainId !== target.chainId || record.status !== "DEPLOYED_BYTECODE_MATCHED" || record.contracts.length !== 2) throw new DeploymentBlocked("Incomplete or wrong-network deployment record. Reconcile transactions before verification.");
  const registryAddress = record.contracts[0].address;
  for (const [index, name] of contractNames.entries()) {
    const item = record.contracts[index];
    if (item.name !== name) throw new DeploymentBlocked("Unexpected contract order in deployment record.");
    const expected = await expectedRuntime(name, registryAddress);
    const code = await hre.ethers.provider.getCode(item.address);
    const receipt = await hre.ethers.provider.getTransactionReceipt(item.transactionHash);
    if (code.toLowerCase() !== expected.runtime.toLowerCase() || receipt?.status !== 1 || receipt.contractAddress?.toLowerCase() !== item.address.toLowerCase()) throw new DeploymentBlocked("Bytecode or deployment receipt mismatch; will not submit source verification.");
    const constructorArguments = name === "AgentPaymentGuard" ? [registryAddress] : [];
    await hre.run("verify:verify", { address: item.address, constructorArguments, contract: `${expected.artifact.sourceName}:${name}` });
    item.sourceVerification = "VERIFIED";
    writeEvidence(target.manifestPath, record);
  }
  record.sourceVerification = "VERIFIED";
  writeEvidence(target.manifestPath, record);
  console.log("Both contracts verified by the configured explorer.");
}

main().catch(safeFailure);
