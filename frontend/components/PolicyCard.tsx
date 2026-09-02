import { ShieldCheck } from "lucide-react";
import type { Policy } from "@/lib/policyEngine";

export default function PolicyCard({ policy }: { policy: Policy | null }) {
  if (!policy) {
    return (
      <div className="card stack">
        <span className="pill warn">No policy</span>
        <h3>Spending policy required</h3>
        <p className="muted">Create caps and receiver rules before an agent can request payment.</p>
      </div>
    );
  }

  const capUsed = Math.round((policy.spentToday / policy.dailyCap) * 100);

  return (
    <div className="card stack">
      <div className="row">
        <ShieldCheck size={22} />
        <span className="pill ok">Active</span>
      </div>
      <h3>Owner policy</h3>
      <div className="grid cols-3">
        <div className="metric"><span>Per payment</span><strong>{policy.maxPayment} 0G</strong></div>
        <div className="metric"><span>Daily cap</span><strong>{policy.dailyCap} 0G</strong></div>
        <div className="metric"><span>Used today</span><strong>{capUsed}%</strong></div>
      </div>
      <p className="code muted">{policy.owner}</p>
    </div>
  );
}
