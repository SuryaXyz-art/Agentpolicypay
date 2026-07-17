import type { Agent, Policy, Service } from "./policyEngine";

export type RiskAnalysis = {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  warnings: string[];
  recommendedAction: string;
};

type RiskPaymentRequest = {
  agentWallet?: string;
  agentAddress?: string;
  receiver?: string;
  receiverAddress?: string;
  amount: number;
  memo?: string;
  reason?: string;
};

export function analyzePaymentRisk(
  paymentRequest: RiskPaymentRequest,
  policy: Policy | null,
  agentProfile?: Agent | null,
  serviceProfile?: Service | null
): RiskAnalysis {
  const warnings: string[] = [];
  const maxPerTx = policy?.maxPerTx ?? policy?.maxPayment ?? 0;
  const approvalThreshold = policy?.approvalThreshold ?? maxPerTx;
  const dailySpent = policy?.spentToday ?? 0;
  const reason = (paymentRequest.reason ?? paymentRequest.memo ?? "").trim();
  let score = 10;

  if (!serviceProfile) {
    score += 25;
    warnings.push("Unknown service receiver increases payment risk.");
  } else if (!serviceProfile.allowed) {
    score = 95;
    warnings.push("Receiver is blocked and should not be paid.");
  }

  if (!agentProfile) {
    score += 20;
    warnings.push("New or unknown agent has no trusted profile history.");
  } else if (!agentProfile.approved) {
    score += 30;
    warnings.push("Agent is not currently approved.");
  }

  if (maxPerTx > 0 && paymentRequest.amount >= maxPerTx * 0.8) {
    score += 20;
    warnings.push("Amount is near the max per-transaction limit.");
  }

  if (approvalThreshold > 0 && paymentRequest.amount > approvalThreshold) {
    score += 18;
    warnings.push("Amount is above the approval threshold.");
  }

  if (reason.length < 15) {
    score += 14;
    warnings.push("Payment reason is vague or too short.");
  }

  if (dailySpent > 0 && policy?.dailyCap && dailySpent / policy.dailyCap > 0.6) {
    score += 12;
    warnings.push("Repeated spending has consumed much of the daily limit.");
  }

  score = Math.max(0, Math.min(100, score));
  const riskLevel = score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const summary = riskLevel === "LOW"
    ? "This request looks routine for the selected policy, agent, and service."
    : riskLevel === "MEDIUM"
      ? "This request can be reviewed carefully before approval."
      : "This request carries high risk and should be blocked or escalated.";
  const recommendedAction = riskLevel === "LOW" ? "Approve and generate receipt." : riskLevel === "MEDIUM" ? "Require review before payment." : "Block the payment.";

  return { riskScore: score, riskLevel, summary, warnings, recommendedAction };
}
