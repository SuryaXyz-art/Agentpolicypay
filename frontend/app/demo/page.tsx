import Link from "next/link";
import { CheckCircle2, FileCheck2, ShieldCheck, XCircle } from "lucide-react";

const steps = [
  ["Create policy", "maxPerTx 5, dailyLimit 25, approvalThreshold 3, receipt required", true],
  ["Approve agent", "ResearchBot is authorized to request payments", true],
  ["Allow service", "MarketDataAPI is added as an allowed receiver", true],
  ["Safe payment approved", "2 0G request passes all policy checks", true],
  ["Overspend blocked", "Amount above maxPerTx is rejected", false],
  ["Receipt generated", "Approved payment produces JSON, hash, and demo storage URI", true],
  ["Receipt proof shown", "Receipts page displays hash, mock tx, and details modal", true]
];

export default function DemoPage() {
  return <main className="page"><section className="section"><div className="stack"><div className="eyebrow">Final demo route</div><h1 className="text-4xl font-black text-white">AgentPolicy Pay demo flow</h1><p className="lede">A judge-friendly walkthrough of policy setup, agent approval, service allowlisting, risk checks, and verifiable receipts.</p></div><div className="grid gap-4">{steps.map(([title, body, positive], index) => <div key={title.toString()} className="card row"><div className={positive ? "grid h-12 w-12 place-items-center rounded-md bg-emerald-400/10 text-emerald-300" : "grid h-12 w-12 place-items-center rounded-md bg-red-400/10 text-red-300"}>{positive ? <CheckCircle2 /> : <XCircle />}</div><div><p className="text-sm text-slate-500">Step {index + 1}</p><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-1 text-slate-400">{body}</p></div></div>)}</div><div className="actions"><Link className="button" href="/dashboard"><ShieldCheck size={18} /> Start from dashboard</Link><Link className="button secondary" href="/payment-simulator">Run simulator</Link><Link className="button secondary" href="/receipts"><FileCheck2 size={18} /> View proof</Link></div></section></main>;
}
