import { BadgeCheck, Bot, WalletCards } from "lucide-react";
import { getAgenticProfileForAgent } from "@/lib/agenticId";
import { formatAmount } from "@/lib/format";
import RiskBadge from "./RiskBadge";
import type { Agent } from "@/lib/policyEngine";

export default function AgentCard({ agent }: { agent: Agent }) {
  const profile = getAgenticProfileForAgent(agent.wallet);

  return (
    <div className="card stack">
      <div className="row">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-violet/10 text-violet-300">
          <Bot size={20} />
        </div>
        <span className={agent.approved ? "pill ok" : "pill bad"}>{agent.approved ? "Approved" : "Revoked"}</span>
        <span className="pill">{agent.type ?? "Custom"}</span>
        <RiskBadge risk={agent.risk} />
        {profile && <span className="pill ok"><BadgeCheck size={14} /> Agentic ID</span>}
      </div>
      <div>
        <h3 className="text-lg font-black text-white">{agent.name}</h3>
        <p className="code mt-2 text-slate-400">{agent.wallet}</p>
        {profile && <p className="mt-2 text-sm text-aqua">{profile.verificationStatus} identity profile</p>}
      </div>
      <div className="row rounded-md border border-white/10 bg-night/60 p-3 text-sm text-slate-300">
        <WalletCards size={16} className="text-aqua" />
        <span>Total spent: <strong className="text-white">{formatAmount(agent.totalSpent ?? 0)}</strong></span>
      </div>
      {agent.txHash && <p className="code text-slate-500">Tx: {agent.txHash}</p>}
    </div>
  );
}
