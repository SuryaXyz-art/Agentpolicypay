import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Providers } from "@/lib/wagmi";

export const metadata: Metadata = {
  title: "Apolo Mind",
  description: "Policy-based payment safety for autonomous AI agents."
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
