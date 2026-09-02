import Link from "next/link";
import { CheckCircle2, FileCheck2, ShieldCheck, XCircle } from "lucide-react";

const steps = [
  ["Create policy", "Creates the spending policy in the configured Wave 3 registry", true],
  ["Approve agent", "The policy owner authorizes an agent wallet on the guard", true],
  ["Allow service", "The policy owner allowlists the exact receiver address", true],
  ["Fund vault", "The policy owner deposits native 0G into the guarded policy balance", true],
  ["Execute payment", "The vault transfers native 0G only after deterministic checks pass", true],
  ["Overspend blocked", "Amount above maxPerTx or the daily limit reverts on-chain", false],
  ["Receipt proof shown", "The final 0G Storage root is attached to the executed intent", true]
];

export default function DemoPage() {
  return <main className="page"><section className="section"><div className="stack"><div className="eyebrow">Wave 3 verification route</div><h1 className="text-4xl font-black text-white">Guarded payment checklist</h1><p className="lede">This checklist describes the live path. It does not create sample payments or turn missing configuration into a claim of execution.</p></div><div className="grid gap-4">{steps.map(([title, body, positive], index) => <div key={title.toString()} className="card row"><div className={positive ? "grid h-12 w-12 place-items-center rounded-md bg-emerald-400/10 text-emerald-300" : "grid h-12 w-12 place-items-center rounded-md bg-red-400/10 text-red-300"}>{positive ? <CheckCircle2 /> : <XCircle />}</div><div><p className="text-sm text-slate-500">Step {index + 1}</p><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-1 text-slate-400">{body}</p></div></div>)}</div><div className="actions"><Link className="button" href="/create-policy"><ShieldCheck size={18} /> Configure policy</Link><Link className="button secondary" href="/request-payment">Request payment</Link><Link className="button secondary" href="/receipts"><FileCheck2 size={18} /> View proof</Link></div></section></main>;
}
