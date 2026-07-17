export function formatAmount(value: number | string | bigint, symbol = "0G") {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) return `0 ${symbol}`;

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4
  }).format(numeric)} ${symbol}`;
}

export function formatAddress(address: string, start = 6, end = 4) {
  if (!address) return "Not connected";
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
