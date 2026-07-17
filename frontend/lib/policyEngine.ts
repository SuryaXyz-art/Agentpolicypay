export type Policy = {
  policyId?: string;
  name?: string;
  owner: string;
  maxPayment: number;
  maxPerTx?: number;
  dailyCap: number;
  dailyLimit?: number;
  approvalThreshold?: number;
  receiptRequired?: boolean;
  spentToday: number;
  allowedReceivers: string[];
  active?: boolean;
  createdAt: string;
  txHash?: string;
  source?: "contract" | "demo";
};

export type AgentType = "Research" | "Trading" | "API Buyer" | "Social Agent" | "Custom";

export type Agent = {
  id: string;
  name: string;
  wallet: string;
  approved: boolean;
  risk: "low" | "medium" | "high";
  type?: AgentType;
  totalSpent?: number;
  txHash?: string;
};

export type ServiceCategory = "API" | "Storage" | "Compute" | "Data" | "SaaS" | "Custom";

export type Service = {
  id: string;
  name: string;
  address: string;
  category: ServiceCategory;
  allowed: boolean;
  txHash?: string;
};

export type PaymentRequest = {
  agentWallet: string;
  receiver: string;
  amount: number;
  memo: string;
};

export type PolicyDecision = {
  approved: boolean;
  reason: string;
};

