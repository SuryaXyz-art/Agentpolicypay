import { CheckCircle2, XCircle } from "lucide-react";
import type { PaymentRequest, PolicyDecision } from "@/lib/policyEngine";

export default function PaymentRequestCard({ request, decision }: { request: PaymentRequest; decision: PolicyDecision }) {
  return (
    <div className="card stack">
      <div className="row">
        {decision.approved ? <CheckCircle2 className="text-emerald-300" /> : <XCircle className="text-red-300" />}
        <span className={decision.approved ? "pill ok" : "pill bad"}>{decision.approved ? "Approved" : "Blocked"}</span>
      </div>
      <div>
        <h3 className="text-xl font-black text-white">{request.amount} 0G payment request</h3>
        <p className="mt-2 text-slate-400">{decision.reason}</p>
      </div>
      <div className="grid gap-2 rounded-md border border-white/10 bg-night/60 p-3">
        <p className="code text-slate-300">Agent: {request.agentWallet}</p>
        <p className="code text-slate-300">Receiver: {request.receiver}</p>
      </div>
    </div>
  );
}
