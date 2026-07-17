export type MindLens = "Policy Mirror" | "Pattern Finder" | "Risk Coach" | "Payment Prep";

export type MindEntry = {
  id: string;
  createdAt: string;
  title: string;
  rawText: string;
  anonymizedText: string;
  lens: MindLens;
  themes: string[];
  reflection: string;
  proofHash: string;
};

const themeWords = [
  "policy",
  "agent",
  "payment",
  "risk",
  "receipt",
  "research",
  "service",
  "budget",
  "wallet",
  "identity"
];

export function anonymizeForModel(text: string) {
  return text
    .replace(/0x[a-fA-F0-9]{40}/g, "[wallet-address]")
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\b\d+(\.\d+)?\s?(0G|ETH|USDC|USD|\$)\b/gi, "[amount]")
    .trim();
}

export function extractThemes(text: string) {
  const lower = text.toLowerCase();
  const matches = themeWords.filter((word) => lower.includes(word));
  return matches.length > 0 ? matches.slice(0, 5) : ["agent safety"];
}

export function createReflection(text: string, lens: MindLens) {
  const themes = extractThemes(text);
  const topic = themes.slice(0, 3).join(", ");

  if (lens === "Policy Mirror") {
    return `This note points to ${topic}. Review whether the agent has clear limits, an allowed receiver, and a receipt path before any payment is made.`;
  }

  if (lens === "Pattern Finder") {
    return `The recurring pattern is ${topic}. Keep these items visible in the memory index so future payment reviews can reference prior context.`;
  }

  if (lens === "Risk Coach") {
    return `The risk surface is ${topic}. Ask for a stronger reason, confirm receiver trust, and require proof when the budget is close to policy limits.`;
  }

  return `This looks ready for a payment-prep review. Convert the note into a clear reason, attach policy context, and store the final receipt hash.`;
}

export function proofHash(payload: unknown) {
  const text = JSON.stringify(payload);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createMindEntry(input: { title: string; rawText: string; lens: MindLens }): MindEntry {
  const createdAt = new Date().toISOString();
  const anonymizedText = anonymizeForModel(input.rawText);
  const themes = extractThemes(input.rawText);
  const reflection = createReflection(anonymizedText, input.lens);
  const base = {
    createdAt,
    title: input.title.trim() || "Untitled memory",
    anonymizedText,
    lens: input.lens,
    themes,
    reflection
  };

  return {
    id: `mind-${createdAt}-${Math.random().toString(16).slice(2)}`,
    rawText: input.rawText,
    proofHash: proofHash(base),
    ...base
  };
}

export function buildMirror(entries: MindEntry[]) {
  if (entries.length === 0) {
    return "Add a few entries to reveal repeated agent, policy, service, and budget patterns.";
  }

  const counts = new Map<string, number>();
  entries.forEach((entry) => entry.themes.forEach((theme) => counts.set(theme, (counts.get(theme) ?? 0) + 1)));
  const topThemes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([theme]) => theme);

  return `Recent memory points toward ${topThemes.join(", ")}. Use this pattern before approving agent spend or creating new allowlist rules.`;
}

export function answerFromMemory(question: string, entries: MindEntry[]) {
  if (!question.trim()) {
    return "Ask a question about policies, agents, receivers, budgets, or receipts.";
  }

  if (entries.length === 0) {
    return "No private memory is stored yet. Add an entry first.";
  }

  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const match = entries.find((entry) => terms.some((term) => entry.anonymizedText.toLowerCase().includes(term) || entry.themes.includes(term)));

  if (!match) {
    return "I did not find a direct match in the local memory index. Try asking about an agent, policy, service, risk, budget, or receipt.";
  }

  return `Closest memory: ${match.title}. ${match.reflection} Proof: ${match.proofHash}.`;
}
