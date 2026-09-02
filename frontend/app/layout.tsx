import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Providers } from "@/lib/wagmi";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Apolo Mind",
  description: "Policy-based payment safety for autonomous AI agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
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
