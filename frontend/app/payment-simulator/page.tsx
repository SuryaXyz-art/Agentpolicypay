"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Play, ReceiptText, XCircle } from "lucide-react";
import { generateReceipt, saveReceipt } from "@/lib/receipt";
import { uploadReceiptToStorage } from "@/lib/storage0g";
import { agentPaymentGuardAbi, contractAddresses, hasPaymentGuardConfig } from "@/lib/contracts";
import { analyzePaymentRisk } from "@/lib/riskAnalyzer";
import { appendLocal, loadLocal, saveLocal } from "@/lib/localStore";
import { defaultAgents, defaultOwner, defaultServices, evaluatePaymentRequest, type Agent, type BlockedAttempt, type PaymentRequest, type Policy, type PolicyEngineResult, type Service } from "@/lib/policyEngine";
import { formatAddress, formatAmount } from "@/lib/format";

const unknownReceiver = "0x000000000000000000000000000000000000dEaD";

function fallbackPolicy(): Policy {
  return { policyId: "demo-default", name: "Demo Safety Policy", owner: defaultOwner, maxPayment: 5, maxPerTx: 5, dailyCap: 25, dailyLimit: 25, approvalThreshold: 3, receiptRequired: true, spentToday: 0, allowedReceivers: ["0x2222222222222222222222222222222222222222"], active: true, createdAt: new Date().toISOString(), source: "demo" };
}

function uniquePolicies(primary: Policy | null, policies: Policy[]) {
  const all = [primary, ...policies].filter(Boolean) as Policy[];
  const seen = new Set<string>();
  return all.filter((policy) => { const id = policy.policyId ?? policy.createdAt; if (seen.has(id)) return false; seen.add(id); return true; });
}

