"use client";

import { Toaster } from "@almedia/ui/components/sonner";
import { TooltipProvider } from "@almedia/ui/components/tooltip";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={800}>
        {children}
        <Toaster position="bottom-right" closeButton richColors={false} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
