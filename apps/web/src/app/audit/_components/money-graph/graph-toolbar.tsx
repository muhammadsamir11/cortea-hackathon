"use client";

import type { RefObject } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent } from "@almedia/ui/components/card";
import { Input } from "@almedia/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@almedia/ui/components/select";
import { Toggle } from "@almedia/ui/components/toggle";
import { Separator } from "@almedia/ui/components/separator";
import { Focus, Search, ShieldAlert, X } from "lucide-react";
import type { Finding } from "@almedia/forensic/types";
import type { GraphFilters } from "./filter-graph";

export function GraphToolbar({
  filters,
  findings,
  searchRef,
  onChange,
  onClearSelection,
  hasSelection,
}: {
  filters: GraphFilters;
  findings: Finding[];
  searchRef: RefObject<HTMLInputElement | null>;
  onChange: (next: Partial<GraphFilters>) => void;
  onClearSelection: () => void;
  hasSelection: boolean;
}) {
  const { fitView } = useReactFlow();
  const dirty =
    filters.query.trim().length > 0 ||
    filters.minAmount > 0 ||
    filters.riskOnly ||
    filters.findingId !== "all";

  return (
    <Panel position="top-left" className="!m-3 !max-w-[calc(100%-1.5rem)] !border-0 !bg-transparent !p-0 !shadow-none">
      <Card size="sm" className="backdrop-blur-md">
        <CardContent className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.findingId}
            onValueChange={(value) => onChange({ findingId: value })}
          >
            <SelectTrigger size="sm" className="h-8 w-[min(16rem,52vw)] text-[11px]">
              <SelectValue placeholder="Finding scope" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all">All risk flows</SelectItem>
              {findings.map((finding) => (
                <SelectItem key={finding.id} value={finding.id}>
                  {finding.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-[10rem] flex-1 basis-[12rem]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={filters.query}
              onChange={(e) => onChange({ query: e.target.value })}
              placeholder="Search name, IBAN…"
              className="h-8 pl-8 text-[11px]"
              aria-label="Search graph entities"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-muted-foreground" htmlFor="graph-min-amount">
              Min €
            </label>
            <Input
              id="graph-min-amount"
              type="number"
              min={0}
              step={1000}
              value={filters.minAmount || ""}
              onChange={(e) =>
                onChange({ minAmount: Math.max(0, Number(e.target.value) || 0) })
              }
              placeholder="0"
              className="h-8 w-24 text-[11px] tabular-nums"
            />
          </div>

          <Toggle
            size="sm"
            variant="outline"
            pressed={filters.riskOnly}
            onPressedChange={(pressed) => onChange({ riskOnly: pressed })}
            aria-label="Show only open-finding flows"
            className="text-[11px]"
          >
            <ShieldAlert className="size-3.5" />
            Risk only
          </Toggle>

          <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[11px]"
            onClick={() => fitView({ padding: 0.18, duration: 280 })}
          >
            <Focus className="size-3.5" />
            Fit
          </Button>

          {(dirty || hasSelection) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => {
                onChange({
                  findingId: "all",
                  query: "",
                  minAmount: 0,
                  riskOnly: false,
                });
                onClearSelection();
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>
    </Panel>
  );
}
