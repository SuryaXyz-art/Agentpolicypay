"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileCheck2, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { agentPolicyRegistryAbi, contractAddresses, hasRegistryConfig } from "@/lib/contracts";
import { formatAddress, formatAmount } from "@/lib/format";
import { loadLocal, saveLocal } from "@/lib/localStore";
import { defaultOwner, type Policy } from "@/lib/policyEngine";

type FormState = {
  policyName: string;
  maxPerTx: string;
  dailyLimit: string;
  approvalThreshold: string;
  receiptRequired: boolean;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type SuccessState = {
  policyId: string;
  mode: "contract" | "demo";
  txHash?: string;
};

const initialForm: FormState = {
  policyName: "Autonomous Ops Policy",
  maxPerTx: "25",
  dailyLimit: "100",
  approvalThreshold: "50",
  receiptRequired: true
};

function toPositiveNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : NaN;
}

function validateForm(form: FormState) {
  const errors: FieldErrors = {};
  const maxPerTx = toPositiveNumber(form.maxPerTx);
  const dailyLimit = toPositiveNumber(form.dailyLimit);
  const approvalThreshold = toPositiveNumber(form.approvalThreshold);

  if (!form.policyName.trim()) errors.policyName = "Give this policy a display name.";
  if (!Number.isFinite(maxPerTx) || maxPerTx <= 0) errors.maxPerTx = "Max spend must be greater than 0.";
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) errors.dailyLimit = "Daily limit must be greater than 0.";
  if (!Number.isFinite(approvalThreshold) || approvalThreshold < 0) errors.approvalThreshold = "Approval threshold cannot be negative.";
  if (Number.isFinite(maxPerTx) && Number.isFinite(dailyLimit) && maxPerTx > dailyLimit) {
    errors.maxPerTx = "Max spend per transaction cannot exceed the daily limit.";
  }
  if (Number.isFinite(approvalThreshold) && Number.isFinite(dailyLimit) && approvalThreshold > dailyLimit) {
    errors.approvalThreshold = "Approval threshold should not exceed the daily limit.";
  }

  return errors;
}

function amountToContractUnits(value: string) {
  return BigInt(Math.round(Number(value)));
}

