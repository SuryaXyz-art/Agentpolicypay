"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bot, DatabaseZap, ReceiptText, ServerCog, ShieldCheck, WalletCards } from "lucide-react";
import AgentCard from "@/components/AgentCard";
import PolicyCard from "@/components/PolicyCard";
import ReceiptCard from "@/components/ReceiptCard";
import ServiceCard from "@/components/ServiceCard";
import StatCard from "@/components/StatCard";
import type { Receipt } from "@/lib/receipt";
import type { Agent, BlockedAttempt, Policy, Service } from "@/lib/policyEngine";
import { defaultAgents, defaultOwner, defaultServices, loadJson } from "@/lib/policyEngine";
import { saveLocal } from "@/lib/localStore";

const demoPolicy: Policy = { policyId: "demo-policy-1", name: "Hackathon Demo Policy", owner: defaultOwner, maxPayment: 5, maxPerTx: 5, dailyCap: 25, dailyLimit: 25, approvalThreshold: 3, receiptRequired: true, spentToday: 0, allowedReceivers: ["0x2222222222222222222222222222222222222222"], active: true, createdAt: new Date().toISOString(), source: "demo" };
const demoAgent: Agent = { id: "agent-researchbot", name: "ResearchBot", wallet: "0x1111111111111111111111111111111111111111", approved: true, risk: "low", type: "Research", totalSpent: 0 };
const demoService: Service = { id: "service-marketdata", name: "MarketDataAPI", address: "0x2222222222222222222222222222222222222222", category: "API", allowed: true };

export default function DashboardPage() {
  const [toast, setToast] = useState("");
  const [refresh, setRefresh] = useState(0);
  const policy = loadJson<Policy | null>("app.policy", null);
  const agents = loadJson<Agent[]>("app.agents", defaultAgents);
  const services = loadJson<Service[]>("app.services", defaultServices);
  const receipts = loadJson<Receipt[]>("app.receipts", []);
  const blockedAttempts = loadJson<BlockedAttempt[]>("app.blockedAttempts", []);
  const allowedServices = services.filter((service) => service.allowed || policy?.allowedReceivers.includes(service.address));
  const totalSpend = receipts.filter((receipt) => receipt.status !== "BLOCKED").reduce((sum, receipt) => sum + receipt.amount, 0);

  function loadDemoData() {
    saveLocal("app.policy", demoPolicy);
    saveLocal("app.policies", [demoPolicy]);
    saveLocal("app.agents", [demoAgent]);
    saveLocal("app.services", [demoService]);
    saveLocal("app.receipts", []);
    saveLocal("app.blockedAttempts", []);
    setToast("Demo data loaded: policy, ResearchBot, and MarketDataAPI.");
    setRefresh(refresh + 1);
  }

  return (
    <main className="page">
      <section className="section">
        {toast && <div className="fixed right-5 top-24 z-50 rounded-lg border border-aqua/30 bg-aqua/10 px-4 py-3 text-sm text-aqua shadow-glow">{toast}</div>}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="stack"><div className="eyebrow">Command center</div><h1 className="max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">Programmable Spending Control for Autonomous AI Agents</h1><p className="lede">Set rules once. Let agents pay safely.</p></div><div className="actions"><button className="button secondary" onClick={loadDemoData}><DatabaseZap size={18} /> Load Demo Data</button><Link className="button" href="/payment-simulator">Try simulator <WalletCards size={18} /></Link></div></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5"><StatCard label="Active policies" value={policy ? 1 : 0} detail="User spending policies currently enabled." icon={ShieldCheck} /><StatCard label="Approved agents" value={agents.filter((agent) => agent.approved).length} detail="Autonomous wallets trusted to request spend." icon={Bot} tone="violet" /><StatCard label="Allowed services" value={allowedServices.length} detail="Receiver addresses approved for payments." icon={ServerCog} tone="blue" /><StatCard label="Simulated spend" value={`${totalSpend} 0G`} detail="Total approved spend from local simulations." icon={ReceiptText} /><StatCard label="Blocked attempts" value={blockedAttempts.length} detail="Requests stopped by policy checks." icon={AlertTriangle} tone="red" /></div>
        <div className="grid cols-2"><PolicyCard policy={policy} /><div className="card stack"><div className="row"><ReceiptText className="text-aqua" /><h2 className="text-2xl font-black text-white">Recent receipts</h2></div><div className="list">{receipts.slice(0, 3).map((receipt) => <ReceiptCard key={receipt.receiptId ?? receipt.id} receipt={receipt} />)}{receipts.length === 0 && <p className="muted">Approved payment receipts will appear after a successful simulation.</p>}</div></div></div>
        <div className="grid cols-2"><div className="stack"><h2 className="text-2xl font-black text-white">Approved agents</h2><div className="list">{agents.filter((agent) => agent.approved).slice(0, 3).map((agent) => <AgentCard key={agent.id} agent={agent} />)}{agents.filter((agent) => agent.approved).length === 0 && <div className="card"><p className="muted">No approved agents yet.</p></div>}</div></div><div className="stack"><h2 className="text-2xl font-black text-white">Allowed services</h2><div className="list">{allowedServices.slice(0, 3).map((service) => <ServiceCard key={service.id} service={{ ...service, allowed: true }} />)}{allowedServices.length === 0 && <div className="card"><p className="muted">No services are allowed yet.</p></div>}</div></div></div>
      </section>
    </main>
  );
}
