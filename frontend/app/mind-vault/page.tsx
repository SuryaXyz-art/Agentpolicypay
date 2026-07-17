"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, BrainCircuit, Download, FileText, LockKeyhole, MessageSquareText, Radar, Search, ShieldCheck } from "lucide-react";
import { appendLocal, loadLocal } from "@/lib/localStore";
import { answerFromMemory, buildMirror, createMindEntry, type MindEntry, type MindLens } from "@/lib/mindVault";

const lenses: MindLens[] = ["Policy Mirror", "Pattern Finder", "Risk Coach", "Payment Prep"];

export default function MindVaultPage() {
  const [entries, setEntries] = useState<MindEntry[]>(() => loadLocal<MindEntry[]>("app.mindVault.entries", []));
  const [title, setTitle] = useState("Research agent payment context");
  const [rawText, setRawText] = useState("ResearchBot wants to pay MarketDataAPI for a 2 0G market summary. Policy allows maxPerTx 5 and dailyLimit 25.");
  const [lens, setLens] = useState<MindLens>("Policy Mirror");
  const [question, setQuestion] = useState("What should I check before approving ResearchBot?");
  const [answer, setAnswer] = useState("");
  const mirror = useMemo(() => buildMirror(entries), [entries]);

  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rawText.trim()) return;

    const entry = createMindEntry({ title, rawText, lens });
    const next = appendLocal("app.mindVault.entries", entry);
    setEntries(next);
    setAnswer(`Saved private memory with proof ${entry.proofHash}.`);
  }

  function askMemory() {
    setAnswer(answerFromMemory(question, entries));
  }

  function exportVault() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apolo-mind-vault.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const latest = entries[0];

  return (
    <main className="page">
      <section className="section">
        <div className="stack">
          <div className="eyebrow">Mind Vault</div>
          <h1 className="text-4xl font-black text-white">Private memory for agent payments</h1>
          <p className="lede">
            Capture payment context, anonymize what the model sees, find repeated risk patterns, and keep local proof for each memory.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card stack">
            <div className="row">
              <LockKeyhole className="text-aqua" />
              <h2 className="text-2xl font-black text-white">Private capture</h2>
            </div>
            <form className="form" onSubmit={saveEntry}>
              <div className="field">
                <label>Memory title</label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label>Reflection lens</label>
                <select value={lens} onChange={(event) => setLens(event.target.value as MindLens)}>
                  {lenses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Agent payment context</label>
                <textarea className="min-h-36 rounded-md border border-white/15 bg-black/55 px-3 py-3 text-white outline-none transition focus:border-aqua" value={rawText} onChange={(event) => setRawText(event.target.value)} />
              </div>
              <button className="button" type="submit"><Archive size={18} /> Save memory</button>
            </form>
          </section>

          <section className="grid gap-5">
            <FeatureCard icon={BrainCircuit} title="Anonymized model view" body={latest ? latest.anonymizedText : "Wallets, emails, and payment amounts are masked before model-style analysis."} />
            <FeatureCard icon={Radar} title="14-day pattern mirror" body={mirror} />
            <FeatureCard icon={ShieldCheck} title="Proof ledger" body={latest ? `${latest.title}: ${latest.proofHash}` : "Each saved memory receives a local proof hash for audit-friendly demos."} />
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card stack">
            <div className="row">
              <Search className="text-aqua" />
              <h2 className="text-2xl font-black text-white">Memory index</h2>
            </div>
            <div className="list">
              {entries.slice(0, 5).map((entry) => (
                <article key={entry.id} className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <div className="row justify-between">
                    <h3 className="font-black text-white">{entry.title}</h3>
                    <span className="pill">{entry.lens}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{entry.reflection}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.themes.map((theme) => <span key={theme} className="pill ok">{theme}</span>)}
                  </div>
                  <p className="code mt-3 text-slate-400">{entry.proofHash}</p>
                </article>
              ))}
              {entries.length === 0 && <p className="muted">No memories saved yet.</p>}
            </div>
          </section>

          <section className="card stack">
            <div className="row">
              <MessageSquareText className="text-aqua" />
              <h2 className="text-2xl font-black text-white">Ask local memory</h2>
            </div>
            <div className="field">
              <label>Question</label>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </div>
            <div className="actions">
              <button className="button" type="button" onClick={askMemory}><MessageSquareText size={18} /> Ask</button>
              <button className="button secondary" type="button" onClick={exportVault}><Download size={18} /> Export</button>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <div className="row">
                <FileText className="text-aqua" size={18} />
                <h3 className="font-black text-white">Answer with receipt</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{answer || "Ask a question to retrieve the closest local memory and proof hash."}</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: typeof BrainCircuit; title: string; body: string }) {
  return (
    <section className="card row">
      <div className="grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua">
        <Icon size={22} />
      </div>
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
      </div>
    </section>
  );
}
