import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Providers } from "@/lib/wagmi";

export const metadata: Metadata = {
  title: "AgentPolicy Pay",
  description: "Spending policy guardrails for AI agent payments on 0G."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
            <Navbar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
