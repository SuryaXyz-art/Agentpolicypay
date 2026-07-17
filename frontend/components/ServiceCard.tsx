import { ServerCog } from "lucide-react";
import type { Service } from "@/lib/policyEngine";

export default function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="card stack">
      <div className="row">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-400/10 text-blue-300">
          <ServerCog size={20} />
        </div>
        <span className={service.allowed ? "pill ok" : "pill bad"}>{service.allowed ? "Allowed" : "Blocked"}</span>
        <span className="pill">{service.category}</span>
      </div>
      <div>
        <h3 className="text-lg font-black text-white">{service.name}</h3>
        <p className="code mt-2 text-slate-400">{service.address}</p>
      </div>
      {service.txHash && <p className="code text-slate-500">Tx: {service.txHash}</p>}
    </div>
  );
}
