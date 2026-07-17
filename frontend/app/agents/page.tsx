"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Loader2, Plus, ServerCog, ShieldOff } from "lucide-react";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import AgentCard from "@/components/AgentCard";
import ServiceCard from "@/components/ServiceCard";
import { agentPaymentGuardAbi, contractAddresses, hasPaymentGuardConfig } from "@/lib/contracts";
import { formatAddress } from "@/lib/format";
import { loadLocal, saveLocal } from "@/lib/localStore";
import { defaultAgents, defaultServices, type Agent, type AgentType, type Service, type ServiceCategory } from "@/lib/policyEngine";

type AgentForm = {
  name: string;
  wallet: string;
  type: AgentType;
};

type ServiceForm = {
  name: string;
  address: string;
  category: ServiceCategory;
};

const agentTypes: AgentType[] = ["Research", "Trading", "API Buyer", "Social Agent", "Custom"];
const serviceCategories: ServiceCategory[] = ["API", "Storage", "Compute", "Data", "SaaS", "Custom"];

const initialAgentForm: AgentForm = {
  name: "Research Analyst Agent",
  wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  type: "Research"
};

const initialServiceForm: ServiceForm = {
  name: "0G Compute Gateway",
  address: "0x9A676e781A523b5d0C0e43731313A708CB607508",
  category: "Compute"
};

function agentRisk(type: AgentType): Agent["risk"] {
  if (type === "Trading") return "high";
  if (type === "Social Agent") return "medium";
  return "low";
}

function upsertAgent(list: Agent[], next: Agent) {
  return [next, ...list.filter((agent) => agent.wallet.toLowerCase() !== next.wallet.toLowerCase())];
}

function upsertService(list: Service[], next: Service) {
  return [next, ...list.filter((service) => service.address.toLowerCase() !== next.address.toLowerCase())];
}

