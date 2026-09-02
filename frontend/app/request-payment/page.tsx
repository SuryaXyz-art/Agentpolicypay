"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { isAddress, keccak256, parseEther, toBytes } from "viem";
import { parseEventLogs } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { agentPaymentGuardAbi, agentPolicyRegistryAbi, contractAddresses, deploymentStatus, hasPaymentGuardConfig, hasRegistryConfig } from "@/lib/contracts";
import { ACTIVE_CHAIN_ID, ACTIVE_NETWORK_NAME } from "@/lib/network";
import { formatAddress, formatNativeAmount } from "@/lib/format";
import { createOnChainReceipt, saveReceipt } from "@/lib/receipt";
import { canonicalJson, uploadJsonToStorage } from "@/lib/storage0g";

type ChainPolicy = {
  owner: `0x${string}`;
  maxPerTx: bigint;
  dailyLimit: bigint;
  approvalThreshold: bigint;
  receiptRequired: boolean;
  active: boolean;
};

type IntentStage = "IDLE" | "UPLOADING_PRE_RECEIPT" | "CREATING" | "PENDING_APPROVAL" | "READY" | "EXECUTING" | "FINALIZING" | "COMPLETE" | "ERROR";

const stateNames = ["CREATED", "PENDING_APPROVAL", "READY", "EXECUTED", "CANCELLED", "EXPIRED"] as const;

