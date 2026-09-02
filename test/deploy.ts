import { expect } from "chai";
import hre from "hardhat";

describe("AgentPaymentGuard escrow", function () {
  async function fixture() {
    const [owner, agent, receiver, stranger] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();
    await registry.createPolicy(2n * 10n ** 18n, 5n * 10n ** 18n, 1n * 10n ** 18n, true);
    await guard.approveAgent(1, agent.address);
    await guard.allowService(1, receiver.address);
    await guard.deposit(1, { value: 5n * 10n ** 18n });
    return { owner, agent, receiver, stranger, registry, guard };
  }

  async function createIntent(guard: any, agent: any, receiver: string, amount: bigint, expiryOffset = 3600n) {
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + expiryOffset;
    const args = [1, receiver, amount, expiry, hre.ethers.id("reason"), hre.ethers.id("decision"), hre.ethers.id("pre-receipt")];
    const intentHash = await guard.connect(agent).createIntent.staticCall(...args);
    await guard.connect(agent).createIntent(...args);
    return { intentHash, expiry };
  }

  it("deploys the registry-linked funded vault", async function () {
    const { registry, guard } = await fixture();
    expect(await guard.policyRegistry()).to.equal(await registry.getAddress());
    expect(await guard.policyBalances(1)).to.equal(5n * 10n ** 18n);
  });

  it("validates threshold <= maxPerTx <= dailyLimit", async function () {
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    await expect(registry.createPolicy(2, 5, 0, false)).to.be.revertedWithCustomError(registry, "InvalidPolicyLimits");
    await expect(registry.createPolicy(2, 5, 3, false)).to.be.revertedWithCustomError(registry, "InvalidPolicyLimits");
    await expect(registry.createPolicy(6, 5, 1, false)).to.be.revertedWithCustomError(registry, "InvalidPolicyLimits");
  });

  it("executes a low-value intent and pays the receiver from guarded balance", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    const before = await hre.ethers.provider.getBalance(receiver.address);
    const { intentHash } = await createIntent(guard, agent, receiver.address, 5n * 10n ** 17n);
    expect((await guard.getIntent(intentHash)).state).to.equal(2n);
    await guard.connect(agent).executeIntent(intentHash);
    expect(await hre.ethers.provider.getBalance(receiver.address)).to.equal(before + 5n * 10n ** 17n);
    expect((await guard.getIntent(intentHash)).state).to.equal(3n);
    expect(await guard.policyBalances(1)).to.equal(45n * 10n ** 17n);
    expect(await guard.spentToday(1)).to.equal(5n * 10n ** 17n);
  });

  it("requires exact owner approval above the threshold", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 15n * 10n ** 17n);
    expect((await guard.getIntent(intentHash)).state).to.equal(1n);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
    await guard.connect(owner).approveIntent(intentHash);
    await guard.connect(agent).executeIntent(intentHash);
    expect((await guard.getIntent(intentHash)).state).to.equal(3n);
  });

  it("allows only the policy owner to approve a high-value intent", async function () {
    const { guard, stranger, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 15n * 10n ** 17n);
    await expect(guard.connect(stranger).approveIntent(intentHash)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
  });

  it("blocks unapproved agents and disallowed receivers", async function () {
    const { guard, agent, stranger, receiver } = await fixture();
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    await expect(guard.connect(stranger).createIntent(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash)).to.be.revertedWithCustomError(guard, "NotApprovedAgent");
    await expect(guard.connect(stranger).approveAgent(1, stranger.address)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    await expect(guard.connect(agent).createIntent(1, stranger.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash)).to.be.revertedWithCustomError(guard, "ReceiverNotAllowed");
  });

  it("prevents replay and releases reservations on cancellation", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 5n * 10n ** 17n);
    expect((await guard.getBalance(1)).reserved).to.equal(5n * 10n ** 17n);
    await guard.connect(owner).cancelIntent(intentHash);
    expect((await guard.getIntent(intentHash)).state).to.equal(4n);
    expect((await guard.getBalance(1)).reserved).to.equal(0);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
  });

  it("uses a fresh nonce and hash for repeated otherwise-identical requests", async function () {
    const { guard, agent, receiver } = await fixture();
    const first = await createIntent(guard, agent, receiver.address, 1);
    const second = await createIntent(guard, agent, receiver.address, 1);
    expect(first.intentHash).to.not.equal(second.intentHash);
    expect((await guard.getIntent(first.intentHash)).nonce).to.equal(1);
    expect((await guard.getIntent(second.intentHash)).nonce).to.equal(2);
  });

  it("expires intents after their deadline", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 5n * 10n ** 17n, 2n);
    await hre.ethers.provider.send("evm_increaseTime", [3]);
    await hre.ethers.provider.send("evm_mine", []);
    await guard.expireIntent(intentHash);
    expect((await guard.getIntent(intentHash)).state).to.equal(5n);
  });

  it("does not allow withdrawal of reserved balance", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    await createIntent(guard, agent, receiver.address, 15n * 10n ** 17n);
    await expect(guard.connect(owner).withdraw(1, 4n * 10n ** 18n, owner.address)).to.be.revertedWithCustomError(guard, "InsufficientAvailableBalance");
  });

  it("rolls back state and balance when the receiver rejects the transfer", async function () {
    const { guard, agent } = await fixture();
    const rejecting = await hre.ethers.deployContract("RevertingReceiver");
    await rejecting.waitForDeployment();
    await guard.allowService(1, await rejecting.getAddress());
    const { intentHash } = await createIntent(guard, agent, await rejecting.getAddress(), 5n * 10n ** 17n);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "NativeTransferFailed");
    expect((await guard.getIntent(intentHash)).state).to.equal(2n);
    expect(await guard.policyBalances(1)).to.equal(5n * 10n ** 18n);
    expect(await guard.spentToday(1)).to.equal(0);
  });

  it("attaches a final receipt root only once after execution", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 5n * 10n ** 17n);
    await guard.connect(agent).executeIntent(intentHash);
    const root = hre.ethers.id("final-receipt");
    await guard.connect(owner).finalizeReceiptRoot(intentHash, root);
    expect((await guard.getIntent(intentHash)).finalReceiptRoot).to.equal(root);
    await expect(guard.connect(owner).finalizeReceiptRoot(intentHash, root)).to.be.revertedWithCustomError(guard, "ReceiptRootAlreadyFinalized");
  });

  it("creates a valid policy with the expected fields", async function () {
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    await registry.createPolicy(3, 9, 2, false);
    const policy = await registry.getPolicy(1);
    expect(policy.owner).to.equal((await hre.ethers.getSigners())[0].address);
    expect(policy.maxPerTx).to.equal(3);
    expect(policy.dailyLimit).to.equal(9);
    expect(policy.approvalThreshold).to.equal(2);
    expect(policy.active).to.equal(true);
  });

  it("rejects zero max and daily policy values", async function () {
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    await expect(registry.createPolicy(0, 1, 1, false)).to.be.revertedWithCustomError(registry, "InvalidPolicyLimits");
    await expect(registry.createPolicy(1, 0, 1, false)).to.be.revertedWithCustomError(registry, "InvalidPolicyLimits");
  });

  it("rejects reading a missing policy and deactivating an inactive policy", async function () {
    const { registry } = await fixture();
    await expect(registry.getPolicy(999)).to.be.revertedWithCustomError(registry, "PolicyNotFound");
    await registry.deactivatePolicy(1);
    await expect(registry.deactivatePolicy(1)).to.be.revertedWithCustomError(registry, "PolicyAlreadyInactive");
  });

  it("rejects non-owner policy updates and deactivation", async function () {
    const { registry, stranger } = await fixture();
    await expect(registry.connect(stranger).updatePolicy(1, 2, 5, 1, true)).to.be.revertedWithCustomError(registry, "NotPolicyOwner");
    await expect(registry.connect(stranger).deactivatePolicy(1)).to.be.revertedWithCustomError(registry, "NotPolicyOwner");
  });

  it("rejects intents for an inactive policy", async function () {
    const { registry, guard, agent, receiver } = await fixture();
    await registry.deactivatePolicy(1);
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.id("receipt"))).to.be.revertedWithCustomError(guard, "PolicyInactive");
  });

  it("approves and revokes agents per policy", async function () {
    const { guard, owner, agent } = await fixture();
    expect(await guard.approvedAgents(1, agent.address)).to.equal(true);
    await guard.revokeAgent(1, agent.address);
    expect(await guard.approvedAgents(1, agent.address)).to.equal(false);
    await guard.connect(owner).approveAgent(1, agent.address);
    expect(await guard.approvedAgents(1, agent.address)).to.equal(true);
  });

  it("allows and removes receivers per policy", async function () {
    const { guard, owner, receiver } = await fixture();
    expect(await guard.allowedServices(1, receiver.address)).to.equal(true);
    await guard.removeService(1, receiver.address);
    expect(await guard.allowedServices(1, receiver.address)).to.equal(false);
    await guard.connect(owner).allowService(1, receiver.address);
    expect(await guard.allowedServices(1, receiver.address)).to.equal(true);
  });

  it("rejects zero addresses for permissions and withdrawal", async function () {
    const { guard, owner } = await fixture();
    await expect(guard.approveAgent(1, hre.ethers.ZeroAddress)).to.be.revertedWithCustomError(guard, "ZeroAddress");
    await expect(guard.allowService(1, hre.ethers.ZeroAddress)).to.be.revertedWithCustomError(guard, "ZeroAddress");
    await expect(guard.withdraw(1, 1, hre.ethers.ZeroAddress)).to.be.revertedWithCustomError(guard, "ZeroAddress");
    expect(owner.address).to.not.equal(hre.ethers.ZeroAddress);
  });

  it("isolates permissions and balances between policies", async function () {
    const [owner, agent, receiver, otherOwner, otherAgent, otherReceiver] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();
    await registry.createPolicy(2, 4, 1, false);
    await registry.connect(otherOwner).createPolicy(2, 4, 1, false);
    await guard.approveAgent(1, agent.address);
    await guard.allowService(1, receiver.address);
    await guard.connect(otherOwner).approveAgent(2, otherAgent.address);
    await guard.connect(otherOwner).allowService(2, otherReceiver.address);
    await guard.deposit(1, { value: 2 });
    await guard.connect(otherOwner).deposit(2, { value: 3 });
    expect(await guard.approvedAgents(1, otherAgent.address)).to.equal(false);
    expect(await guard.approvedAgents(2, agent.address)).to.equal(false);
    expect(await guard.policyBalances(1)).to.equal(2);
    expect(await guard.policyBalances(2)).to.equal(3);
  });

  it("credits deposits only to the policy owner's balance", async function () {
    const { guard, stranger } = await fixture();
    await expect(guard.connect(stranger).deposit(1, { value: 1 })).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    expect(await guard.policyBalances(1)).to.equal(5n * 10n ** 18n);
  });

  it("allows only the policy owner to withdraw available balance", async function () {
    const { guard, owner, stranger } = await fixture();
    await expect(guard.connect(stranger).withdraw(1, 1, stranger.address)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    await guard.withdraw(1, 1, owner.address);
    expect(await guard.policyBalances(1)).to.equal(5n * 10n ** 18n - 1n);
  });

  it("cannot withdraw another owner's policy balance", async function () {
    const [owner, , , otherOwner, otherRecipient] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();
    await registry.createPolicy(2, 2, 1, false);
    await registry.connect(otherOwner).createPolicy(2, 2, 1, false);
    await guard.deposit(1, { value: 2 });
    await guard.connect(otherOwner).deposit(2, { value: 3 });
    await expect(guard.connect(otherOwner).withdraw(1, 1, otherRecipient.address)).to.be.revertedWithCustomError(guard, "NotPolicyOwner");
    expect(await guard.policyBalances(1)).to.equal(2); expect(owner.address).to.not.equal(otherOwner.address);
  });

  it("rejects insufficient balance at intent creation", async function () {
    const { guard, agent, receiver } = await fixture();
    await guard.withdraw(1, 45n * 10n ** 17n, (await hre.ethers.getSigners())[0].address);
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1n * 10n ** 18n, 9999999999n, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.id("receipt"))).to.be.revertedWithCustomError(guard, "InsufficientAvailableBalance");
  });

  it("emits creation and execution fields matching the intent", async function () {
    const { guard, agent, receiver } = await fixture();
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    const reason = hre.ethers.id("event-reason");
    const decision = hre.ethers.id("event-decision");
    const preRoot = hre.ethers.id("event-receipt");
    const hash = await guard.connect(agent).createIntent.staticCall(1, receiver.address, 1, expiry, reason, decision, preRoot);
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1, expiry, reason, decision, preRoot)).to.emit(guard, "PaymentIntentCreated").withArgs(hash, 1, 1, agent.address, receiver.address, 1, expiry, reason, decision, preRoot, 2);
    await expect(guard.connect(agent).executeIntent(hash)).to.emit(guard, "PaymentExecuted").withArgs(hash, 1, agent.address, receiver.address, 1, 1, preRoot);
    const intent = await guard.getIntent(hash);
    expect(intent.receiver).to.equal(receiver.address);
    expect(intent.amount).to.equal(1);
  });

  it("rejects an amount above maxPerTx", async function () {
    const { guard, agent, receiver } = await fixture();
    await expect(guard.connect(agent).createIntent(1, receiver.address, 2n * 10n ** 18n + 1n, 9999999999n, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.id("receipt"))).to.be.revertedWithCustomError(guard, "AmountExceedsMaxPerTx");
  });

  it("succeeds exactly at the daily limit and rejects one base unit over it", async function () {
    const [owner, agent, receiver] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();
    await registry.createPolicy(5, 5, 5, false);
    await guard.approveAgent(1, agent.address);
    await guard.allowService(1, receiver.address);
    await guard.deposit(1, { value: 5 });
    const first = await createIntent(guard, agent, receiver.address, 3n);
    await guard.connect(agent).executeIntent(first.intentHash);
    const second = await createIntent(guard, agent, receiver.address, 2n);
    await guard.connect(agent).executeIntent(second.intentHash);
    expect(await guard.spentToday(1)).to.equal(5);
    await guard.deposit(1, { value: 1 });
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash)).to.be.revertedWithCustomError(guard, "DailyLimitExceeded");
    expect(owner.address).to.not.equal(hre.ethers.ZeroAddress);
  });

  it("rejects an expired intent at execution", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1, 2n);
    await hre.ethers.provider.send("evm_increaseTime", [3]);
    await hre.ethers.provider.send("evm_mine", []);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "IntentExpired");
  });

  it("rejects an already executed intent", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1);
    await guard.connect(agent).executeIntent(intentHash);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
  });

  it("rejects execution by a caller unrelated to the intent", async function () {
    const { guard, agent, receiver, stranger } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1);
    await expect(guard.connect(stranger).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "NotIntentActor");
  });

  it("requires a pre-execution receipt root when the policy requires receipts", async function () {
    const { guard, agent, receiver } = await fixture();
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash)).to.be.revertedWithCustomError(guard, "ReceiptRootRequired");
  });

  it("does not consume daily spend when execution fails", async function () {
    const { guard, agent } = await fixture();
    const rejecting = await hre.ethers.deployContract("RevertingReceiver");
    await rejecting.waitForDeployment();
    await guard.allowService(1, await rejecting.getAddress());
    const { intentHash } = await createIntent(guard, agent, await rejecting.getAddress(), 1);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "NativeTransferFailed");
    expect(await guard.spentToday(1)).to.equal(0);
    expect((await guard.getIntent(intentHash)).state).to.equal(2n);
  });

  it("blocks a revoked agent from executing a previously ready intent", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1);
    await guard.revokeAgent(1, agent.address);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "NotApprovedAgent");
  });

  it("blocks a receiver removed after intent creation", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1);
    await guard.removeService(1, receiver.address);
    await expect(guard.connect(agent).executeIntent(intentHash)).to.be.revertedWithCustomError(guard, "ReceiverNotAllowed");
  });

  it("keeps daily spend isolated across policies", async function () {
    const [owner, agent, receiver] = await hre.ethers.getSigners();
    const registry = await hre.ethers.deployContract("AgentPolicyRegistry");
    await registry.waitForDeployment();
    const guard = await hre.ethers.deployContract("AgentPaymentGuard", [await registry.getAddress()]);
    await guard.waitForDeployment();
    await registry.createPolicy(2, 2, 2, false);
    await registry.createPolicy(2, 2, 2, false);
    await guard.approveAgent(1, agent.address); await guard.allowService(1, receiver.address);
    await guard.approveAgent(2, agent.address); await guard.allowService(2, receiver.address);
    await guard.deposit(1, { value: 1 }); await guard.deposit(2, { value: 1 });
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    const h1 = await guard.connect(agent).createIntent.staticCall(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash);
    await guard.connect(agent).createIntent(1, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash); await guard.connect(agent).executeIntent(h1);
    const h2 = await guard.connect(agent).createIntent.staticCall(2, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash);
    await guard.connect(agent).createIntent(2, receiver.address, 1, expiry, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash); await guard.connect(agent).executeIntent(h2);
    expect(await guard.spentToday(1)).to.equal(1); expect(await guard.spentToday(2)).to.equal(1); expect(owner.address).to.not.equal(hre.ethers.ZeroAddress);
  });

  it("handles day rollover with a fresh daily counter", async function () {
    const { guard, agent, receiver } = await fixture();
    const first = await createIntent(guard, agent, receiver.address, 1);
    await guard.connect(agent).executeIntent(first.intentHash);
    const previousDay = await guard.spentToday(1);
    await hre.ethers.provider.send("evm_increaseTime", [86400]); await hre.ethers.provider.send("evm_mine", []);
    const second = await createIntent(guard, agent, receiver.address, 1);
    await guard.connect(agent).executeIntent(second.intentHash);
    expect(previousDay).to.equal(1); expect(await guard.spentToday(1)).to.equal(1);
  });

  it("rejects reentrancy from a receiver during payment", async function () {
    const { guard, agent } = await fixture();
    const reentrant = await hre.ethers.deployContract("ReentrantReceiver", [await guard.getAddress(), hre.ethers.ZeroHash]);
    await reentrant.waitForDeployment();
    await guard.allowService(1, await reentrant.getAddress());
    const { intentHash } = await createIntent(guard, agent, await reentrant.getAddress(), 1);
    await reentrant.setIntentHash(intentHash);
    await guard.connect(agent).executeIntent(intentHash);
    expect(await reentrant.attempted()).to.equal(true);
    expect(await reentrant.succeeded()).to.equal(false);
  });

  it("pauses mutating vault actions without changing read state", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    await guard.pause(1);
    expect(await guard.policyPaused(1)).to.equal(true);
    await expect(guard.connect(agent).createIntent(1, receiver.address, 1, 9999999999n, hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.id("receipt"))).to.be.revertedWithCustomError(guard, "PolicyPaused");
    await guard.unpause(1);
    expect(await guard.policyPaused(1)).to.equal(false);
    expect(owner.address).to.not.equal(hre.ethers.ZeroAddress);
  });

  it("returns deterministic preview reasons for invalid and valid requests", async function () {
    const { guard, agent, receiver, stranger } = await fixture();
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    const check = async (agentAddress: string, receiverAddress: string, amount: bigint, deadline: bigint) => (await guard.previewIntent(1, agentAddress, receiverAddress, amount, deadline)).reason;
    expect(await check(hre.ethers.ZeroAddress, receiver.address, 1n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("zero-address")));
    expect(await check(stranger.address, receiver.address, 1n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("agent-not-approved")));
    expect(await check(agent.address, stranger.address, 1n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("receiver-not-allowed")));
    expect(await check(agent.address, receiver.address, 0n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("amount-zero")));
    expect(await check(agent.address, receiver.address, 3n * 10n ** 18n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("max-per-tx")));
    expect(await check(agent.address, receiver.address, 1n, BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp))).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("expired")));
    const lowPreview = await guard.previewIntent(1, agent.address, receiver.address, 1n, expiry);
    expect(lowPreview.allowed).to.equal(true);
    expect(lowPreview.needsApproval).to.equal(false);
    const highPreview = await guard.previewIntent(1, agent.address, receiver.address, 15n * 10n ** 17n, expiry);
    expect(highPreview.allowed).to.equal(true);
    expect(highPreview.needsApproval).to.equal(true);
    await guard.withdraw(1, 45n * 10n ** 17n, (await hre.ethers.getSigners())[0].address);
    expect(await check(agent.address, receiver.address, 1n * 10n ** 18n, expiry)).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("insufficient-balance")));
  });

  it("returns a daily-limit preview reason when existing spend leaves insufficient allowance", async function () {
    const { guard, owner, agent, receiver } = await fixture();
    const first = await createIntent(guard, agent, receiver.address, 2n * 10n ** 18n);
    await guard.connect(owner).approveIntent(first.intentHash);
    await guard.connect(agent).executeIntent(first.intentHash);
    const second = await createIntent(guard, agent, receiver.address, 2n * 10n ** 18n);
    await guard.connect(owner).approveIntent(second.intentHash);
    await guard.connect(agent).executeIntent(second.intentHash);
    await guard.deposit(1, { value: 2n * 10n ** 18n });
    const expiry = BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
    const preview = await guard.previewIntent(1, agent.address, receiver.address, 2n * 10n ** 18n, expiry);
    expect(preview.allowed).to.equal(false);
    expect(preview.reason).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("daily-limit")));
  });

  it("updates a policy only with valid limits", async function () {
    const { registry } = await fixture();
    await registry.updatePolicy(1, 3n * 10n ** 18n, 6n * 10n ** 18n, 2n * 10n ** 18n, false);
    const policy = await registry.getPolicy(1);
    expect(policy.maxPerTx).to.equal(3n * 10n ** 18n);
    expect(policy.dailyLimit).to.equal(6n * 10n ** 18n);
    expect(policy.receiptRequired).to.equal(false);
  });

  it("returns executed payment details and rejects payment reads before execution", async function () {
    const { guard, agent, receiver } = await fixture();
    const { intentHash } = await createIntent(guard, agent, receiver.address, 1);
    await expect(guard.getPayment(intentHash)).to.be.revertedWithCustomError(guard, "InvalidIntentState");
    await guard.connect(agent).executeIntent(intentHash);
    const payment = await guard.getPayment(intentHash);
    expect(payment.receiver).to.equal(receiver.address);
    expect(payment.amount).to.equal(1);
    expect(payment.executedAt).to.be.greaterThan(0);
  });

  it("rejects untagged direct native transfers", async function () {
    const { guard, owner } = await fixture();
    await expect(owner.sendTransaction({ to: await guard.getAddress(), value: 1 })).to.be.revertedWithCustomError(guard, "DirectTransferNotSupported");
  });
});
