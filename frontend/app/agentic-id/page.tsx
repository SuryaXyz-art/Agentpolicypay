"use client";

import { FormEvent, useState } from "react";
import { BadgeCheck, Plus, ShieldCheck } from "lucide-react";
import { createAgenticProfile, getAgenticProfiles, type AgenticProfile } from "@/lib/agenticId";
import { defaultAgents, defaultOwner } from "@/lib/policyEngine";

export default function AgenticIdPage() {
  const [profiles, setProfiles] = useState<AgenticProfile[]>(() => getAgenticProfiles());
  const [form, setForm] = useState({
    agentName: "ResearchBot",
    ownerWallet: defaultOwner,
    agentWallet: defaultAgents[0]?.wallet ?? "",
    agentRole: "Research assistant for market intelligence",
    allowedSkills: "research, summarize, request API payments",
    riskCategory: "LOW" as AgenticProfile["riskCategory"],
    metadataUri: "ipfs://agentic-id/researchbot.json",
    verificationStatus: "Demo Verified" as AgenticProfile["verificationStatus"]
  });
  const [success, setSuccess] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = createAgenticProfile({ ...form, allowedSkills: form.allowedSkills.split(",").map((skill) => skill.trim()).filter(Boolean) });
    setProfiles([profile, ...profiles.filter((item) => item.agentWallet.toLowerCase() !== profile.agentWallet.toLowerCase())]);
    setSuccess("Agentic ID profile saved in demo mode. ERC-7857 minting is prepared as a future integration point.");
  }

  return (
    <main className="page">
      <section className="section">
        <div className="stack">
          <div className="eyebrow">Agent Identity Layer</div>
          <h1 className="text-4xl font-black text-white">Agentic ID profiles</h1>
          <p className="lede">Agentic ID can represent verified AI agent ownership and encrypted agent metadata using ERC-7857.</p>
        </div>

        {success && <div className="row rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-200"><ShieldCheck size={18} /><p className="text-sm">{success}</p></div>}

        <div className="grid cols-2">
          <form className="card form" onSubmit={submit}>
            <div className="row"><div className="grid h-11 w-11 place-items-center rounded-md bg-aqua/10 text-aqua"><BadgeCheck size={22} /></div><h2 className="text-2xl font-black text-white">Register Agentic ID profile</h2></div>
            <div className="field"><label>Agent name</label><input value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} /></div>
            <div className="field"><label>Owner wallet</label><input value={form.ownerWallet} onChange={(e) => setForm({ ...form, ownerWallet: e.target.value })} /></div>
            <div className="field"><label>Agent wallet</label><input value={form.agentWallet} onChange={(e) => setForm({ ...form, agentWallet: e.target.value })} /></div>
            <div className="field"><label>Agent role</label><input value={form.agentRole} onChange={(e) => setForm({ ...form, agentRole: e.target.value })} /></div>
            <div className="field"><label>Allowed skills</label><input value={form.allowedSkills} onChange={(e) => setForm({ ...form, allowedSkills: e.target.value })} /></div>
            <div className="field"><label>Risk category</label><select value={form.riskCategory} onChange={(e) => setForm({ ...form, riskCategory: e.target.value as AgenticProfile["riskCategory"] })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
            <div className="field"><label>Metadata URI</label><input value={form.metadataUri} onChange={(e) => setForm({ ...form, metadataUri: e.target.value })} /></div>
            <div className="field"><label>Verification status</label><select value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value as AgenticProfile["verificationStatus"] })}><option>Demo Verified</option><option>Pending</option><option>Unverified</option></select></div>
            <button className="button" type="submit"><Plus size={18} /> Save Agentic ID profile</button>
          </form>

          <div className="stack">
            <div className="card stack border-violet/20 bg-violet/10">
              <h2 className="text-2xl font-black text-white">ERC-7857 integration-ready</h2>
              <p className="text-slate-300 leading-7">This page stores profiles locally for the hackathon demo. Future contract integration can mint or resolve ERC-7857 Agentic ID records, encrypted metadata URIs, and ownership attestations.</p>
            </div>
            {profiles.map((profile) => <div className="card stack" key={profile.id}><div className="row"><span className="pill ok">{profile.verificationStatus}</span><span className={profile.riskCategory === "LOW" ? "pill ok" : profile.riskCategory === "MEDIUM" ? "pill warn" : "pill bad"}>{profile.riskCategory} risk</span></div><h3 className="text-xl font-black text-white">{profile.agentName}</h3><p className="code text-slate-400">{profile.agentWallet}</p><p className="text-slate-300">{profile.agentRole}</p><p className="text-sm text-slate-500">Skills: {profile.allowedSkills.join(", ")}</p><p className="code text-slate-500">Metadata: {profile.metadataUri}</p></div>)}
            {profiles.length === 0 && <div className="card"><p className="muted">No Agentic ID profiles yet.</p></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
