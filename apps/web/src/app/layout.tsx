import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Cortea — Forensic Audit Workspace",
  description: "Offline-first, evidence-backed forensic accounting analysis",
  applicationName: "Cortea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} font-sans`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
