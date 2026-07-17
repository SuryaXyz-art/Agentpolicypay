import { ExternalLink, ReceiptText } from "lucide-react";
import type { Receipt } from "@/lib/receipt";
import { formatAddress, formatAmount, formatDateTime } from "@/lib/format";

export default function ReceiptCard({ receipt, onView, onExport }: { receipt: Receipt; onView?: () => void; onExport?: () => void }) {
  const explorerUrl = `https://chainscan-galileo.0g.ai/tx/${receipt.mockTxHash}`;

  return (
    <div className="card stack">
      <div className="row">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-aqua/10 text-aqua">
          <ReceiptText size={20} />
        </div>
        <span className={receipt.status === "APPROVED" ? "pill ok" : "pill bad"}>{receipt.status}</span>
        <span className={receipt.riskLevel === "LOW" ? "pill ok" : receipt.riskLevel === "MEDIUM" ? "pill warn" : "pill bad"}>{receipt.riskLevel} risk</span>
      </div>
      <div>
        <h3 className="text-lg font-black text-white">{formatAmount(receipt.amount)} payment receipt</h3>
        <p className="mt-1 text-sm text-slate-400">{receipt.reason}</p>
        <p className="mt-1 text-sm text-slate-500">{formatDateTime(receipt.timestamp)}</p>
      </div>
      <div className="grid gap-2 rounded-md border border-white/10 bg-night/60 p-3">
        <p className="code text-slate-300">Agent: {formatAddress(receipt.agent)}</p>
        <p className="code text-slate-300">Receiver: {formatAddress(receipt.receiver)}</p>
        <p className="code text-slate-500">Hash: {receipt.receiptHash}</p>
      </div>
      <div className="actions">
        {onView && <button className="button secondary" type="button" onClick={onView}>Details</button>}
        {onExport && <button className="button secondary" type="button" onClick={onExport}>Export JSON</button>}
        <a className="button secondary" href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink size={16} /></a>
      </div>
    </div>
  );
}
