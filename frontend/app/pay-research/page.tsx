"use client";

import { FormEvent, useState } from "react";
import { BrainCircuit, CheckCircle2, Database, FileText, Loader2, ShieldCheck, WalletCards } from "lucide-react";

type Analysis = {
  provider: string;
  model: string;
  summary: string;
  paymentRecommendation: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  policyNotes: string[];
  warning?: string;
};

export default function PayResearchPage() {
  const [form, setForm] = useState({
    topic: "Market data summary for autonomous agent payments",
    service: "MarketDataAPI",
    budget: "2",
    policy: "Demo policy: maxPerTx 5, dailyLimit 25, approvalThreshold 3",
    agent: "ResearchBot"
  });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function runResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/pay-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, budget: Number(form.budget) })
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to run research analysis.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="section">
        <div className="stack">
          <div className="eyebrow">Pay Research</div>
          <h1 className="text-4xl font-black text-white">Research payment review</h1>
          <p className="lede">Use Nous to summarize a research task, check policy fit, and prepare a safer payment decision.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="card form">
            <div className="row"><BrainCircuit className="text-aqua" /><h2 className="text-2xl font-black text-white">Research request</h2></div>
            <form className="form" onSubmit={runResearch}>
              <div className="field"><label>Research topic</label><input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /></div>
              <div className="field"><label>Service receiver</label><input value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} /></div>
              <div className="field"><label>Budget in 0G</label><input type="number" min="0" step="1" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></div>
              <div className="field"><label>Policy context</label><input value={form.policy} onChange={(event) => setForm({ ...form, policy: event.target.value })} /></div>
              <div className="field"><label>Agent</label><input value={form.agent} onChange={(event) => setForm({ ...form, agent: event.target.value })} /></div>
              <button className="button" type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />} Analyze with Nous</button>
              {error && <p className="text-sm text-red-200">{error}</p>}
            </form>
          </section>

          <section className="stack">
            <FeatureSection icon={ShieldCheck} title="Policy Fit" body="Checks whether the research budget fits the current spending rules." />
            <FeatureSection icon={Database} title="Service Context" body="Reviews whether the receiver looks like a trusted research service." />
            <FeatureSection icon={WalletCards} title="Payment Recommendation" body="Produces a plain-English approve or review recommendation." />
            <FeatureSection icon={FileText} title="Receipt Readiness" body="Explains what should be captured after approval." />
          </section>
        </div>

        <section className="card stack">
          <div className="row"><CheckCircle2 className="text-aqua" /><h2 className="text-2xl font-black text-white">Nous analysis result</h2>{analysis && <span className="pill">{analysis.provider}</span>}</div>
          {!analysis && <p className="muted">Run the research request to generate a model-assisted payment review.</p>}
          {analysis && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/40 p-4"><p className="text-sm text-slate-400">Summary</p><p className="mt-2 text-white leading-7">{analysis.summary}</p></div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-4"><p className="text-sm text-slate-400">Recommendation</p><p className="mt-2 text-white leading-7">{analysis.paymentRecommendation}</p><span className={analysis.riskLevel === "LOW" ? "pill ok mt-3" : analysis.riskLevel === "MEDIUM" ? "pill warn mt-3" : "pill bad mt-3"}>{analysis.riskLevel} risk</span></div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-4 lg:col-span-2"><p className="text-sm text-slate-400">Policy notes</p><div className="mt-3 grid gap-2">{analysis.policyNotes?.map((note) => <p key={note} className="text-sm text-slate-200">{note}</p>)}</div>{analysis.warning && <p className="mt-4 text-sm text-amber-100">{analysis.warning}</p>}</div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function FeatureSection({ icon: Icon, title, body }: { icon: typeof BrainCircuit; title: string; body: string }) {
  return <section className="card row"><div className="grid h-11 w-11 place-items-center rounded-md bg-white/10 text-white"><Icon size={22} /></div><div><h3 className="text-lg font-black text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{body}</p></div></section>;
}
