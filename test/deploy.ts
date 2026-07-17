import { expect } from "chai";
import hre from "hardhat";

describe("AgentPolicy Pay deployment", function () {
  it("deploys registry and guard with the registry address", async function () {
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();

    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();

    expect(await guard.policyRegistry()).to.equal(await registry.getAddress());
  });
});
