import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";

const features = [
  {
    title: "Spending Policies",
    description: "Define per-payment limits and daily caps before an autonomous workflow can spend.",
    icon: WalletCards
  },
  {
    title: "Agent Whitelist",
    description: "Approve specific AI agent wallets and revoke authorization when behavior changes.",
    icon: Bot
  },
  {
    title: "Service Allowlist",
    description: "Restrict payments to known service receivers such as APIs, data providers, and compute.",
    icon: LockKeyhole
  },
  {
    title: "Risk Checks",
    description: "Block requests that exceed amount limits, receiver rules, agent status, or daily caps.",
    icon: Radar
  },
  {
    title: "Verifiable Receipts",
    description: "Generate receipt hashes and storage references for approved payments on the 0G path.",
    icon: FileCheck2
  }
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black">
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.10),transparent_28%),linear-gradient(180deg,rgba(3,3,3,0),#030303_78%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
          <div className="grid gap-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-aqua/25 bg-aqua/10 px-4 py-2 text-sm font-bold text-aqua">
              <Sparkles size={16} /> AgentPolicy Pay on 0G
            </div>
            <div className="grid gap-5">
              <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
                Programmable Spending Control for Autonomous AI Agents
              </h1>
              <p className="max-w-2xl text-xl leading-8 text-slate-300">
                Set rules once. Let agents pay safely.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button" href="/create-policy">
                Create Policy <ShieldCheck size={18} />
              </Link>
              <Link className="button secondary" href="/payment-simulator">
                Try Payment Simulator <ArrowRight size={18} />
              </Link>
              <Link className="button secondary" href="/receipts">
                View Receipts <FileCheck2 size={18} />
              </Link>
            </div>
            <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
              <div className="flex items-center gap-2"><CheckCircle2 className="text-aqua" size={17} /> Policy gated</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="text-aqua" size={17} /> Wallet connected</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="text-aqua" size={17} /> Receipt ready</div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-lg border border-white/10 bg-white/[0.07] p-5 shadow-glow backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-slate-400">Live policy check</p>
                  <h2 className="text-2xl font-black text-white">Payment Guard</h2>
                </div>
                <span className="pill ok">Approved</span>
              </div>
              <div className="grid gap-4">
                <div className="rounded-lg border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Agent</span><span>Whitelisted</span>
                  </div>
                  <p className="mt-2 font-mono text-sm text-aqua">0x3C44...93BC</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Receiver</span><span>Allowed service</span>
                  </div>
                  <p className="mt-2 font-mono text-sm text-white">0G Compute Gateway</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-aqua/20 bg-aqua/10 p-4">
                    <p className="text-sm text-slate-300">Request</p>
                    <strong className="text-3xl text-white">12 0G</strong>
                  </div>
                  <div className="rounded-lg border border-violet/25 bg-violet/10 p-4">
                    <p className="text-sm text-slate-300">Daily cap left</p>
                    <strong className="text-3xl text-white">88%</strong>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-gradient-to-r from-aqua/15 to-violet/15 p-4">
                  <p className="text-sm text-slate-300">Receipt hash</p>
                  <p className="mt-2 break-all font-mono text-sm text-white">0x8d54a2f9c0b731a6c4e90f...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mb-8 grid gap-3">
          <p className="eyebrow">Safety layer</p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">Built for agent payment workflows</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {features.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition hover:border-aqua/40 hover:bg-white/[0.09]">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua">
                <Icon size={22} />
              </div>
              <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-6 text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

