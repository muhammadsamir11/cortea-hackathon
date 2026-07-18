"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEveAgent } from "eve/react";
import { Alert, AlertDescription, AlertTitle } from "@almedia/ui/components/alert";
import { Bubble, BubbleContent } from "@almedia/ui/components/bubble";
import { Button } from "@almedia/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@almedia/ui/components/input-group";
import { Spinner } from "@almedia/ui/components/spinner";
import { cn } from "@almedia/ui/lib/utils";
import { ArrowRight, BotOff, FilePlus2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { CitationChip } from "./components";

const CITE_RE = /\[cite:([^|\]]+)\|([^|\]]+)\|([^\]]*)\]/g;
const STORAGE_PREFIX = "cortea-investigator:";

interface InputRequest {
  requestId: string;
  prompt?: string;
  display?: "confirmation" | "select" | "text";
  options?: Array<{ id: string; label: string; description?: string }>;
  action?: { toolName?: string; input?: Record<string, unknown> };
}

interface ToolPart {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  toolMetadata?: { eve?: { inputRequest?: InputRequest } };
}

interface SavedThread {
  events?: unknown[];
  session?: unknown;
}

function RichText({
  text,
  data,
  onView,
}: {
  text: string;
  data: DossierData;
  onView: (c: Citation) => void;
}) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(CITE_RE);
  while ((m = re.exec(text))) {
    out.push(text.slice(last, m.index));
    out.push(
      <CitationChip
        key={m.index}
        citation={{ docId: m[1]!.trim(), ref: m[2]!.trim(), quote: m[3]!.trim() }}
        docs={data.docs}
        onView={onView}
      />,
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <span className="whitespace-pre-wrap">{out}</span>;
}

function toolSummary(part: ToolPart): string | null {
  const name = part.toolName ?? "";
  if (name === "list_findings") return "Reading the engine's findings…";
  if (name === "list_documents") return "Scanning the document inventory…";
  if (name === "search_evidence") {
    const query = (part.input as { query?: string } | undefined)?.query;
    const total = (part.output as { totalMatches?: number } | undefined)?.totalMatches;
    const suffix =
      typeof total === "number" ? ` — ${total} match${total === 1 ? "" : "es"}` : "…";
    return `Searching evidence${query ? `: “${query}”` : ""}${suffix}`;
  }
  if (name === "propose_finding") {
    const output = part.output as { ok?: boolean; findingId?: string } | undefined;
    if (output?.ok) return "Finding recorded in the audit file.";
    if (output && output.ok === false) return "Proposed finding was not recorded.";
    return null;
  }
  return null;
}

function loadSaved(key: string): SavedThread {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as SavedThread;
  } catch {
    return {};
  }
}

function suggestionList(data: DossierData) {
  return [
    {
      id: "probe-same-user",
      label: "Probe",
      title: "Which vendors were created and paid by the same user?",
      prompt: "Which vendors were created and paid by the same user?",
    },
    ...data.findings.slice(0, 2).map((finding) => ({
      id: finding.id,
      label: "Dig deeper",
      title: finding.title,
      prompt: `Dig deeper into: ${finding.title}`,
    })),
  ];
}

