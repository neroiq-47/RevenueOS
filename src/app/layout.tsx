import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "RevenueOS — Recover stalled revenue", template: "%s · RevenueOS" },
  description:
    "Upload your open quotes, spot stale deals, and get AI-drafted follow-ups you approve. $499 per organisation per month.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  );
}