export type BlockedAttempt = PaymentRequest & {
  id: string;
  reason: string;
  createdAt: string;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type PolicyCheck = {
  label: "Agent approved" | "Receiver allowed" | "Below max per transaction" | "Within daily limit" | "Reason provided";
  passed: boolean;
};

export type PolicyEngineInput = {
  userAddress: string;
  agentAddress: string;
  receiverAddress: string;
  amount: number;
  reason: string;
  selectedPolicy: Policy | null;
  approvedAgents: Array<Agent | string>;
  allowedServices: Array<Service | string>;
  dailySpent: number;
};

export type PolicyEngineResult = {
  allowed: boolean;
  riskLevel: RiskLevel;
  reasons: string[];
  blockedReasons: string[];
  checks: PolicyCheck[];
};

export const defaultOwner = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

export const defaultServices: Service[] = [
  {
    id: "service-compute",
    name: "0G Compute Gateway",
    address: "0x9A676e781A523b5d0C0e43731313A708CB607508",
    category: "Compute",
    allowed: true
  },
  {
    id: "service-storage",
    name: "0G Storage Relay",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    category: "Storage",
    allowed: true
  },
  {
    id: "service-market",
    name: "Unverified Data Market",
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    category: "Data",
    allowed: false
  }
];

export const defaultAgents: Agent[] = [
  { id: "agent-booking", name: "Booking Agent", wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", approved: true, risk: "low", type: "API Buyer", totalSpent: 42 },
  { id: "agent-research", name: "Research Agent", wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", approved: false, risk: "medium", type: "Research", totalSpent: 0 }
];

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function isApprovedAgent(agent: Agent | string, agentAddress: string) {
  if (typeof agent === "string") return sameAddress(agent, agentAddress);
  return agent.approved && sameAddress(agent.wallet, agentAddress);
}

function isAllowedService(service: Service | string, receiverAddress: string) {
  if (typeof service === "string") return sameAddress(service, receiverAddress);
  return service.allowed && sameAddress(service.address, receiverAddress);
}

function policyMaxPerTx(policy: Policy | null) {
  return policy?.maxPerTx ?? policy?.maxPayment ?? 0;
}

function policyDailyLimit(policy: Policy | null) {
  return policy?.dailyLimit ?? policy?.dailyCap ?? 0;
}

export function evaluatePaymentRequest(input: PolicyEngineInput): PolicyEngineResult {
  const maxPerTx = policyMaxPerTx(input.selectedPolicy);
  const dailyLimit = policyDailyLimit(input.selectedPolicy);
  const approvalThreshold = input.selectedPolicy?.approvalThreshold ?? maxPerTx;
  const trimmedReason = input.reason.trim();

  const agentApproved = input.approvedAgents.some((agent) => isApprovedAgent(agent, input.agentAddress));
  const receiverAllowed = input.allowedServices.some((service) => isAllowedService(service, input.receiverAddress));
  const belowMaxPerTransaction = Number.isFinite(input.amount) && input.amount > 0 && input.amount <= maxPerTx;
  const withinDailyLimit = Number.isFinite(input.amount) && input.amount > 0 && input.dailySpent + input.amount <= dailyLimit;
  const reasonProvided = trimmedReason.length > 0;

  const checks: PolicyCheck[] = [
    { label: "Agent approved", passed: agentApproved },
    { label: "Receiver allowed", passed: receiverAllowed },
    { label: "Below max per transaction", passed: belowMaxPerTransaction },
    { label: "Within daily limit", passed: withinDailyLimit },
    { label: "Reason provided", passed: reasonProvided }
  ];

  const blockedReasons: string[] = [];
  if (!input.selectedPolicy) blockedReasons.push("No spending policy selected.");
  if (input.selectedPolicy && input.selectedPolicy.active === false) blockedReasons.push("Selected policy is inactive.");
  if (!agentApproved) blockedReasons.push("Agent is not approved for this user.");
  if (!receiverAllowed) blockedReasons.push("Receiver is not on the allowed services list.");
  if (!belowMaxPerTransaction) blockedReasons.push("Amount exceeds the max spend per transaction.");
  if (!withinDailyLimit) blockedReasons.push("Daily spending limit would be exceeded.");
  if (!reasonProvided) blockedReasons.push("A payment reason is required.");

  const reasons: string[] = [];
  if (agentApproved) reasons.push("Agent is approved.");
  if (receiverAllowed) reasons.push("Receiver is allowed.");
  if (belowMaxPerTransaction) reasons.push("Amount is below the max per-transaction limit.");
  if (withinDailyLimit) reasons.push("Amount fits within the remaining daily limit.");
  if (reasonProvided) reasons.push("Payment reason was provided.");

  const allowed = blockedReasons.length === 0;
  const mediumRisk = allowed && (input.amount > approvalThreshold || trimmedReason.length < 15);
  const riskLevel: RiskLevel = !allowed ? "HIGH" : mediumRisk ? "MEDIUM" : "LOW";

  if (allowed && input.amount > approvalThreshold) {
    reasons.push("Amount is above the approval threshold, so review is recommended.");
  }
  if (allowed && trimmedReason.length < 15) {
    reasons.push("Payment reason is short, so context is limited.");
  }
  if (allowed && riskLevel === "LOW") {
    reasons.push("All checks passed cleanly.");
  }

  return {
    allowed,
    riskLevel,
    reasons,
    blockedReasons,
    checks
  };
}

export function evaluatePayment(policy: Policy | null, agents: Agent[], request: PaymentRequest): PolicyDecision {
  const result = evaluatePaymentRequest({
    userAddress: policy?.owner ?? defaultOwner,
    agentAddress: request.agentWallet,
    receiverAddress: request.receiver,
    amount: request.amount,
    reason: request.memo,
    selectedPolicy: policy,
    approvedAgents: agents,
    allowedServices: policy?.allowedReceivers ?? [],
    dailySpent: policy?.spentToday ?? 0
  });

  return {
    approved: result.allowed,
    reason: result.allowed ? result.reasons.at(-1) ?? "Approved by policy." : result.blockedReasons[0] ?? "Payment blocked."
  };
}

export function serviceNameFor(address: string, services: Service[]) {
  return services.find((service) => service.address.toLowerCase() === address.toLowerCase())?.name ?? "Custom service";
}

/*
Sample usage:

const decision = evaluatePaymentRequest({
  userAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  agentAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  receiverAddress: "0x9A676e781A523b5d0C0e43731313A708CB607508",
  amount: 12,
  reason: "Pay for 0G compute inference",
  selectedPolicy: {
    owner: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    maxPayment: 25,
    maxPerTx: 25,
    dailyCap: 100,
    dailyLimit: 100,
    approvalThreshold: 50,
    spentToday: 20,
    allowedReceivers: [],
    active: true,
    createdAt: new Date().toISOString()
  },
  approvedAgents: ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
  allowedServices: ["0x9A676e781A523b5d0C0e43731313A708CB607508"],
  dailySpent: 20
});

console.log(decision.allowed, decision.riskLevel, decision.checks);
*/

export { loadLocal as loadJson, saveLocal as saveJson } from "./localStore";