export default function PaymentSimulatorPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const policies = uniquePolicies(loadLocal<Policy | null>("app.policy", null), loadLocal<Policy[]>("app.policies", []));
  const demoPolicies = policies.length > 0 ? policies : [fallbackPolicy()];
  const [selectedPolicyId, setSelectedPolicyId] = useState(demoPolicies[0]?.policyId ?? "demo-default");
  const [agents] = useState(() => loadLocal<Agent[]>("app.agents", defaultAgents));
  const [services] = useState(() => loadLocal<Service[]>("app.services", defaultServices));
  const selectedPolicy = demoPolicies.find((policy) => (policy.policyId ?? policy.createdAt) === selectedPolicyId) ?? demoPolicies[0];
  const approvedAgents = agents.filter((agent) => agent.approved);
  const allowedServices = services.filter((service) => service.allowed || selectedPolicy.allowedReceivers.includes(service.address));
  const [request, setRequest] = useState<PaymentRequest>({ agentWallet: approvedAgents[0]?.wallet ?? agents[0]?.wallet ?? "", receiver: allowedServices[0]?.address ?? selectedPolicy.allowedReceivers[0] ?? "", amount: 2, memo: "Pay approved API usage for 0G inference" });
  const [result, setResult] = useState<PolicyEngineResult | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [flowBadge, setFlowBadge] = useState("Demo Mode");
  const selectedAgent = agents.find((agent) => agent.wallet.toLowerCase() === request.agentWallet.toLowerCase());
  const selectedService = services.find((service) => service.address.toLowerCase() === request.receiver.toLowerCase());
  const riskAnalysis = useMemo(() => analyzePaymentRisk(request, selectedPolicy, selectedAgent, selectedService), [request, selectedPolicy, selectedAgent, selectedService]);
  const explanation = !result ? "Choose a scenario or enter a request, then simulate the policy check." : !result.allowed ? "AgentPolicy Pay blocked this request because one or more safety checks failed." : result.riskLevel === "MEDIUM" ? "This request is allowed, but it deserves review because the amount or reason quality raised risk." : "This request is approved because the agent, receiver, amount, daily cap, and reason all passed cleanly.";

  function evaluate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setFlowError("");
    const nextResult = evaluatePaymentRequest({ userAddress: selectedPolicy.owner, agentAddress: request.agentWallet, receiverAddress: request.receiver, amount: request.amount, reason: request.memo, selectedPolicy, approvedAgents, allowedServices, dailySpent: selectedPolicy.spentToday });
    setResult(nextResult);
    if (!nextResult.allowed) appendLocal<BlockedAttempt>("app.blockedAttempts", { ...request, id: crypto.randomUUID(), reason: nextResult.blockedReasons[0] ?? "Payment blocked by policy.", createdAt: new Date().toISOString() });
  }

  function applyScenario(kind: "safe" | "overspend" | "unknown" | "badReason") {
    const agent = approvedAgents[0] ?? agents[0];
    const service = allowedServices[0] ?? services[0];
    const base = { agentWallet: agent?.wallet ?? "", receiver: service?.address ?? "", amount: 2, memo: "Pay approved API usage for 0G inference" };
    if (kind === "safe") setRequest(base);
    if (kind === "overspend") setRequest({ ...base, amount: (selectedPolicy.maxPerTx ?? selectedPolicy.maxPayment) + 10, memo: "Large autonomous purchase request" });
    if (kind === "unknown") setRequest({ ...base, receiver: unknownReceiver, memo: "Pay a new receiver for compute credits" });
    if (kind === "badReason") setRequest({ ...base, memo: "need money" });
    setResult(null);
  }

  async function generateApprovedReceipt() {
    if (!result?.allowed) return;
    setIsGeneratingReceipt(true);
    setFlowError("");
    let receipt = await generateReceipt({ userAddress: selectedPolicy.owner, agentAddress: request.agentWallet, receiverAddress: request.receiver, amount: request.amount, policyId: selectedPolicy.policyId, reason: request.memo }, result);
    try {
      const storage = await uploadReceiptToStorage(receipt);
      receipt = { ...receipt, storageUri: storage.uri, storageMode: storage.mode, localStatus: "STORAGE_UPLOADED" };
      setFlowBadge(storage.mode === "demo" ? "Demo Mode" : "0G Storage");
    } catch (error) {
      const storageError = error instanceof Error ? error.message : "Storage upload failed.";
      receipt = { ...receipt, localStatus: "ERROR", storageError };
      setFlowError(`Storage upload failed: ${storageError}`);
    }
    if (hasPaymentGuardConfig()) {
      try {
        if (!isConnected) throw new Error("Wallet not connected.");
        if (!contractAddresses.paymentGuard || !publicClient) throw new Error("Contract address missing.");
        const hash = await writeContractAsync({ address: contractAddresses.paymentGuard, abi: agentPaymentGuardAbi, functionName: "recordPayment", args: [selectedPolicy.owner as `0x${string}`, request.agentWallet as `0x${string}`, request.receiver as `0x${string}`, BigInt(Math.round(request.amount)), BigInt(Number(selectedPolicy.policyId?.replace("demo-", "") || 0)), receipt.storageUri, receipt.receiptHash as `0x${string}`] });
        const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = parseEventLogs({ abi: agentPaymentGuardAbi, eventName: "PaymentRecorded", logs: txReceipt.logs });
        receipt = { ...receipt, txHash: hash, onChainPaymentId: logs[0]?.args.paymentId?.toString(), localStatus: "ON_CHAIN_RECORDED" };
        setFlowBadge("On-chain recorded");
      } catch (error) {
        const contractError = error instanceof Error && error.message.includes("rejected") ? "Transaction rejected by wallet." : error instanceof Error ? error.message : "Transaction failed.";
        receipt = { ...receipt, contractError };
        setFlowError(contractError);
      }
    }
    saveReceipt(receipt);
    const updatedPolicy = { ...selectedPolicy, spentToday: selectedPolicy.spentToday + request.amount };
    saveLocal("app.policy", updatedPolicy);
    saveLocal("app.policies", demoPolicies.map((policy) => (policy.policyId ?? policy.createdAt) === selectedPolicyId ? updatedPolicy : policy));
    setIsGeneratingReceipt(false);
    router.push("/receipts");
  }

  return (
    <main className="page"><section className="section"><div className="stack"><div className="eyebrow">Payment simulator</div><h1 className="text-4xl font-black text-white">Agent payment request</h1><p className="lede">An AI agent requests a payment. AgentPolicy Pay checks the user policy and approves or blocks the request.</p></div>
      <div className="grid gap-3 md:grid-cols-4"><ScenarioButton label="Safe API payment" detail="Approved agent, allowed service, amount 2" onClick={() => applyScenario("safe")} /><ScenarioButton label="Overspend attempt" detail="Amount above max per transaction" onClick={() => applyScenario("overspend")} /><ScenarioButton label="Unknown receiver" detail="Receiver not in allowed services" onClick={() => applyScenario("unknown")} /><ScenarioButton label="Bad reason" detail="Vague reason: need money" onClick={() => applyScenario("badReason")} /></div>
      <div className="grid cols-2"><form className="card form" onSubmit={evaluate}><div className="row"><div className="grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua"><Play size={22} /></div><h2 className="text-2xl font-black text-white">Request details</h2></div><div className="field"><label>Select policy</label><select value={selectedPolicyId} onChange={(e) => { setSelectedPolicyId(e.target.value); setResult(null); }}>{demoPolicies.map((policy) => <option key={policy.policyId ?? policy.createdAt} value={policy.policyId ?? policy.createdAt}>{policy.name ?? policy.policyId ?? "Unnamed policy"}</option>)}</select></div><div className="field"><label>Select approved agent</label><select value={request.agentWallet} onChange={(e) => setRequest({ ...request, agentWallet: e.target.value })}>{agents.map((agent) => <option key={agent.id} value={agent.wallet}>{agent.name} {agent.approved ? "" : "(revoked)"}</option>)}</select></div><div className="field"><label>Select service receiver</label><select value={request.receiver} onChange={(e) => setRequest({ ...request, receiver: e.target.value })}>{services.map((service) => <option key={service.id} value={service.address}>{service.name} {service.allowed ? "" : "(blocked)"}</option>)}<option value={unknownReceiver}>Unknown receiver</option></select></div><div className="field"><label>Amount</label><input type="number" min="0" step="1" value={request.amount} onChange={(e) => setRequest({ ...request, amount: Number(e.target.value) })} /></div><div className="field"><label>Payment reason</label><input value={request.memo} onChange={(e) => setRequest({ ...request, memo: e.target.value })} /></div><button className="button" type="submit"><Play size={18} /> Simulate</button></form>
        <div className="stack"><div className="card stack"><div className="row">{result?.allowed ? <CheckCircle2 className="text-emerald-300" /> : result ? <XCircle className="text-red-300" /> : <AlertTriangle className="text-blue-300" />}<span className={result?.allowed ? "pill ok" : result ? "pill bad" : "pill"}>{result ? (result.allowed ? "Approved" : "Blocked") : "Waiting"}</span>{result && <RiskLevelBadge riskLevel={result.riskLevel} />}<span className="pill warn">Compute-ready</span><span className="pill">{flowBadge}</span></div><h2 className="text-2xl font-black text-white">Result panel</h2><p className="text-slate-300 leading-7">{explanation}</p>{flowError && <p className="text-sm text-red-300">{flowError}</p>}<RiskMeter score={riskAnalysis.riskScore} level={riskAnalysis.riskLevel} summary={riskAnalysis.summary} warnings={riskAnalysis.warnings} action={riskAnalysis.recommendedAction} /><div className="grid gap-3 rounded-lg border border-white/10 bg-night/60 p-4 text-sm text-slate-300"><p>Policy: <strong className="text-white">{selectedPolicy.name ?? selectedPolicy.policyId}</strong></p><p>Agent: <strong className="text-white">{selectedAgent?.name ?? formatAddress(request.agentWallet)}</strong></p><p>Receiver: <strong className="text-white">{selectedService?.name ?? formatAddress(request.receiver)}</strong></p><p>Amount: <strong className="text-white">{formatAmount(request.amount)}</strong></p></div></div>
          {result && <div className="card stack"><h3 className="text-xl font-black text-white">Policy checks</h3><div className="grid gap-2">{result.checks.map((check) => <div className="flex items-center justify-between rounded-md border border-white/10 bg-night/60 p-3" key={check.label}><span className="text-slate-300">{check.label}</span>{check.passed ? <CheckCircle2 className="text-emerald-300" size={18} /> : <XCircle className="text-red-300" size={18} />}</div>)}</div><div className="grid gap-3 md:grid-cols-2"><ReasonList title="Passed checks" items={result.reasons} empty="No checks passed yet." tone="ok" /><ReasonList title="Blocked reasons" items={result.blockedReasons} empty="No blocking reasons." tone="bad" /></div>{result.allowed && <button className="button" onClick={() => void generateApprovedReceipt()} disabled={isGeneratingReceipt}>{isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <ReceiptText size={18} />} Generate Receipt</button>}</div>}
        </div></div></section></main>
  );
}

function ScenarioButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) { return <button className="rounded-lg border border-white/10 bg-white/[0.06] p-4 text-left transition hover:border-aqua/40 hover:bg-white/[0.09]" type="button" onClick={onClick}><p className="font-black text-white">{label}</p><p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p></button>; }
function RiskLevelBadge({ riskLevel }: { riskLevel: "LOW" | "MEDIUM" | "HIGH" }) { const className = riskLevel === "LOW" ? "pill ok" : riskLevel === "MEDIUM" ? "pill warn" : "pill bad"; return <span className={className}>{riskLevel} risk</span>; }
function RiskMeter({ score, level, summary, warnings, action }: { score: number; level: string; summary: string; warnings: string[]; action: string }) { return <div className="rounded-lg border border-white/10 bg-night/60 p-4"><div className="mb-3 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-aqua to-violet" style={{ width: `${score}%` }} /></div><p className="text-sm font-bold text-white">AI risk score: {score}/100 · {level}</p><p className="mt-2 text-sm text-slate-400">{summary} Recommended action: {action}</p>{warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-200">- {warning}</p>)}</div>; }
function ReasonList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "ok" | "bad" }) { return <div className="rounded-lg border border-white/10 bg-night/60 p-4"><h4 className="font-black text-white">{title}</h4><div className="mt-3 grid gap-2">{items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : items.map((item) => <div className="flex gap-2 text-sm text-slate-300" key={item}>{tone === "ok" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={16} /> : <Circle className="mt-0.5 shrink-0 text-red-300" size={16} />}<span>{item}</span></div>)}</div></div>; }

