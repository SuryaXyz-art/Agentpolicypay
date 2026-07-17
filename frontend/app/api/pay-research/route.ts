import { NextRequest, NextResponse } from "next/server";

const defaultModel = process.env.NOUS_MODEL ?? "nousresearch/hermes-4-70b";
const defaultBaseUrl = process.env.NOUS_API_BASE_URL ?? "https://inference-api.nousresearch.com/v1";

type PayResearchRequest = {
  topic?: string;
  service?: string;
  budget?: number;
  policy?: string;
  agent?: string;
};

function normalizeRiskLevel(value: unknown) {
  const risk = String(value ?? "MEDIUM").toUpperCase();
  if (risk === "LOW" || risk === "MEDIUM" || risk === "HIGH") {
    return risk;
  }
  return "MEDIUM";
}

function normalizePolicyNotes(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((note) => String(note)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return ["Review the policy, approved agent, receiver allowlist, and receipt requirement before payment."];
}

function fallbackAnalysis(input: PayResearchRequest) {
  const budget = Number(input.budget ?? 0);
  const risk = budget > 5 ? "MEDIUM" : "LOW";
  return {
    provider: "demo-fallback",
    model: "local-rule-summary",
    summary: `Research payment request for ${input.topic || "the selected topic"}. The requested budget is ${budget || 0} 0G for ${input.service || "a research service"}.`,
    paymentRecommendation: budget > 5 ? "Require review before payment." : "Approve if the service is allowlisted and receipt generation is enabled.",
    riskLevel: risk,
    policyNotes: [
      "Check that the agent is approved before allowing payment.",
      "Check that the receiver service is on the allowlist.",
      "Generate a receipt after approval for auditability."
    ]
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PayResearchRequest;
  const apiKey = process.env.NOUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ...fallbackAnalysis(body), warning: "NOUS_API_KEY is not configured, so demo analysis was used." });
  }

  try {
    const response = await fetch(`${defaultBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: defaultModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You analyze autonomous AI agent research payment requests. Return concise JSON with keys summary, paymentRecommendation, riskLevel, policyNotes. Do not use emojis."
          },
          {
            role: "user",
            content: JSON.stringify(body)
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ ...fallbackAnalysis(body), warning: `Nous API request failed: ${response.status} ${detail.slice(0, 180)}` }, { status: 200 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        summary: content || fallbackAnalysis(body).summary,
        paymentRecommendation: "Review the model response before approving payment.",
        riskLevel: "MEDIUM",
        policyNotes: ["The model returned plain text instead of JSON."]
      };
    }

    return NextResponse.json({
      provider: "nous",
      model: defaultModel,
      summary: String(parsed.summary ?? fallbackAnalysis(body).summary),
      paymentRecommendation: String(parsed.paymentRecommendation ?? "Review before approving payment."),
      riskLevel: normalizeRiskLevel(parsed.riskLevel),
      policyNotes: normalizePolicyNotes(parsed.policyNotes)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Nous API error.";
    return NextResponse.json({ ...fallbackAnalysis(body), warning: message }, { status: 200 });
  }
}