function EmptyThread({
  data,
  busy,
  onPrompt,
}: {
  data: DossierData;
  busy: boolean;
  onPrompt: (prompt: string) => void;
}) {
  const suggestions = suggestionList(data);
  return (
    <div className="mx-auto mt-auto w-full max-w-xl space-y-4">
      <EmptyHeader className="max-w-none items-start gap-1 text-left">
        <EmptyTitle>Investigator</EmptyTitle>
        <EmptyDescription className="text-pretty">
          Search the evidence, cite every claim, and record findings — with your approval. Threads
          are saved so you can resume later.
        </EmptyDescription>
      </EmptyHeader>

      <div className="space-y-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Start from here
        </p>
        <ul className="overflow-hidden rounded-md border border-border">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} className={cn(index > 0 && "border-t border-border")}>
              <button
                type="button"
                onClick={() => onPrompt(suggestion.prompt)}
                disabled={busy}
                className={cn(
                  "group flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left",
                  "transition-colors duration-150 ease-out",
                  "hover:bg-muted/50",
                  "focus-visible:bg-muted/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  "active:bg-muted/70 disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/55">
                  {suggestion.label}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-foreground/90 group-hover:text-foreground">
                  {suggestion.title}
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Composer({
  input,
  setInput,
  busy,
  canClear,
  onClear,
  onSubmit,
}: {
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  canClear: boolean;
  onClear: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="border-t border-border p-3"
    >
      <InputGroup className="h-10">
        <InputGroupInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. trace every payment to an account not named in any contract…"
          className="text-sm"
          disabled={busy}
        />
        <InputGroupAddon align="inline-end">
          {canClear ? (
            <InputGroupButton
              type="button"
              variant="ghost"
              aria-label="Start a new thread"
              onClick={onClear}
              disabled={busy}
            >
              <Trash2 />
            </InputGroupButton>
          ) : null}
          <InputGroupButton type="submit" disabled={busy || !input.trim()} aria-label="Send question">
            <Send />
            Ask
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

function InvestigatorThread({
  data,
  onView,
  storageKey,
  saved,
}: {
  data: DossierData;
  onView: (c: Citation) => void;
  storageKey: string;
  saved: SavedThread;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const agent = useEveAgent({
    initialEvents: (saved.events ?? []) as never[],
    initialSession: saved.session as never,
    onFinish(snapshot: { events: unknown[]; session: unknown }) {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ events: snapshot.events, session: snapshot.session }),
        );
      } catch {
        /* storage full or unavailable — the thread just won't persist */
      }
    },
    onEvent: (event: unknown) => {
      const e = event as { type?: string; data?: { result?: { toolName?: string } } };
      if (e.type === "action.result" && e.data?.result?.toolName === "propose_finding") {
        router.refresh();
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    try {
      await agent.send({ message: trimmed });
    } catch {
      toast.error("Could not send the question. Check the connection and try again.");
    }
  };

  const respond = async (requestId: string, optionId: string) => {
    setAnswered((prev) => new Set(prev).add(requestId));
    try {
      await agent.send({ inputResponses: [{ requestId, optionId }] });
    } catch {
      toast.error("Could not deliver the decision. Try again.");
      setAnswered((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const clearThread = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    agent.reset();
    setAnswered(new Set());
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyThread data={data} busy={busy} onPrompt={(prompt) => void submit(prompt)} />
        ) : null}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <Bubble key={message.id} align="end" variant="default" className="max-w-[85%]">
                <BubbleContent>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <span key={index} className="whitespace-pre-wrap">
                        {(part as { text: string }).text}
                      </span>
                    ) : null,
                  )}
                </BubbleContent>
              </Bubble>
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
                        <RichText text={text} data={data} onView={onView} />
                      </BubbleContent>
                    </Bubble>
                  );
                }
                if (part.type === "dynamic-tool") {
                  const toolPart = part as unknown as ToolPart;
                  const request = toolPart.toolMetadata?.eve?.inputRequest;
                  if (request) {
                    const done = answered.has(request.requestId);
                    const proposal = (request.action?.input ?? toolPart.input) as
                      | { title?: string; severity?: string; amountInvolved?: number | null }
                      | undefined;
                    const isProposal =
                      (request.action?.toolName ?? toolPart.toolName) === "propose_finding";
                    return (
                      <Alert
                        key={index}
                        variant={done ? "default" : "destructive"}
                        className="max-w-2xl"
                      >
                        <FilePlus2 />
                        <AlertTitle className="text-[11px] uppercase tracking-[0.14em]">
                          {done
                            ? "Decision delivered"
                            : isProposal
                              ? "The investigator wants to record a finding"
                              : "Your decision is required"}
                        </AlertTitle>
                        <AlertDescription className="space-y-3">
                          <span className="block text-sm text-foreground">
                            {isProposal && proposal?.title
                              ? `“${proposal.title}” (${proposal.severity ?? "?"}${
                                  proposal.amountInvolved != null
                                    ? ` · EUR ${proposal.amountInvolved.toLocaleString("en-US")}`
                                    : ""
                                }) — record it in the audit file?`
                              : (request.prompt ?? "Approve this action?")}
                          </span>
                          {!done && (
                            <span className="flex flex-wrap gap-2">
                              {(request.options ?? []).map((option) => (
                                <Button
                                  key={option.id}
                                  size="sm"
                                  variant={option.id === "approve" ? "default" : "outline"}
                                  disabled={busy}
                                  onClick={() => void respond(request.requestId, option.id)}
                                >
                                  {isProposal
                                    ? option.id === "approve"
                                      ? "Record finding"
                                      : "Reject"
                                    : option.label}
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
                    <p
                      key={index}
                      className="flex items-center gap-2 pl-1 text-xs text-muted-foreground"
                    >
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
            <Spinner className="size-3" /> investigating…
          </p>
        )}
      </div>

      <Composer
        input={input}
        setInput={setInput}
        busy={busy}
        canClear={messages.length > 0}
        onClear={clearThread}
        onSubmit={() => void submit(input)}
      />
    </div>
  );
}

export function InvestigatorTab({
  data,
  onView,
}: {
  data: DossierData;
  onView: (c: Citation) => void;
}) {
  const storageKey = `${STORAGE_PREFIX}${data.name}`;
  // localStorage is unavailable during SSR — restore only after mount so the
  // first client paint matches the server (empty thread), then hydrate.
  const [saved, setSaved] = useState<SavedThread | null>(null);

  useEffect(() => {
    setSaved(loadSaved(storageKey));
  }, [storageKey]);

  const aiAvailable = (data.meta as { aiAvailable?: boolean } | null)?.aiAvailable === true;

  if (!aiAvailable) {
    return (
      <div className="grid h-full place-items-center p-6">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <BotOff className="size-6 text-muted-foreground" />
            <EmptyTitle>The investigator is unavailable</EmptyTitle>
            <EmptyDescription>
              Add an OPENAI_API_KEY to investigate the dossier. Findings still work without an AI
              key.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (saved === null) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-4">
          <EmptyThread data={data} busy onPrompt={() => {}} />
        </div>
        <Composer
          input=""
          setInput={() => {}}
          busy
          canClear={false}
          onClear={() => {}}
          onSubmit={() => {}}
        />
      </div>
    );
  }

  return (
    <InvestigatorThread
      key={storageKey}
      data={data}
      onView={onView}
      storageKey={storageKey}
      saved={saved}
    />
  );
}
