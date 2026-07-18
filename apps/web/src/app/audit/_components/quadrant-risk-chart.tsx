"use client";

import { useId, useMemo } from "react";
import { Card, CardContent } from "@almedia/ui/components/card";
import type { Finding } from "@almedia/forensic/types";
import { verdictOf } from "./components";

const MAX_SCORE = 600;
const WEIGHTS = { high: 75, medium: 35, low: 12 } as const;

function computeRiskScore(findings: Finding[]): number {
  const open = findings.filter((f) => verdictOf(f) !== "acquitted");
  const raw = open.reduce((sum, f) => sum + WEIGHTS[f.severity], 0);
  return Math.min(MAX_SCORE, Math.round(raw));
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/** Upper semicircle arc from startAngle → endAngle (degrees, 180 = left, 0 = right). */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const sweep = startAngle - endAngle;
  const largeArc = sweep <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function RiskGauge({ score }: { score: number }) {
  const gradId = useId().replace(/:/g, "");
  const cx = 160;
  const cy = 148;
  const outerR = 118;
  const innerR = 96;
  const stroke = 16;
  const t = Math.min(1, Math.max(0, score / MAX_SCORE));
  const endAngle = 180 - 180 * t;
  const knob = polar(cx, cy, outerR, endAngle);

  return (
    <div className="relative w-[240px]">
      <svg
        viewBox="0 0 320 175"
        className="block h-auto w-full"
        role="img"
        aria-label={`Risk score ${score}`}
      >
        <defs>
          <linearGradient id={`risk-grad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor="color-mix(in oklch, var(--success) 55%, var(--muted) 45%)"
            />
            <stop
              offset="50%"
              stopColor="color-mix(in oklch, var(--warning) 55%, var(--muted) 45%)"
            />
            <stop
              offset="100%"
              stopColor="color-mix(in oklch, var(--destructive) 68%, var(--muted) 32%)"
            />
          </linearGradient>
        </defs>

        <path
          d={describeArc(cx, cy, outerR, 180, 0)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {t > 0 ? (
          <path
            d={describeArc(cx, cy, outerR, 180, Math.max(endAngle, 0.01))}
            fill="none"
            stroke={`url(#risk-grad-${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ) : null}

        <path
          d={describeArc(cx, cy, innerR, 180, 0)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1.25}
          strokeDasharray="3.5 4.5"
          strokeLinecap="round"
        />

        {t > 0 ? (
          <circle
            cx={knob.x}
            cy={knob.y}
            r={8}
            fill="var(--card)"
            stroke="color-mix(in oklch, var(--warning) 65%, var(--muted) 35%)"
            strokeWidth={3}
          />
        ) : null}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-[42%] flex flex-col items-center">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Risk score
        </span>
        <span className="mt-1 text-3xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {score}
        </span>
      </div>
    </div>
  );
}

export function QuadrantRiskChart({ findings }: { findings: Finding[] }) {
  const score = useMemo(() => computeRiskScore(findings), [findings]);

  return (
    <Card size="sm" className="h-full w-fit">
      <CardContent className="flex min-h-0 flex-1 items-center justify-center">
        <RiskGauge score={score} />
      </CardContent>
    </Card>
  );
}
