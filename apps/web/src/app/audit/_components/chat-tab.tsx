"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
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
import { BotOff, Send } from "lucide-react";
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

  const suggestions = data.findings
    .slice(0, 3)
    .map((finding) => `Explain the evidence and possible defense for: ${finding.title}`);

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
            <EmptyTitle>Optional AI review is unavailable</EmptyTitle>
            <EmptyDescription>
              The deterministic findings, calculations, evidence navigation, and report remain fully available without a
              provider key.
            </EmptyDescription>
          </EmptyHeader>
          <Alert className="mt-4 text-left">
            <AlertTitle className="text-[11px] uppercase tracking-[0.14em]">Configuration</AlertTitle>
            <AlertDescription className="text-[11px]">
              Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to enable retrieved-evidence chat.
            </AlertDescription>
          </Alert>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyTitle className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Ask
              </EmptyTitle>
              <EmptyDescription>Every claim comes with a clickable citation into the source.</EmptyDescription>
            </EmptyHeader>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  onClick={() => void submit(s)}
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-xs whitespace-normal text-left text-xs"
                >
                  {s}
                </Button>
              ))}
            </div>
          </Empty>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            align={m.role === "user" ? "end" : "start"}
            variant={m.role === "user" ? "default" : "secondary"}
            className="max-w-[85%]"
          >
            <BubbleContent>
              {m.parts.map((p, i) =>
                p.type === "text" ? <RichText key={i} text={p.text} data={data} onView={onView} /> : null,
              )}
            </BubbleContent>
          </Bubble>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" /> investigating…
          </p>
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
            placeholder="e.g. show every payment to an account not named in any contract…"
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
