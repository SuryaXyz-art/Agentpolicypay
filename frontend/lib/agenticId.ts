import { loadLocal, saveLocal } from "./localStore";

export type AgenticProfile = {
  id: string;
  agentName: string;
  ownerWallet: string;
  agentWallet: string;
  agentRole: string;
  allowedSkills: string[];
  riskCategory: "LOW" | "MEDIUM" | "HIGH";
  metadataUri: string;
  verificationStatus: "Demo Verified" | "Pending" | "Unverified";
  createdAt: string;
};

export function createAgenticProfile(profile: Omit<AgenticProfile, "id" | "createdAt">) {
  const nextProfile: AgenticProfile = {
    ...profile,
    id: `agentic-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const profiles = loadLocal<AgenticProfile[]>("app.agenticProfiles", []);
  saveLocal("app.agenticProfiles", [nextProfile, ...profiles.filter((item) => item.agentWallet.toLowerCase() !== profile.agentWallet.toLowerCase())]);
  return nextProfile;
}

export function getAgenticProfiles() {
  return loadLocal<AgenticProfile[]>("app.agenticProfiles", []);
}

export function getAgenticProfileForAgent(agentWallet: string) {
  return getAgenticProfiles().find((profile) => profile.agentWallet.toLowerCase() === agentWallet.toLowerCase());
}
