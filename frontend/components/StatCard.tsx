import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "aqua" | "violet" | "blue" | "red";
};

const tones = {
  aqua: "border-aqua/25 bg-aqua/10 text-aqua",
  violet: "border-violet/25 bg-violet/10 text-violet-300",
  blue: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  red: "border-red-400/25 bg-red-400/10 text-red-300"
};

export default function StatCard({ label, value, detail, icon: Icon, tone = "aqua" }: StatCardProps) {
  return (
    <div className="card metric">
      <div className={`mb-2 grid h-11 w-11 place-items-center rounded-md border ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p className="text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}