export default function AgentsPage() {
  const [agents, setAgents] = useState(() => loadLocal<Agent[]>("app.agents", defaultAgents));
  const [services, setServices] = useState(() => loadLocal<Service[]>("app.services", defaultServices));
  const [agentForm, setAgentForm] = useState<AgentForm>(initialAgentForm);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(initialServiceForm);
  const [agentError, setAgentError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const contractReady = isConnected && hasPaymentGuardConfig();
  const approvedAgents = useMemo(() => agents.filter((agent) => agent.approved), [agents]);
  const revokedAgents = useMemo(() => agents.filter((agent) => !agent.approved), [agents]);
  const allowedServices = useMemo(() => services.filter((service) => service.allowed), [services]);
  const blockedServices = useMemo(() => services.filter((service) => !service.allowed), [services]);

  function persistAgents(nextAgents: Agent[]) {
    saveLocal("app.agents", nextAgents);
    setAgents(nextAgents);
  }

  function persistServices(nextServices: Service[]) {
    saveLocal("app.services", nextServices);
    setServices(nextServices);
  }

  async function submitContract(functionName: "approveAgent" | "revokeAgent" | "allowService" | "removeService", target: `0x${string}`) {
    if (!contractReady || !contractAddresses.paymentGuard || !publicClient) return undefined;
    const hash = await writeContractAsync({
      address: contractAddresses.paymentGuard,
      abi: agentPaymentGuardAbi,
      functionName,
      args: [target]
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function addAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAgentError("");
    setSuccess("");

    if (!agentForm.name.trim()) {
      setAgentError("Enter a clear agent name.");
      return;
    }
    if (!isAddress(agentForm.wallet)) {
      setAgentError("Enter a valid Ethereum-style wallet address.");
      return;
    }

    setPendingAction("agent:add");
    try {
      const txHash = await submitContract("approveAgent", agentForm.wallet as `0x${string}`);
      const nextAgent: Agent = {
        id: crypto.randomUUID(),
        name: agentForm.name.trim(),
        wallet: agentForm.wallet,
        type: agentForm.type,
        approved: true,
        risk: agentRisk(agentForm.type),
        totalSpent: 0,
        txHash
      };
      persistAgents(upsertAgent(agents, nextAgent));
      setSuccess(txHash ? "Agent approved on-chain and saved locally." : "Agent approved in demo mode.");
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Unable to approve agent.");
    } finally {
      setPendingAction(null);
    }
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceError("");
    setSuccess("");

    if (!serviceForm.name.trim()) {
      setServiceError("Enter a clear service name.");
      return;
    }
    if (!isAddress(serviceForm.address)) {
      setServiceError("Enter a valid Ethereum-style service address.");
      return;
    }

    setPendingAction("service:add");
    try {
      const txHash = await submitContract("allowService", serviceForm.address as `0x${string}`);
      const nextService: Service = {
        id: crypto.randomUUID(),
        name: serviceForm.name.trim(),
        address: serviceForm.address,
        category: serviceForm.category,
        allowed: true,
        txHash
      };
      persistServices(upsertService(services, nextService));
      setSuccess(txHash ? "Service allowed on-chain and saved locally." : "Service allowed in demo mode.");
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Unable to allow service.");
    } finally {
      setPendingAction(null);
    }
  }

  async function setAgentStatus(agent: Agent, approved: boolean) {
    setAgentError("");
    setSuccess("");
    setPendingAction(`agent:${agent.id}`);
    try {
      const txHash = await submitContract(approved ? "approveAgent" : "revokeAgent", agent.wallet as `0x${string}`);
      persistAgents(agents.map((item) => item.id === agent.id ? { ...item, approved, txHash: txHash ?? item.txHash } : item));
      setSuccess(approved ? "Agent restored to approved list." : "Agent moved to revoked list.");
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Unable to update agent.");
    } finally {
      setPendingAction(null);
    }
  }

  async function setServiceStatus(service: Service, allowed: boolean) {
    setServiceError("");
    setSuccess("");
    setPendingAction(`service:${service.id}`);
    try {
      const txHash = await submitContract(allowed ? "allowService" : "removeService", service.address as `0x${string}`);
      persistServices(services.map((item) => item.id === service.id ? { ...item, allowed, txHash: txHash ?? item.txHash } : item));
      setSuccess(allowed ? "Service restored to allowlist." : "Service moved to blocked list.");
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Unable to update service.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="page">
      <section className="section">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="stack">
            <div className="eyebrow">Access controls</div>
            <h1 className="text-4xl font-black text-white">Agents and services</h1>
            <p className="lede">Approve AI wallets and allow service receivers before autonomous payments can pass policy checks.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
            Wallet: <span className="font-mono text-aqua">{formatAddress(address ?? "")}</span>
          </div>
        </div>

        {success && <div className="row rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-200"><CheckCircle2 size={18} /> <p className="text-sm">{success}</p></div>}
        {!contractReady && <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-4 text-sm leading-6 text-blue-100">Demo mode is active. Add `NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS` and connect a wallet to submit guard transactions.</div>}

        <div className="grid cols-2">
          <form className="card form" onSubmit={addAgent} noValidate>
            <div className="row"><div className="grid h-11 w-11 place-items-center rounded-md bg-violet/10 text-violet-300"><Bot size={22} /></div><h2 className="text-2xl font-black text-white">Add agent</h2></div>
            <div className="field"><label>Agent name</label><input value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} /></div>
            <div className="field"><label>Agent wallet address</label><input value={agentForm.wallet} onChange={(event) => setAgentForm({ ...agentForm, wallet: event.target.value })} /></div>
            <div className="field"><label>Agent type</label><select value={agentForm.type} onChange={(event) => setAgentForm({ ...agentForm, type: event.target.value as AgentType })}>{agentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            {agentError && <div className="row rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-red-200"><AlertCircle size={17} /><p className="text-sm">{agentError}</p></div>}
            <button className="button" disabled={pendingAction === "agent:add"} type="submit">{pendingAction === "agent:add" ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Approve agent</button>
          </form>

          <form className="card form" onSubmit={addService} noValidate>
            <div className="row"><div className="grid h-11 w-11 place-items-center rounded-md bg-blue-400/10 text-blue-300"><ServerCog size={22} /></div><h2 className="text-2xl font-black text-white">Add allowed service</h2></div>
            <div className="field"><label>Service name</label><input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} /></div>
            <div className="field"><label>Service wallet/contract address</label><input value={serviceForm.address} onChange={(event) => setServiceForm({ ...serviceForm, address: event.target.value })} /></div>
            <div className="field"><label>Service category</label><select value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value as ServiceCategory })}>{serviceCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
            {serviceError && <div className="row rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-red-200"><AlertCircle size={17} /><p className="text-sm">{serviceError}</p></div>}
            <button className="button" disabled={pendingAction === "service:add"} type="submit">{pendingAction === "service:add" ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Allow service</button>
          </form>
        </div>

        <div className="grid cols-2">
          <section className="stack">
            <div><h2 className="text-2xl font-black text-white">Approved AI Agents</h2><p className="mt-2 text-sm text-slate-400">Agents in this list can request payments when policy checks pass.</p></div>
            <div className="list">
              {approvedAgents.map((agent) => <div className="stack" key={agent.id}><AgentCard agent={agent} /><button className="button secondary" disabled={pendingAction === `agent:${agent.id}`} type="button" onClick={() => void setAgentStatus(agent, false)}><ShieldOff size={18} /> Revoke agent</button></div>)}
              {approvedAgents.length === 0 && <EmptyState title="No approved agents" body="Add an agent wallet to start testing safe autonomous payments." />}
            </div>
          </section>

          <section className="stack">
            <div><h2 className="text-2xl font-black text-white">Allowed Services</h2><p className="mt-2 text-sm text-slate-400">Agents can only pay receiver addresses on this allowlist.</p></div>
            <div className="list">
              {allowedServices.map((service) => <div className="stack" key={service.id}><ServiceCard service={service} /><button className="button secondary" disabled={pendingAction === `service:${service.id}`} type="button" onClick={() => void setServiceStatus(service, false)}><ShieldOff size={18} /> Remove service</button></div>)}
              {allowedServices.length === 0 && <EmptyState title="No allowed services" body="Add a trusted API, storage, compute, data, or SaaS receiver." />}
            </div>
          </section>
        </div>

        <section className="stack">
          <div><h2 className="text-2xl font-black text-white">Revoked/Blocked list</h2><p className="mt-2 text-sm text-slate-400">Review identities that are currently prevented from receiving or requesting payments.</p></div>
          <div className="grid cols-2">
            <div className="stack">
              <h3 className="text-lg font-black text-white">Revoked agents</h3>
              {revokedAgents.map((agent) => <div className="stack" key={agent.id}><AgentCard agent={agent} /><button className="button secondary" type="button" onClick={() => void setAgentStatus(agent, true)}>Restore approval</button></div>)}
              {revokedAgents.length === 0 && <EmptyState title="No revoked agents" body="Revoked agents will appear here for quick review." />}
            </div>
            <div className="stack">
              <h3 className="text-lg font-black text-white">Blocked services</h3>
              {blockedServices.map((service) => <div className="stack" key={service.id}><ServiceCard service={service} /><button className="button secondary" type="button" onClick={() => void setServiceStatus(service, true)}>Allow service again</button></div>)}
              {blockedServices.length === 0 && <EmptyState title="No blocked services" body="Removed service receivers will appear here." />}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6">
      <p className="font-bold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}
