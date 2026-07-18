"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEveAgent } from "eve/react";
import { Alert, AlertDescription, AlertTitle } from "@almedia/ui/components/alert";
import { Badge } from "@almedia/ui/components/badge";
import { Bubble, BubbleContent } from "@almedia/ui/components/bubble";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { Spinner } from "@almedia/ui/components/spinner";
import { BotOff, Gavel, Scale } from "lucide-react";
import { toast } from "sonner";

import type { Finding } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { verdictOf } from "./components";

const CONVENE_MESSAGE =
  "Start the review. Go through every finding one at a time, following your protocol.";

interface InputRequest {
  requestId: string;
  prompt: string;
  allowFreeform?: boolean;
  options?: Array<{ id: string; label: string; description?: string }>;
}

interface ToolPart {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  toolMetadata?: { eve?: { inputRequest?: InputRequest } };
}

const VERDICT_BADGE: Record<string, "destructive" | "success" | "warning" | "outline"> = {
  confirmed: "destructive",
  acquitted: "success",
  "needs-judgment": "warning",
  unreviewed: "outline",
};

const VERDICT_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  acquitted: "Cleared",
  "needs-judgment": "Needs review",
  unreviewed: "Not reviewed",
};

const RULING_BUTTON: Record<string, "destructive" | "outline" | "secondary"> = {
  "Confirm finding": "destructive",
  Acquit: "outline",
  "Needs judgment": "secondary",
};

function DocketCard({ finding }: { finding: Finding }) {
  const verdict = verdictOf(finding);
  return (
    <Card className="py-3">
      <CardContent className="space-y-1.5 px-3">
        <p className="line-clamp-2 min-h-8 text-xs font-medium leading-4">{finding.title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {finding.amountInvolved != null
              ? `EUR ${finding.amountInvolved.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "—"}
          </span>
          <Badge variant={VERDICT_BADGE[verdict] ?? "outline"} className="text-[10px]">
            {VERDICT_LABEL[verdict] ?? verdict}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function toolSummary(part: ToolPart): string | null {
  const name = part.toolName ?? "";
  if (name === "list_findings") return "Loading findings…";
  if (name === "search_evidence") {
    const query = (part.input as { query?: string } | undefined)?.query;
    const total = (part.output as { totalMatches?: number } | undefined)?.totalMatches;
    const suffix =
      typeof total === "number" ? ` — ${total} match${total === 1 ? "" : "es"}` : "…";
    return `Searching evidence${query ? `: “${query}”` : ""}${suffix}`;
  }
  if (name === "record_verdict") {
    const verdict = (part.input as { verdict?: string } | undefined)?.verdict;
    return verdict
      ? `Verdict saved: ${verdict}.`
      : "Verdict saved.";
  }
  return null;
}

export function TribunalTab({ data }: { data: DossierData }) {
  const router = useRouter();
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const agent = useEveAgent({
    onEvent: (event) => {
      const e = event as { type?: string; data?: { result?: { toolName?: string } } };
      if (e.type === "action.result" && e.data?.result?.toolName === "record_verdict") {
        router.refresh();
      }
    },
    onFinish: () => router.refresh(),
    onError: (error) => toast.error(error.message),
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;
  const aiAvailable = (data.meta as { aiAvailable?: boolean } | null)?.aiAvailable === true;

  const convene = async () => {
    if (busy) return;
    try {
      if (agent.session) agent.reset();
      await agent.send({ message: `[DOSSIER:${data.name}]\n${CONVENE_MESSAGE}` });
    } catch {
      toast.error("Could not start the review. Check the connection and try again.");
    }
  };

  const respond = async (requestId: string, optionId: string) => {
    setAnswered((prev) => new Set(prev).add(requestId));
    try {
      await agent.send({ inputResponses: [{ requestId, optionId }] });
    } catch {
      toast.error("Could not save your decision. Try again.");
      setAnswered((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (!aiAvailable) {
    return (
      <div className="grid h-full place-items-center p-6">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <BotOff className="size-6 text-muted-foreground" />
            <EmptyTitle>Review assistant is unavailable</EmptyTitle>
            <EmptyDescription>
              Add an OPENAI_API_KEY to start the review. Findings still work without an AI key.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Findings to review · {data.findings.length}
            </span>
          </div>
          <Button onClick={() => void convene()} disabled={busy} size="sm">
            {busy ? <Spinner /> : <Gavel />}
            {busy ? "Reviewing…" : messages.length ? "Start review again" : "Start review"}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.findings.map((finding) => (
            <DocketCard key={finding.id} finding={finding} />
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <Gavel className="size-6 text-muted-foreground" />
              <EmptyTitle className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Review
              </EmptyTitle>
              <EmptyDescription>
                Finding something is not the same as deciding it. Each finding gets a defense; hard
                calls come to you. Your decisions are saved to the audit file.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <p key={message.id} className="text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                — Review started —
              </p>
            );
          }
          return (
            <div key={message.id} className="space-y-2">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  const text = (part as { text: string }).text;
                  if (!text.trim()) return null;
                  return (
                    <Bubble key={index} align="start" variant="secondary" className="max-w-[85%]">
                      <BubbleContent>
                        <span className="whitespace-pre-wrap">{text}</span>
                      </BubbleContent>
                    </Bubble>
                  );
                }
                if (part.type === "dynamic-tool") {
                  const toolPart = part as unknown as ToolPart;
                  const request = toolPart.toolMetadata?.eve?.inputRequest;
                  if (request) {
                    const done = answered.has(request.requestId);
                    return (
                      <Alert key={index} variant={done ? "default" : "destructive"} className="max-w-2xl">
                        <Gavel />
                        <AlertTitle className="text-[11px] uppercase tracking-[0.14em]">
                          {done ? "Decision saved" : "Your decision is needed"}
                        </AlertTitle>
                        <AlertDescription className="space-y-3">
                          <span className="block text-sm text-foreground">{request.prompt}</span>
                          {!done && (
                            <span className="flex flex-wrap gap-2">
                              {(request.options ?? []).map((option) => (
                                <Button
                                  key={option.id}
                                  size="sm"
                                  variant={RULING_BUTTON[option.label] ?? "outline"}
                                  disabled={busy}
                                  onClick={() => void respond(request.requestId, option.id)}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  const summary = toolSummary(toolPart);
                  if (!summary) return null;
                  return (
                    <p key={index} className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-primary" aria-hidden />
                      {summary}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          );
        })}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" /> Thinking…
          </p>
        )}
      </div>
    </div>
  );
}
