"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, ReceiptText, X, XCircle } from "lucide-react";
import ReceiptCard from "@/components/ReceiptCard";
import { getReceipts, type Receipt, type ReceiptStatus } from "@/lib/receipt";
import { formatAddress, formatAmount, formatDateTime } from "@/lib/format";

type Filter = "ALL" | ReceiptStatus;

export default function ReceiptsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const receipts = getReceipts();
  const filteredReceipts = useMemo(() => filter === "ALL" ? receipts : receipts.filter((receipt) => receipt.status === filter), [filter, receipts]);
  const totalApprovedSpend = receipts.filter((receipt) => receipt.status === "APPROVED").reduce((sum, receipt) => sum + receipt.amount, 0);

  function exportReceipt(receipt: Receipt) {
    const json = JSON.stringify(receipt, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.receiptId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <section className="section">
        <div className="stack">
          <div className="eyebrow">Verifiable payment trail</div>
          <h1 className="text-4xl font-black text-white">Receipts</h1>
          <p className="lede">Review approved and blocked agent payment decisions with hashes, checks, and mock explorer links.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="card metric"><span>Total receipts</span><strong>{receipts.length}</strong><p className="muted">All generated decisions.</p></div>
          <div className="card metric"><span>Approved spend</span><strong>{formatAmount(totalApprovedSpend)}</strong><p className="muted">Approved simulated payments.</p></div>
          <div className="card metric"><span>Blocked receipts</span><strong>{receipts.filter((receipt) => receipt.status === "BLOCKED").length}</strong><p className="muted">Captured blocked attempts.</p></div>
        </div>

        <div className="row">
          {(["ALL", "APPROVED", "BLOCKED"] as Filter[]).map((item) => (
            <button key={item} className={filter === item ? "button" : "button secondary"} type="button" onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>

        <div className="list">
          {filteredReceipts.map((receipt) => <ReceiptCard key={receipt.receiptId} receipt={receipt} onView={() => setSelectedReceipt(receipt)} onExport={() => exportReceipt(receipt)} />)}
          {filteredReceipts.length === 0 && <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8"><div className="row"><ReceiptText className="text-aqua" /><h2 className="text-xl font-black text-white">No receipts found</h2></div><p className="mt-3 text-slate-400">Use Pay Research or Mind Vault to create proof-ready payment context.</p></div>}
        </div>
      </section>

      {selectedReceipt && <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} onExport={() => exportReceipt(selectedReceipt)} />}
    </main>
  );
}

function ReceiptModal({ receipt, onClose, onExport }: { receipt: Receipt; onClose: () => void; onExport: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg border border-white/10 bg-night p-6 shadow-glow">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Receipt details</p>
            <h2 className="mt-2 text-3xl font-black text-white">{receipt.receiptId}</h2>
            <p className="mt-2 text-slate-400">{formatDateTime(receipt.timestamp)}</p>
          </div>
          <button className="icon-button bg-white/10 text-white" type="button" onClick={onClose} aria-label="Close receipt details"><X size={18} /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Detail label="Status" value={receipt.status} />
          <Detail label="Risk level" value={receipt.riskLevel} />
          <Detail label="Amount" value={formatAmount(receipt.amount)} />
          <Detail label="Policy ID" value={receipt.policyId ?? "No policy ID"} />
          <Detail label="User" value={formatAddress(receipt.user)} mono />
          <Detail label="Agent" value={formatAddress(receipt.agent)} mono />
          <Detail label="Receiver" value={formatAddress(receipt.receiver)} mono />
          <Detail label="Mock tx hash" value={receipt.mockTxHash} mono />
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Receipt hash</p>
          <p className="code mt-2 text-slate-200">{receipt.receiptHash}</p>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Reason</p>
          <p className="mt-2 text-slate-200">{receipt.reason}</p>
        </div>

        <div className="mt-4 grid gap-2">
          <h3 className="text-xl font-black text-white">Policy checks</h3>
          {receipt.checks.map((check) => <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] p-3" key={check.label}><span className="text-slate-300">{check.label}</span>{check.passed ? <CheckCircle2 className="text-emerald-300" size={18} /> : <XCircle className="text-red-300" size={18} />}</div>)}
        </div>

        <div className="actions mt-6">
          <button className="button" type="button" onClick={onExport}><Download size={18} /> Export receipt JSON</button>
          <a className="button secondary" href={`https://chainscan-galileo.0g.ai/tx/${receipt.mockTxHash}`} target="_blank" rel="noreferrer">Open mock explorer</a>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><p className="text-sm text-slate-500">{label}</p><p className={mono ? "code mt-2 text-slate-200" : "mt-2 font-bold text-white"}>{value}</p></div>;
}
