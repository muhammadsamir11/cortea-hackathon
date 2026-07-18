"use client";

/**
 * Canvas dot grid that reveals with random delays, then loops a random size shimmer.
 * Inspired by Reverse UI Grid Shimmering Dots:
 * https://reverseui.com/components/grid-shimmering-dots
 */

import { useEffect, useRef } from "react";

import { cn } from "@almedia/ui/lib/utils";

interface Dot {
  color: string;
  /** Random hold before the next pulse cycle starts (0–1 of period). */
  idleRatio: number;
  /** Full loop length in ms for this dot. */
  periodMs: number;
  /** Unique phase offset so the grid never syncs. */
  phase: number;
  x: number;
  y: number;
}

export interface GridShimmeringDotsProps {
  background?: string;
  className?: string;
  colors?: readonly string[];
  dotSize?: number;
  gap?: number;
  height?: string | number;
  opacity?: number;
  speed?: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildDots(
  width: number,
  height: number,
  gap: number,
  colors: readonly string[],
  basePeriodMs: number,
): Dot[] {
  const cols = Math.ceil(width / gap) + 1;
  const rows = Math.ceil(height / gap) + 1;
  const offsetX = (width - (cols - 1) * gap) / 2;
  const offsetY = (height - (rows - 1) * gap) / 2;
  const palette = colors.length > 0 ? colors : ["#525252"];
  const dots: Dot[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      dots.push({
        color: palette[Math.floor(Math.random() * palette.length)] ?? palette[0],
        idleRatio: randomBetween(0.15, 0.45),
        periodMs: basePeriodMs * randomBetween(0.55, 1.7),
        phase: Math.random(),
        x: offsetX + col * gap,
        y: offsetY + row * gap,
      });
    }
  }

  return dots;
}

/** Smooth pulse 0→1→0 across the active portion of a loop. */
function pulseEnvelope(cycle: number, idleRatio: number): number {
  const active = 1 - idleRatio;
  if (cycle >= active || active <= 0) {
    return 0;
  }
  const t = cycle / active;
  return Math.sin(t * Math.PI);
}

function dotDrawState(
  dot: Dot,
  elapsed: number,
  animate: boolean,
  dotSize: number,
  opacity: number,
): { alpha: number; radius: number } | null {
  if (!animate) {
    return { alpha: opacity * 0.45, radius: dotSize * 0.5 };
  }

  const cycle = (elapsed / dot.periodMs + dot.phase) % 1;
  const pulse = pulseEnvelope(cycle, dot.idleRatio);
  if (pulse <= 0.02) {
    return null;
  }

  const sizeMix = 0.25 + 0.75 * pulse;
  return {
    alpha: opacity * (0.2 + 0.8 * pulse),
    radius: dotSize * sizeMix,
  };
}

/** Occasionally re-randomize timing so the field never settles into a pattern. */
function reshuffleDotTiming(dot: Dot, basePeriodMs: number): void {
  dot.phase = Math.random();
  dot.periodMs = basePeriodMs * randomBetween(0.55, 1.7);
  dot.idleRatio = randomBetween(0.15, 0.45);
}

export function GridShimmeringDots({
  gap = 25,
  dotSize = 3.5,
  speed = 80,
  opacity = 1,
  colors = ["#2a2a2a", "#3b3b3b", "#525252"],
  background = "transparent",
  height = "100%",
  className,
}: GridShimmeringDotsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsKey = colors.join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return;
    }

    const palette = colorsKey.split("|").filter(Boolean);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: Dot[] = [];
    let rafId = 0;
    const startTime = performance.now();
    let running = true;
    let inView = true;
    let lastReshuffleAt = startTime;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const basePeriodMs = Math.max(900, 14_000 / Math.max(speed / 18, 0.5));
    const reshuffleEveryMs = basePeriodMs * 2.4;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const heightPx = Math.max(1, Math.floor(rect.height));
      if (width < 2 || heightPx < 2) {
        return;
      }
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(heightPx * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = buildDots(width, heightPx, gap, palette, basePeriodMs);
    };

    const paint = (elapsed: number, animate: boolean) => {
      const width = canvas.width / dpr;
      const heightPx = canvas.height / dpr;
      ctx.clearRect(0, 0, width, heightPx);

      if (background !== "transparent") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, heightPx);
      }

      for (const dot of dots) {
        const state = dotDrawState(dot, elapsed, animate, dotSize, opacity);
        if (!state) {
          continue;
        }

        ctx.beginPath();
        ctx.fillStyle = dot.color;
        ctx.globalAlpha = state.alpha;
        ctx.arc(dot.x, dot.y, state.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const drawFrame = (now: number) => {
      if (!(running && inView)) {
        return;
      }

      if (now - lastReshuffleAt >= reshuffleEveryMs) {
        lastReshuffleAt = now;
        const batch = Math.max(8, Math.floor(dots.length * 0.12));
        for (let i = 0; i < batch; i += 1) {
          const dot = dots[Math.floor(Math.random() * dots.length)];
          if (dot) {
            reshuffleDotTiming(dot, basePeriodMs);
          }
        }
      }

      paint(now - startTime, true);
      rafId = window.requestAnimationFrame(drawFrame);
    };

    resize();

    if (reduced) {
      paint(0, false);
    } else {
      rafId = window.requestAnimationFrame(drawFrame);
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduced) {
        paint(0, false);
      }
    });
    resizeObserver.observe(canvas);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        const nextInView = entry?.isIntersecting ?? true;
        inView = nextInView;
        if (reduced) {
          return;
        }
        if (nextInView && running) {
          window.cancelAnimationFrame(rafId);
          rafId = window.requestAnimationFrame(drawFrame);
        } else {
          window.cancelAnimationFrame(rafId);
        }
      },
      { root: null, threshold: 0 },
    );
    visibilityObserver.observe(canvas);

    return () => {
      running = false;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [background, colorsKey, dotSize, gap, opacity, speed]);

  return (
    <canvas
      aria-hidden
      className={cn("pointer-events-none block size-full", className)}
      ref={canvasRef}
      style={{ height }}
    />
  );
}