export default function RequestPaymentPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [policyId, setPolicyId] = useState("1");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("0.001");
  const [expiryMinutes, setExpiryMinutes] = useState("30");
  const [reason, setReason] = useState("Pay the approved research service for the requested market-data summary.");
  const [policy, setPolicy] = useState<ChainPolicy | null>(null);
  const [balance, setBalance] = useState<{ available: bigint; reserved: bigint } | null>(null);
  const [spentToday, setSpentToday] = useState<bigint | null>(null);
  const [intentHash, setIntentHash] = useState<`0x${string}` | null>(null);
  const [intentAgent, setIntentAgent] = useState<`0x${string}` | null>(null);
  const [preRoot, setPreRoot] = useState<`0x${string}` | null>(null);
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | null>(null);
  const [finalRoot, setFinalRoot] = useState<`0x${string}` | null>(null);
  const [stage, setStage] = useState<IntentStage>("IDLE");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const deploymentReady = hasRegistryConfig() && hasPaymentGuardConfig();
  const liveReady = isConnected && chainId === ACTIVE_CHAIN_ID && deploymentReady && Boolean(publicClient);
  const policyNumber = BigInt(policyId || "0");
  const amountBaseUnits = useMemo(() => {
    try {
      return parseEther(amount.trim());
    } catch {
      return null;
    }
  }, [amount]);
  const currentState = stage === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : stage === "READY" ? "READY" : stage === "COMPLETE" ? "EXECUTED" : "IDLE";

  useEffect(() => {
    let cancelled = false;
    async function loadChainState() {
      if (!liveReady || !contractAddresses.paymentGuard || !contractAddresses.registry || !publicClient || policyNumber === BigInt(0)) return;
      try {
        const [policyData, balanceData, spent, linkedRegistry] = await Promise.all([
          publicClient.readContract({ address: contractAddresses.registry, abi: agentPolicyRegistryAbi, functionName: "getPolicy", args: [policyNumber] }),
          publicClient.readContract({ address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "getBalance", args: [policyNumber] }),
          publicClient.readContract({ address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "spentToday", args: [policyNumber] }),
          publicClient.readContract({ address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "policyRegistry" })
        ]);
        if (cancelled) return;
        if ((linkedRegistry as string).toLowerCase() !== contractAddresses.registry.toLowerCase()) throw new Error("Configured registry does not match the registry linked into the guard.");
        const nextPolicy = policyData as unknown as ChainPolicy;
        const nextBalance = balanceData as unknown as readonly [bigint, bigint];
        setPolicy(nextPolicy);
        setBalance({ available: nextBalance[0], reserved: nextBalance[1] });
        setSpentToday(spent as bigint);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to read the current policy from the guard.");
      }
    }
    void loadChainState();
    return () => { cancelled = true; };
  }, [liveReady, policyNumber, publicClient]);

  function resetMessages() {
    setError("");
    setMessage("");
  }

  async function createIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    if (!liveReady || !contractAddresses.paymentGuard || !contractAddresses.registry || !publicClient || !address) {
      setError(`Live payments require a wallet on ${ACTIVE_NETWORK_NAME} and a current Wave 3 guard deployment. The recorded legacy guard is intentionally rejected.`);
      setStage("ERROR");
      return;
    }
    if (!isAddress(receiver)) {
      setError("Enter the exact allowlisted receiver address.");
      setStage("ERROR");
      return;
    }
    if (!amountBaseUnits || amountBaseUnits === BigInt(0)) {
      setError("Enter a positive native 0G amount. Contract units use 18 decimals.");
      setStage("ERROR");
      return;
    }
    const minutes = Number.parseInt(expiryMinutes, 10);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError("Expiry must be a positive number of minutes.");
      setStage("ERROR");
      return;
    }

    try {
      const expiry = BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
      const reasonHash = keccak256(toBytes(reason.trim()));
      const linkedRegistry = await publicClient.readContract({ address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "policyRegistry" });
      if ((linkedRegistry as string).toLowerCase() !== contractAddresses.registry.toLowerCase()) throw new Error("Configured registry does not match the registry linked into the guard.");
      const previewResult = await publicClient.readContract({
        address: contractAddresses.paymentGuard,
        abi: agentPaymentGuardAbi,
        functionName: "previewIntent",
        args: [policyNumber, address, receiver, amountBaseUnits, expiry]
      }) as readonly [boolean, boolean, `0x${string}`];
      if (!previewResult[0]) throw new Error(`The vault rejected this intent during preview (${previewResult[2]}). Check policy, permissions, balance, and daily limit.`);

      const preReceiptPayload = {
        schema: "apolo-mind/wave3/pre-payment/v1",
        chainId: ACTIVE_CHAIN_ID,
        guard: contractAddresses.paymentGuard,
        policyId,
        agent: address,
        receiver,
        amountBaseUnits: amountBaseUnits.toString(),
        expiry: expiry.toString(),
        reason,
        reasonHash,
        advisory: { source: "client-preview", needsOwnerApproval: previewResult[1], authorization: "contract-only" },
        createdAt: new Date().toISOString()
      };
      setStage("UPLOADING_PRE_RECEIPT");
      const preStorage = await uploadJsonToStorage(preReceiptPayload);
      const decisionRoot = keccak256(toBytes(canonicalJson(preReceiptPayload.advisory)));
      setPreRoot(preStorage.rootHash);
      setStage("CREATING");
      const hash = await writeContractAsync({
        chainId: ACTIVE_CHAIN_ID,
        account: address,
        address: contractAddresses.paymentGuard,
        abi: agentPaymentGuardAbi,
        functionName: "createIntent",
        args: [policyNumber, receiver, amountBaseUnits, expiry, reasonHash, decisionRoot, preStorage.rootHash]
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Intent creation reverted.");
      const logs = parseEventLogs({ abi: agentPaymentGuardAbi, eventName: "PaymentIntentCreated", logs: receipt.logs.filter(log => log.address.toLowerCase() === contractAddresses.paymentGuard!.toLowerCase()), strict: false });
      const created = logs[0];
      if (!created?.args.intentHash) throw new Error("Intent transaction succeeded but PaymentIntentCreated was not found.");
      const nextIntentHash = created.args.intentHash as `0x${string}`;
      setIntentHash(nextIntentHash);
      setIntentAgent(address);
      setStage(previewResult[1] ? "PENDING_APPROVAL" : "READY");
      setMessage(previewResult[1] ? "Intent created and reserved. Switch to the policy owner wallet to approve it." : "Intent created and reserved. It is ready for guarded execution.");
    } catch (createError) {
      setStage("ERROR");
      setError(createError instanceof Error ? createError.message : "Unable to create the payment intent.");
    }
  }

  async function approveIntent() {
    if (!intentHash || !contractAddresses.paymentGuard || !publicClient) return;
    resetMessages();
    try {
      const hash = await writeContractAsync({ chainId: ACTIVE_CHAIN_ID, account: address, address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "approveIntent", args: [intentHash] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Owner approval reverted.");
      setStage("READY");
      setMessage("Owner approval recorded on-chain. The intent can now be executed by the agent or owner.");
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Owner approval failed.");
    }
  }

  async function executeAndFinalize() {
    if (!intentHash || !intentAgent || !preRoot || !contractAddresses.paymentGuard || !publicClient || !address || !amountBaseUnits || !policy) return;
    resetMessages();
    try {
      setStage("EXECUTING");
      const hash = await writeContractAsync({ chainId: ACTIVE_CHAIN_ID, account: address, address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "executeIntent", args: [intentHash] });
      const executedReceipt = await publicClient.waitForTransactionReceipt({ hash });
      if (executedReceipt.status !== "success") throw new Error("Vault execution reverted; no payment was completed.");
      setPaymentTxHash(hash);

      const finalReceiptPayload = {
        schema: "apolo-mind/wave3/payment-receipt/v1",
        chainId: ACTIVE_CHAIN_ID,
        guard: contractAddresses.paymentGuard,
        policyId,
        intentHash,
        paymentTxHash: hash,
        owner: policy.owner,
        agent: intentAgent,
        receiver,
        amountBaseUnits: amountBaseUnits.toString(),
        preReceiptRoot: preRoot,
        reason,
        settledAt: new Date().toISOString(),
        authorization: "guarded-vault-transfer"
      };
      setStage("FINALIZING");
      const finalStorage = await uploadJsonToStorage(finalReceiptPayload);
      const finalizeHash = await writeContractAsync({ chainId: ACTIVE_CHAIN_ID, account: address, address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "finalizeReceiptRoot", args: [intentHash, finalStorage.rootHash] });
      const finalizedReceipt = await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
      if (finalizedReceipt.status !== "success") throw new Error("Payment settled but receipt-root finalization reverted.");
      const nextReceipt = await createOnChainReceipt({
        owner: policy.owner,
        agent: intentAgent,
        receiver,
        amount: Number.parseFloat(amount),
        amountBaseUnits: amountBaseUnits.toString(),
        policyId,
        intentHash,
        paymentTxHash: hash,
        preReceiptRoot: preRoot,
        finalReceiptRoot: finalStorage.rootHash,
        storageRoot: finalStorage.rootHash,
        storageTxHash: finalStorage.txHash,
        reason,
        chainId: ACTIVE_CHAIN_ID
      });
      saveReceipt(nextReceipt);
      setFinalRoot(finalStorage.rootHash);
      setStage("COMPLETE");
      setMessage("Payment executed by the guarded vault and its final receipt root was attached on-chain.");
    } catch (executionError) {
      setStage("ERROR");
      setError(executionError instanceof Error ? executionError.message : "Execution or receipt finalization failed. Check the intent on-chain before retrying.");
    }
  }

  const canApprove = Boolean(intentHash && stage === "PENDING_APPROVAL");
  const canExecute = Boolean(intentHash && (stage === "READY" || stage === "PENDING_APPROVAL" && policy?.owner.toLowerCase() === address?.toLowerCase()));
  const deploymentState = deploymentStatus();
  const statusText = deploymentState === "legacy"
    ? "Legacy deployment detected"
    : !deploymentReady
      ? "Mainnet contracts not configured"
      : !isConnected
        ? "Connect wallet to begin"
        : chainId !== ACTIVE_CHAIN_ID
          ? `Switch to ${ACTIVE_NETWORK_NAME}`
          : !publicClient
            ? "RPC connection unavailable"
            : currentState;
  const readinessHelp = deploymentState === "legacy" || !deploymentReady
    ? "Configure the verified Wave 3 registry and escrow addresses. The legacy Galileo-v1 addresses are intentionally rejected."
    : !isConnected
      ? `The verified Aristotle contracts are configured. Connect an agent wallet on ${ACTIVE_NETWORK_NAME} to load policy and vault state.`
      : chainId !== ACTIVE_CHAIN_ID
        ? `Switch the connected wallet to ${ACTIVE_NETWORK_NAME} (chain ${ACTIVE_CHAIN_ID}).`
        : "Check the configured Aristotle RPC connection before continuing.";

  return (
    <main className="page">
      <section className="section">
        <div className="stack">
          <div className="eyebrow">Guarded payment</div>
          <h1 className="text-4xl font-black text-white">Request and prove a native 0G payment</h1>
          <p className="lede">The connected agent can only create an intent. The vault checks policy and balance, transfers native 0G to the allowlisted receiver, and binds the receipt root to that exact intent.</p>
        </div>

        {!liveReady && <div className="row rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-amber-100"><AlertCircle size={18} /><p className="text-sm leading-6"><strong>{statusText}.</strong> {readinessHelp}</p></div>}
        {message && <div className="row rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-100"><CheckCircle2 size={18} /><p className="text-sm leading-6">{message}</p></div>}
        {error && <div className="row rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-red-100"><AlertCircle size={18} /><p className="text-sm leading-6 break-words">{error}</p></div>}

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <form className="card form" onSubmit={createIntent}>
            <div className="row"><div className="grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua"><WalletCards size={22} /></div><div><h2 className="text-2xl font-black text-white">Create payment intent</h2><p className="text-sm text-slate-400">The connected wallet is the agent. No alternate policy owner can be selected.</p></div></div>
            <div className="field"><label>Policy ID</label><input inputMode="numeric" value={policyId} onChange={(event) => setPolicyId(event.target.value.replace(/[^0-9]/g, ""))} /></div>
            <div className="field"><label>Allowlisted receiver address</label><input className="font-mono" value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="0x..." /></div>
            <div className="field"><label>Amount in native 0G</label><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /><p className="text-xs text-slate-500">Parsed as an 18-decimal string; no JavaScript number is sent to the contract.</p></div>
            <div className="field"><label>Expiry in minutes</label><input inputMode="numeric" value={expiryMinutes} onChange={(event) => setExpiryMinutes(event.target.value.replace(/[^0-9]/g, ""))} /></div>
            <div className="field"><label>Payment reason</label><textarea className="min-h-28 rounded-md border border-white/15 bg-black/55 px-3 py-3 text-white outline-none transition focus:border-aqua" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            <button className="button" type="submit" disabled={stage === "UPLOADING_PRE_RECEIPT" || stage === "CREATING"}>{stage === "UPLOADING_PRE_RECEIPT" || stage === "CREATING" ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Create guarded intent</button>
          </form>

          <section className="stack">
            <div className="card stack">
              <div className="row"><Clock3 className="text-aqua" /><h2 className="text-2xl font-black text-white">On-chain state</h2><span className="pill">{statusText}</span></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Connected agent" value={formatAddress(address ?? "")} />
                <Info label="Policy owner" value={formatAddress(policy?.owner ?? "")} />
                <Info label="Available balance" value={balance ? formatNativeAmount(balance.available) : "Not loaded"} />
                <Info label="Reserved balance" value={balance ? formatNativeAmount(balance.reserved) : "Not loaded"} />
                <Info label="Spent today" value={spentToday !== null ? formatNativeAmount(spentToday) : "Not loaded"} />
                <Info label="Policy max per tx" value={policy ? formatNativeAmount(policy.maxPerTx) : "Not loaded"} />
              </div>
              {policy && <p className="text-sm text-slate-400">Approval threshold: {formatNativeAmount(policy.approvalThreshold)} · Daily limit: {formatNativeAmount(policy.dailyLimit)} · Receipt required: {policy.receiptRequired ? "yes" : "no"}</p>}
            </div>

            <div className="card stack">
              <div className="row"><ReceiptText className="text-aqua" /><h2 className="text-2xl font-black text-white">Intent and receipt proof</h2></div>
              <Info label="Intent hash" value={intentHash ?? "Created after the pre-receipt upload"} mono />
              <Info label="Pre-receipt root" value={preRoot ?? "Uploaded before intent creation"} mono />
              <Info label="Payment transaction" value={paymentTxHash ?? "Available after successful vault execution"} mono />
              <Info label="Final 0G Storage root" value={finalRoot ?? "Attached after final receipt upload"} mono />
              <div className="actions">
                {canApprove && <button className="button secondary" type="button" onClick={() => void approveIntent()}><ShieldCheck size={18} /> Owner approve</button>}
                {canExecute && <button className="button" type="button" onClick={() => void executeAndFinalize()} disabled={stage === "EXECUTING" || stage === "FINALIZING"}>{stage === "EXECUTING" || stage === "FINALIZING" ? <Loader2 className="animate-spin" size={18} /> : <WalletCards size={18} />} Execute and finalize proof</button>}
              </div>
              {stage === "COMPLETE" && <p className="text-sm text-emerald-200">Receipt saved locally for display, but its authority is the {ACTIVE_NETWORK_NAME} PaymentExecuted event plus the on-chain final root.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><p className="text-sm text-slate-500">{label}</p><p className={`${mono ? "code break-all" : "font-bold"} mt-2 text-slate-200`}>{value}</p></div>;
}
