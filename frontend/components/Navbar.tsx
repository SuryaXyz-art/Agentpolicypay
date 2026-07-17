"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Archive, Bot, BrainCircuit, LayoutDashboard, ReceiptText, ShieldPlus } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mind-vault", label: "Mind Vault", icon: Archive },
  { href: "/create-policy", label: "Policy", icon: ShieldPlus },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/pay-research", label: "Pay Research", icon: BrainCircuit },
  { href: "/receipts", label: "Receipts", icon: ReceiptText }
];

export default function Navbar() {
  return (
    <header className="band">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Image src="/apolo-mind-logo.png" alt="Apolo Mind logo" width={40} height={40} className="h-full w-full object-cover" priority />
          </span>
          <span>Apolo Mind</span>
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

