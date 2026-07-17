import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowRight, Bot, FileCheck2, LockKeyhole, Radar, ShieldCheck, WalletCards } from "lucide-react";

const features = [
  {
    title: "Spending Policies",
    description: "Set per-payment limits, daily caps, approval thresholds, and receipt requirements.",
    icon: WalletCards
  },
  {
    title: "Approved Agents",
    description: "Give selected AI agent wallets permission to request payments, then revoke access anytime.",
    icon: Bot
  },
  {
    title: "Allowed Services",
    description: "Limit payments to trusted API, storage, compute, data, and SaaS receivers.",
    icon: LockKeyhole
  },
  {
    title: "Risk Checks",
    description: "Review agent, receiver, amount, daily spend, and reason quality before payment.",
    icon: Radar
  },
  {
    title: "Mind Vault",
    description: "Store private payment context, anonymized model views, memory patterns, and local proof hashes.",
    icon: Archive
  },
  {
    title: "Receipts",
    description: "Create a receipt hash and local proof for every approved payment in demo mode.",
    icon: FileCheck2
  }
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-transparent">
      <section className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="card mx-auto grid max-w-sm place-items-center bg-white p-6">
          <Image src="/apolo-mind-logo.png" alt="Apolo Mind logo" width={480} height={480} className="h-auto w-full rounded-md" priority />
        </div>

        <div className="grid gap-7">
          <div className="grid gap-4">
            <p className="eyebrow">AI payment control</p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Apolo Mind
            </h1>
            <p className="max-w-2xl text-2xl font-bold leading-9 text-white">
              Programmable Spending Control for Autonomous AI Agents
            </p>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Give agents limited payment power with clear policies, approved receivers, live risk checks, and receipts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="button" href="/create-policy">
              Create Policy <ShieldCheck size={18} />
            </Link>
            <Link className="button secondary" href="/pay-research">
              Pay Research <ArrowRight size={18} />
            </Link>
            <Link className="button secondary" href="/mind-vault">
              Mind Vault <Archive size={18} />
            </Link>
            <Link className="button secondary" href="/dashboard">
              Open Dashboard <WalletCards size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mb-8 grid gap-3">
          <p className="eyebrow">Core features</p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">Everything needed for a clean demo flow</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <section key={title} className="card transition hover:border-aqua/40">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua">
                <Icon size={22} />
              </div>
              <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-6 text-slate-400">{description}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
