"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@almedia/ui/components/button";
import { cn } from "@almedia/ui/lib/utils";

interface ThemeToggleProps extends React.ComponentProps<typeof Button> {
  duration?: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ThemeToggle({
  className,
  duration = 400,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const applyTheme = useCallback(
    (nextIsDark: boolean) => {
      setTheme(nextIsDark ? "dark" : "light");
    },
    [setTheme],
  );

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) {
      return;
    }

    const nextIsDark = !isDark;

    const canAnimate =
      typeof document.startViewTransition === "function" && !prefersReducedMotion();

    if (!canAnimate) {
      applyTheme(nextIsDark);
      return;
    }

    await document.startViewTransition(() => {
      flushSync(() => {
        applyTheme(nextIsDark);
      });
    }).ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top),
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }, [applyTheme, duration, isDark]);

  if (!mounted) {
    return (
      <Button
        aria-hidden
        className={cn(className)}
        disabled
        size={size}
        variant={variant}
        {...props}
      />
    );
  }

  return (
    <Button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(className)}
      onClick={toggleTheme}
      ref={buttonRef}
      size={size}
      variant={variant}
      {...props}
    >
      {isDark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
