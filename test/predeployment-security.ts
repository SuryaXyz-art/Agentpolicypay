import { expect } from "chai";
import hre from "hardhat";

describe("Mainnet pre-deployment security regressions", function () {
  async function fixture() {
    const [owner, agent, receiver, otherOwner] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await registry.createPolicy(10n, 20n, 5n, false);
    await registry.connect(otherOwner).createPolicy(10n, 20n, 5n, false);
    for (const [id, signer] of [[1n, owner], [2n, otherOwner]] as const) {
      await guard.connect(signer).approveAgent(id, agent.address);
      await guard.connect(signer).allowService(id, receiver.address);
      await guard.connect(signer).deposit(id, { value: 30n });
    }
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    async function intent(policyId = 1n, amount = 5n, root = hre.ethers.ZeroHash, deadline = expiry) {
      const args = [policyId, receiver.address, amount, deadline, hre.ethers.ZeroHash, hre.ethers.ZeroHash, root] as const;
      const hash = await guard.connect(agent).createIntent.staticCall(...args);
      await guard.connect(agent).createIntent(...args);
      return hash;
    }
    return { owner, agent, receiver, otherOwner, registry, guard, expiry, intent };
  }

  it("a policy owner's pause does not stop another policy's deposits or payments", async function () {
    const { guard, agent, otherOwner, intent } = await fixture();
    await guard.pause(1n);
    await guard.connect(otherOwner).deposit(2n, { value: 1n });
    const hash = await intent(2n);
    await guard.connect(agent).executeIntent(hash);
    expect(await guard.policyBalances(2n)).to.equal(26n);
  });

  it("another policy owner cannot clear a paused policy's circuit breaker", async function () {
    const { guard, otherOwner, agent, intent } = await fixture();
    const hash = await intent();
    await guard.pause(1n);
    await guard.connect(otherOwner).pause(2n);
    await guard.connect(otherOwner).unpause(2n);
    await expect(guard.connect(agent).executeIntent(hash)).to.be.revertedWithCustomError(guard, "PolicyPaused").withArgs(1n);
    await expect(guard.connect(otherOwner).unpause(1n)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
  });

  it("paused policies preview as ineligible and reject deposits and approvals", async function () {
    const { guard, agent, receiver, expiry, intent } = await fixture();
    const hash = await intent(1n, 6n);
    await guard.pause(1n);
    const preview = await guard.previewIntent(1n, agent.address, receiver.address, 1n, expiry);
    expect(preview.allowed).to.equal(false);
    expect(preview.reason).to.equal(hre.ethers.id("policy-paused"));
    await expect(guard.deposit(1n, { value: 1n })).to.be.revertedWithCustomError(guard, "PolicyPaused");
    await expect(guard.approveIntent(hash)).to.be.revertedWithCustomError(guard, "PolicyPaused");
  });

  it("paused policies permit cancellation and withdrawal of released funds", async function () {
    const { guard, owner, intent } = await fixture();
    const hash = await intent();
    await guard.pause(1n);
    await guard.cancelIntent(hash);
    await guard.withdraw(1n, 30n, owner.address);
    expect(await guard.policyBalances(1n)).to.equal(0n);
    expect(await guard.reservedBalances(1n)).to.equal(0n);
  });

  it("paused policies stop finalization without preventing it after unpause", async function () {
    const { guard, agent, intent } = await fixture();
    const hash = await intent();
    await guard.connect(agent).executeIntent(hash);
    await guard.pause(1n);
    await expect(guard.finalizeReceiptRoot(hash, hre.ethers.id("receipt"))).to.be.revertedWithCustomError(guard, "PolicyPaused");
    await guard.unpause(1n);
    await guard.finalizeReceiptRoot(hash, hre.ethers.id("receipt"));
  });

  it("pause transitions are owner-only, policy-scoped, and emit matching events", async function () {
    const { guard, owner, otherOwner } = await fixture();
    await expect(guard.connect(otherOwner).pause(1n)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    await expect(guard.pause(1n)).to.emit(guard, "PolicyPauseChanged").withArgs(1n, owner.address, true);
    expect(await guard.policyPaused(1n)).to.equal(true);
    expect(await guard.policyPaused(2n)).to.equal(false);
    await expect(guard.pause(1n)).to.be.revertedWithCustomError(guard, "PolicyPaused");
    await expect(guard.unpause(1n)).to.emit(guard, "PolicyPauseChanged").withArgs(1n, owner.address, false);
    await expect(guard.unpause(1n)).to.be.revertedWithCustomError(guard, "PolicyNotPaused");
  });

  it("execution rechecks a reduced maxPerTx and preserves funds and reservations on failure", async function () {
    const { guard, registry, agent, intent } = await fixture();
    const hash = await intent();
    await registry.updatePolicy(1n, 4n, 20n, 4n, false);
    await expect(guard.connect(agent).executeIntent(hash)).to.be.revertedWithCustomError(guard, "AmountExceedsMaxPerTx");
    expect(await guard.policyBalances(1n)).to.equal(30n);
    expect(await guard.reservedBalances(1n)).to.equal(5n);
    expect(await guard.spentToday(1n)).to.equal(0n);
    expect((await guard.getIntent(hash)).state).to.equal(2n);
  });

  it("execution rechecks a lowered threshold even for owner execution", async function () {
    const { guard, registry, agent, intent } = await fixture();
    const hash = await intent();
    await registry.updatePolicy(1n, 10n, 20n, 4n, false);
    await expect(guard.connect(agent).executeIntent(hash)).to.be.revertedWithCustomError(guard, "OwnerApprovalRequired");
    await expect(guard.executeIntent(hash)).to.be.revertedWithCustomError(guard, "OwnerApprovalRequired");
    await expect(guard.connect(agent).approveIntent(hash)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    await guard.approveIntent(hash);
    expect((await guard.getIntent(hash)).ownerApproved).to.equal(true);
    await guard.connect(agent).executeIntent(hash);
  });

  it("approval of a newly above-threshold READY intent is exact and one-time", async function () {
    const { guard, registry, agent, intent } = await fixture();
    const first = await intent();
    const second = await intent();
    await registry.updatePolicy(1n, 10n, 20n, 4n, false);
    await guard.approveIntent(first);
    await expect(guard.approveIntent(first)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
    await expect(guard.connect(agent).executeIntent(second)).to.be.revertedWithCustomError(guard, "OwnerApprovalRequired");
    await guard.connect(agent).executeIntent(first);
    await expect(guard.approveIntent(first)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
  });

  it("execution rechecks a newly required pre-receipt root", async function () {
    const { guard, registry, agent, intent } = await fixture();
    const hash = await intent();
    await registry.updatePolicy(1n, 10n, 20n, 5n, true);
    await expect(guard.connect(agent).executeIntent(hash)).to.be.revertedWithCustomError(guard, "ReceiptRootRequired");
    await guard.cancelIntent(hash);
    const replacement = await intent(1n, 5n, hre.ethers.id("pre-receipt"));
    await guard.connect(agent).executeIntent(replacement);
  });

  it("execution rechecks a reduced daily limit including other reservations", async function () {
    const { guard, registry, agent, intent } = await fixture();
    const first = await intent();
    const second = await intent();
    await registry.updatePolicy(1n, 5n, 5n, 5n, false);
    await expect(guard.connect(agent).executeIntent(first)).to.be.revertedWithCustomError(guard, "DailyLimitExceeded");
    await guard.cancelIntent(second);
    await guard.connect(agent).executeIntent(first);
    expect(await guard.spentToday(1n)).to.equal(5n);
  });

  it("deactivation blocks an already-ready intent but allows fund recovery", async function () {
    const { guard, registry, agent, owner, intent } = await fixture();
    const hash = await intent();
    await registry.deactivatePolicy(1n);
    await expect(guard.connect(agent).executeIntent(hash)).to.be.revertedWithCustomError(guard, "PolicyInactive");
    await guard.cancelIntent(hash);
    await guard.withdraw(1n, 30n, owner.address);
    expect(await guard.policyBalances(1n)).to.equal(0n);
  });

  it("a carried-over intent accounts against its execution day and releases its creation-day reservation", async function () {
    const { guard, agent, expiry, intent } = await fixture();
    const hash = await intent(1n, 5n, hre.ethers.ZeroHash, expiry + 172800n);
    const creationDay = (await guard.getIntent(hash)).reservedDay;
    await hre.ethers.provider.send("evm_increaseTime", [86400]);
    await hre.ethers.provider.send("evm_mine", []);
    const current = await intent(1n, 5n, hre.ethers.ZeroHash, expiry + 172800n);
    await guard.connect(agent).executeIntent(hash);
    expect(await guard.dailyReserved(1n, creationDay)).to.equal(0n);
    expect(await guard.spentToday(1n)).to.equal(5n);
    expect(await guard.reservedBalances(1n)).to.equal(5n);
    await guard.connect(agent).executeIntent(current);
    expect(await guard.spentToday(1n)).to.equal(10n);
  });
});
