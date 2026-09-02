export default function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const className = risk === "low" ? "pill ok" : risk === "medium" ? "pill warn" : "pill bad";
  return <span className={className}>{risk} risk</span>;
}
