"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Alert, AlertDescription, AlertTitle } from "@almedia/ui/components/alert";
import { Bubble, BubbleContent } from "@almedia/ui/components/bubble";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@almedia/ui/components/input-group";
import { Spinner } from "@almedia/ui/components/spinner";
import { cn } from "@almedia/ui/lib/utils";
import { ArrowRight, BotOff, Send } from "lucide-react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { CitationChip } from "./components";

const CITE_RE = /\[cite:([^|\]]+)\|([^|\]]+)\|([^\]]*)\]/g;

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

export function ChatTab({
  data,
  onView,
}: {
  data: DossierData;
  onView: (c: Citation) => void;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/audit-chat",
      body: { dossier: data.name },
    }),
  });
  const busy = status === "submitted" || status === "streaming";

  const aiAvailable = (data.meta as { aiAvailable?: boolean } | null)?.aiAvailable === true;

  const suggestions = data.findings.slice(0, 3).map((finding) => ({
    id: finding.id,
    title: finding.title,
    prompt: `Explain the evidence and a possible defense for: ${finding.title}`,
  }));

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    try {
      await sendMessage({ text: trimmed });
      setInput("");
    } catch {
      toast.error("Could not send the question. Check the connection and try again.");
    }
  };

  if (!aiAvailable) {
    return (
      <div className="grid h-full place-items-center p-6">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <BotOff className="size-6 text-muted-foreground" />
            <EmptyTitle>Ask is unavailable</EmptyTitle>
            <EmptyDescription>
              Findings, calculations, evidence, and the report still work without an AI key.
            </EmptyDescription>
          </EmptyHeader>
          <Alert className="mt-4 text-left">
            <AlertTitle className="text-[11px] uppercase tracking-[0.14em]">Setup</AlertTitle>
            <AlertDescription className="text-[11px]">
              Add an OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to turn on chat with source links.
            </AlertDescription>
          </Alert>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-auto mt-auto w-full max-w-xl space-y-4">
            <EmptyHeader className="max-w-none items-start gap-1 text-left">
              <EmptyTitle>Ask</EmptyTitle>
              <EmptyDescription className="text-pretty">
                Answers include links to the source documents.
              </EmptyDescription>
            </EmptyHeader>

            {suggestions.length > 0 && (
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  From open findings
                </p>
                <ul className="overflow-hidden rounded-md border border-border">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      className={cn(index > 0 && "border-t border-border")}
                    >
                      <button
                        type="button"
                        onClick={() => void submit(suggestion.prompt)}
                        disabled={busy}
                        className={cn(
                          "group flex w-full cursor-pointer items-start gap-3 border-l-2 border-transparent px-3 py-3 text-left",
                          "transition-colors duration-150 ease-out",
                          "hover:border-l-primary hover:bg-muted/50",
                          "focus-visible:border-l-primary focus-visible:bg-muted/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          "active:bg-muted/70 disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/55">
                          Explain
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
            )}
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble
                key={m.id}
                align={m.role === "user" ? "end" : "start"}
                variant={m.role === "user" ? "default" : "secondary"}
                className="max-w-[85%]"
              >
                <BubbleContent>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      <RichText key={i} text={p.text} data={data} onView={onView} />
                    ) : null,
                  )}
                </BubbleContent>
              </Bubble>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3" /> Looking up…
              </p>
            )}
          </>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
        className="border-t border-border p-3"
      >
        <InputGroup className="h-10">
          <InputGroupInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. show payments to accounts not named in any contract…"
            className="text-sm"
            disabled={busy}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" disabled={busy || !input.trim()} aria-label="Send question">
              <Send />
              Ask
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

