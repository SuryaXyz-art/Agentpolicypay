import hre from "hardhat";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";

export class DeploymentBlocked extends Error {}

export function networkTarget(name: string, configuredChainId: number | undefined) {
  const chainId = name === "aristotle" ? 16661 : name === "og" ? 16602 : name === "hardhat" ? 31337 : 0;
  if (!chainId || configuredChainId !== chainId) throw new DeploymentBlocked("Unexpected deployment network/chain configuration.");
  return {
    chainId,
    explorer: chainId === 16661 ? "https://chainscan.0g.ai" : chainId === 16602 ? "https://chainscan-galileo.0g.ai" : null,
    manifestPath: chainId === 31337
      ? `artifacts/wave3/rehearsal-${Date.now()}.json`
      : `deployments/0g-${chainId === 16661 ? "aristotle" : "galileo"}-wave3.json`
  };
}

export function safeFailure(error: unknown) {
  // Provider errors may contain authenticated RPC URLs or raw requests. Never log those.
  console.error(error instanceof DeploymentBlocked ? error.message : "Deployment/verification failed. Check the saved deployment record and RPC status before retrying; no automatic resend.");
  process.exitCode = 1;
}

export function writeEvidence(path: string, data: unknown, create = false) {
  mkdirSync(dirname(path), { recursive: true });
  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (create) writeFileSync(path, json, { flag: "wx" });
  else {
    const temporaryPath = `${path}.tmp`;
    writeFileSync(temporaryPath, json, { flag: "wx" });
    renameSync(temporaryPath, path);
  }
}

export const contractNames = ["AgentPolicyRegistry", "AgentPaymentGuard"] as const;
export type ContractName = typeof contractNames[number];

export async function expectedRuntime(name: ContractName, registryAddress?: string) {
  const artifact = await hre.artifacts.readArtifact(name);
  const build = await hre.artifacts.getBuildInfo(`${artifact.sourceName}:${name}`);
  if (!build) throw new DeploymentBlocked("Missing compiler build-info; run npm run compile.");
  const output = build.output.contracts[artifact.sourceName][name].evm.deployedBytecode;
  let runtime = output.object;
  const references = Object.values(output.immutableReferences ?? {});
  if (name === "AgentPaymentGuard" && (!registryAddress || references.length !== 1)) throw new DeploymentBlocked("Unexpected vault immutable layout.");
  for (const slots of references) {
    if (!registryAddress) throw new DeploymentBlocked("Missing immutable registry address.");
    for (const slot of slots) {
      const value = hre.ethers.zeroPadValue(registryAddress, slot.length).slice(2);
      runtime = runtime.slice(0, slot.start * 2) + value + runtime.slice((slot.start + slot.length) * 2);
    }
  }
  return { runtime: `0x${runtime}`, build, artifact };
}

export async function preflight() {
  const target = networkTarget(hre.network.name, hre.network.config.chainId);
  const provider = hre.ethers.provider;
  const actualChainId = (await provider.getNetwork()).chainId;
  if (actualChainId !== BigInt(target.chainId)) throw new DeploymentBlocked("RPC chain ID does not match the selected deployment network.");
  console.log(`RPC verified: ${hre.network.name}, chain ${actualChainId}.`);
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new DeploymentBlocked("BLOCKED: PRIVATE_KEY is not configured. Set it only in the ignored root .env or a secure process environment; do not paste it into chat.");
  const address = await signer.getAddress();
  const nonce = await provider.getTransactionCount(address, "latest");
  if (await provider.getTransactionCount(address, "pending") !== nonce) throw new DeploymentBlocked("Deployer has pending transactions. Reconcile them before deployment.");
  const registryAddress = hre.ethers.getCreateAddress({ from: address, nonce });
  const guardAddress = hre.ethers.getCreateAddress({ from: address, nonce: nonce + 1 });
  const balance = await provider.getBalance(address);
  const fee = (await provider.getFeeData()).gasPrice;
  if (!fee) throw new DeploymentBlocked("RPC did not return a usable gas price.");
  const gasPrice = (fee * 120n + 99n) / 100n;
  const registryFactory = await hre.ethers.getContractFactory("AgentPolicyRegistry", signer);
  const guardFactory = await hre.ethers.getContractFactory("AgentPaymentGuard", signer);
  const registryTx = await registryFactory.getDeployTransaction();
  const guardTx = await guardFactory.getDeployTransaction(registryAddress);
  console.log(`Deployer: ${address}; balance: ${hre.ethers.formatEther(balance)} 0G.`);
  if (balance === 0n) throw new DeploymentBlocked("BLOCKED: deployer has no native 0G for gas on this network.");
  const plans = [];
  for (const [name, tx, predictedAddress, transactionNonce] of [
    ["AgentPolicyRegistry", registryTx, registryAddress, nonce],
    ["AgentPaymentGuard", guardTx, guardAddress, nonce + 1]
  ] as const) {
    const gas = await provider.estimateGas({ ...tx, from: address });
    const gasLimit = (gas * 120n + 99n) / 100n;
    const expected = await expectedRuntime(name, registryAddress);
    plans.push({ name, data: tx.data!, predictedAddress, nonce: transactionNonce, gasLimit, expected });
  }
  const maximumCost = plans.reduce((total, plan) => total + plan.gasLimit * gasPrice, 0n);
  const cap = hre.ethers.parseEther(process.env.OG_MAX_DEPLOYMENT_COST || "0.1");
  console.log(`Maximum gas cost at pinned limits: ${hre.ethers.formatEther(maximumCost)} 0G; configured cap: ${hre.ethers.formatEther(cap)} 0G.`);
  if (maximumCost > cap) throw new DeploymentBlocked("BLOCKED: deployment gas estimate exceeds OG_MAX_DEPLOYMENT_COST. No transaction sent.");
  if (balance < maximumCost) throw new DeploymentBlocked("BLOCKED: insufficient native 0G for both deployments at the pinned gas limits.");
  return { target, provider, signer, address, registryAddress, guardAddress, gasPrice, maximumCost, plans };
}
