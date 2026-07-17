import hre from "hardhat";

async function main() {
  const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
  await registry.waitForDeployment();

  const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
  await guard.waitForDeployment();

  console.log("AgentPolicyRegistry:", await registry.getAddress());
  console.log("AgentPaymentGuard:", await guard.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
