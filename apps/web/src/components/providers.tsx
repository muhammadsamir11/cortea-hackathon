"use client";

import { TooltipProvider } from "@almedia/ui/components/tooltip";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
