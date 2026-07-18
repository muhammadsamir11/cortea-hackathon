"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Bubble, BubbleContent } from "@almedia/ui/components/bubble";
import { Button } from "@almedia/ui/components/button";
import { Input } from "@almedia/ui/components/input";
import { BotOff, Loader2, Send } from "lucide-react";
import { DefaultChatTransport } from "ai";
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

  const suggestions = data.findings.slice(0, 3).map((finding) => `Explain the evidence and possible defense for: ${finding.title}`);

  if (!aiAvailable) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-lg rounded-lg border border-amber-500/25 bg-amber-500/5 p-5 text-center">
          <BotOff className="mx-auto size-6 text-amber-400" />
          <p className="mt-3 font-medium">Optional AI review is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">The deterministic findings, calculations, evidence navigation, and report remain fully available without a provider key.</p>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to enable retrieved-evidence chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 py-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ask</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Every claim comes with a clickable citation into the source.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  onClick={() => sendMessage({ text: s })}
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-xs whitespace-normal text-left font-mono text-xs"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
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
                p.type === "text" ? (
                  <RichText key={i} text={p.text} data={data} onView={onView} />
                ) : null,
              )}
            </BubbleContent>
          </Bubble>
        ))}
        {busy && <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> investigating…</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="flex gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. show every payment to an account not named in any contract…"
          className="flex-1 font-mono text-sm"
        />
        <Button
          disabled={busy}
          className="font-mono"
        >
          <Send /> Ask
        </Button>
      </form>
    </div>
  );
}
