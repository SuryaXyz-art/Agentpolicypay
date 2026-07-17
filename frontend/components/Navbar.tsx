"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BadgeCheck, Bot, LayoutDashboard, PlayCircle, ReceiptText, ShieldPlus, WalletCards } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create-policy", label: "Policy", icon: ShieldPlus },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/agentic-id", label: "Agentic ID", icon: BadgeCheck },
  { href: "/payment-simulator", label: "Simulator", icon: WalletCards },
  { href: "/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/demo", label: "Demo", icon: PlayCircle }
];

export default function Navbar() {
  return (
    <header className="band">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark">AP</span>
          <span>AgentPolicy Pay</span>
        </Link>
        <div className="nav-links">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={label}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </nav>
    </header>
  );
}
