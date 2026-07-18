"use client";

import Link from "next/link";
import { CorteaLogo } from "./cortea-logo";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header className="relative z-40 flex h-12 shrink-0 items-center border-b border-border bg-background px-3 sm:px-4">
      <Link href="/audit" className="flex min-w-0 items-center" aria-label="Cortea audit workspace">
        <CorteaLogo className="text-foreground" />
      </Link>
      <p className="ml-3 hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
        Forensic workbench
      </p>
      <div className="ml-auto flex items-center gap-1.5">
        <ModeToggle />
      </div>
    </header>
  );
}