export default function CreatePolicyPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const preview = useMemo(() => ({
    name: form.policyName.trim() || "Untitled policy",
    maxPerTx: toPositiveNumber(form.maxPerTx),
    dailyLimit: toPositiveNumber(form.dailyLimit),
    approvalThreshold: toPositiveNumber(form.approvalThreshold),
    receiptRequired: form.receiptRequired
  }), [form]);

  const contractReady = isConnected && hasRegistryConfig();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError("");
    setSuccess(null);
  }

  function saveDemoPolicy(policyId: string, txHash?: string, source: "contract" | "demo" = "demo") {
    const existingPolicy = loadLocal<Policy | null>("app.policy", null);
    const nextPolicy: Policy = {
      policyId,
      name: preview.name,
      owner: address ?? existingPolicy?.owner ?? defaultOwner,
      maxPayment: preview.maxPerTx,
      dailyCap: preview.dailyLimit,
      approvalThreshold: preview.approvalThreshold,
      receiptRequired: preview.receiptRequired,
      spentToday: existingPolicy?.spentToday ?? 0,
      allowedReceivers: existingPolicy?.allowedReceivers ?? [],
      active: true,
      createdAt: new Date().toISOString(),
      txHash,
      source
    };

    saveLocal("app.policy", nextPolicy);
    saveLocal("app.policies", [nextPolicy, ...loadLocal<Policy[]>("app.policies", []).filter((policy) => policy.policyId !== policyId)]);
  }

  async function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setSuccess(null);

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      if (contractReady && contractAddresses.registry && publicClient) {
        const hash = await writeContractAsync({
          address: contractAddresses.registry,
          abi: agentPolicyRegistryAbi,
          functionName: "createPolicy",
          args: [
            amountToContractUnits(form.maxPerTx),
            amountToContractUnits(form.dailyLimit),
            amountToContractUnits(form.approvalThreshold),
            form.receiptRequired
          ]
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = parseEventLogs({
          abi: agentPolicyRegistryAbi,
          eventName: "PolicyCreated",
          logs: receipt.logs
        });
        const policyId = logs[0]?.args.policyId?.toString() ?? "on-chain";
        saveDemoPolicy(policyId, hash, "contract");
        setSuccess({ policyId, txHash: hash, mode: "contract" });
      } else {
        const mockPolicyId = `demo-${Date.now()}`;
        saveDemoPolicy(mockPolicyId);
        setSuccess({ policyId: mockPolicyId, mode: "demo" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create policy.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="section">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="stack">
            <div className="eyebrow">Create policy</div>
            <h1 className="text-4xl font-black text-white">Configure spending controls</h1>
            <p className="lede">Set transaction limits, daily limits, approval thresholds, and receipt rules before agents can spend.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
            Wallet: <span className="font-mono text-aqua">{formatAddress(address ?? "")}</span>
          </div>
        </div>

        <div className="grid cols-2">
          <form className="card form" onSubmit={submitPolicy} noValidate>
            <div className="row">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua"><ShieldCheck size={22} /></div>
              <div>
                <h2 className="text-2xl font-black text-white">Policy form</h2>
                <p className="text-sm text-slate-400">Frontend name is display-only; numeric rules map to the registry contract.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="policyName">Policy name</label>
              <input id="policyName" value={form.policyName} onChange={(event) => updateField("policyName", event.target.value)} placeholder="Autonomous Ops Policy" />
              {errors.policyName && <p className="text-sm text-red-300">{errors.policyName}</p>}
            </div>

            <div className="field">
              <label htmlFor="maxPerTx">Max spend per transaction</label>
              <input id="maxPerTx" type="number" min="0" step="1" value={form.maxPerTx} onChange={(event) => updateField("maxPerTx", event.target.value)} />
              {errors.maxPerTx && <p className="text-sm text-red-300">{errors.maxPerTx}</p>}
            </div>

            <div className="field">
              <label htmlFor="dailyLimit">Daily spending limit</label>
              <input id="dailyLimit" type="number" min="0" step="1" value={form.dailyLimit} onChange={(event) => updateField("dailyLimit", event.target.value)} />
              {errors.dailyLimit && <p className="text-sm text-red-300">{errors.dailyLimit}</p>}
            </div>

            <div className="field">
              <label htmlFor="approvalThreshold">Approval threshold</label>
              <input id="approvalThreshold" type="number" min="0" step="1" value={form.approvalThreshold} onChange={(event) => updateField("approvalThreshold", event.target.value)} />
              {errors.approvalThreshold && <p className="text-sm text-red-300">{errors.approvalThreshold}</p>}
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-night/60 p-4">
              <span>
                <span className="block font-bold text-white">Receipt required</span>
                <span className="text-sm text-slate-400">Require a receipt URI and hash for approved payments.</span>
              </span>
              <input className="h-5 w-5 accent-white" type="checkbox" checked={form.receiptRequired} onChange={(event) => updateField("receiptRequired", event.target.checked)} />
            </label>

            {submitError && (
              <div className="row rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-red-200">
                <AlertCircle size={18} />
                <p className="text-sm">{submitError}</p>
              </div>
            )}

            <button className="button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <WalletCards size={18} />}
              {contractReady ? "Create on registry" : "Save demo policy"}
            </button>

            <p className="text-sm leading-6 text-slate-400">
              {contractReady
                ? "Wallet and registry address detected. This will submit a transaction."
                : "Demo mode is active because a connected wallet or registry address is missing."}
            </p>
          </form>

          <div className="stack">
            <div className="card stack">
              <div className="row">
                <div className="grid h-11 w-11 place-items-center rounded-md bg-violet/10 text-violet-300"><FileCheck2 size={22} /></div>
                <h2 className="text-2xl font-black text-white">Preview</h2>
              </div>
              <div className="rounded-lg border border-white/10 bg-night/60 p-4">
                <p className="text-sm text-slate-400">Policy name</p>
                <p className="mt-1 text-xl font-black text-white">{preview.name}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-night/60 p-4"><p className="text-sm text-slate-400">Max per tx</p><strong className="text-2xl text-white">{formatAmount(preview.maxPerTx)}</strong></div>
                <div className="rounded-lg border border-white/10 bg-night/60 p-4"><p className="text-sm text-slate-400">Daily limit</p><strong className="text-2xl text-white">{formatAmount(preview.dailyLimit)}</strong></div>
                <div className="rounded-lg border border-white/10 bg-night/60 p-4"><p className="text-sm text-slate-400">Approval threshold</p><strong className="text-2xl text-white">{formatAmount(preview.approvalThreshold)}</strong></div>
                <div className="rounded-lg border border-white/10 bg-night/60 p-4"><p className="text-sm text-slate-400">Receipt rule</p><strong className="text-2xl text-white">{preview.receiptRequired ? "Required" : "Optional"}</strong></div>
              </div>
            </div>

            {success && (
              <div className="card stack border-emerald-400/25 bg-emerald-400/10">
                <div className="row"><CheckCircle2 className="text-emerald-300" /><span className="pill ok">Policy created</span></div>
                <h3 className="text-xl font-black text-white">Policy ID: {success.policyId}</h3>
                <p className="text-sm text-slate-300">Saved through {success.mode === "contract" ? "AgentPolicyRegistry" : "local demo mode"}.</p>
                {success.txHash && <p className="code text-slate-400">Tx: {success.txHash}</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

