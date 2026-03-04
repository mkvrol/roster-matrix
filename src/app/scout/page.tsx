"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { usePageView } from "@/lib/use-track";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  Send,
  Loader2,
  MessageSquare,
  User,
  Bot,
  Shield,
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
} from "lucide-react";

// ── Types ──

interface PlayerCard {
  id: string;
  name: string;
  position: string;
  team: string;
  teamName: string;
  age: number;
  aav: number;
  valueScore: number | null;
  grade: string | null;
  yearsLeft: number;
  expiringContract: boolean;
  hasNTC: boolean;
  hasNMC: boolean;
  gamesPlayed: number;
  goals: number | null;
  assists: number | null;
  points: number | null;
  svPct: number | null;
  gaa: number | null;
  fit: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  players?: PlayerCard[];
  timestamp: Date;
}

// ── Suggested starter questions ──

const STARTER_QUESTIONS = [
  {
    label: "Top-4 RHD under $5M",
    question:
      "I need a top-4 right-handed defenseman under $5M AAV with at least 2 years left on their deal",
  },
  {
    label: "PP specialist winger",
    question:
      "Find me a power play specialist winger who can score 25+ goals and won't cost more than $7M",
  },
  {
    label: "Budget backup goalie",
    question:
      "We need a backup goalie under $2M who can handle 25-30 starts",
  },
  {
    label: "Best value center",
    question:
      "Who's the best value center available for a team trying to win now?",
  },
  {
    label: "Young ELC steals",
    question:
      "Show me the best-performing players still on entry-level contracts",
  },
  {
    label: "Overpaid veterans to avoid",
    question:
      "Which veterans have the worst value scores relative to their AAV?",
  },
];

// ── Helpers ──

function fmtAAV(aav: number): string {
  return `$${(aav / 1_000_000).toFixed(2)}M`;
}

function scoreColor(score: number | null): string {
  if (score == null) return "text-text-muted";
  if (score >= 75) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score == null) return "bg-surface-2";
  if (score >= 75) return "bg-emerald-500/15";
  if (score >= 60) return "bg-sky-500/15";
  if (score >= 45) return "bg-amber-500/15";
  return "bg-red-500/15";
}

let msgCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

// ── Markdown-lite renderer ──
// Handles **bold** and newlines — avoids pulling in a full markdown lib

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={j} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={j}>{part}</span>;
  });
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();

    // Skip code fence lines
    if (trimmed.startsWith("```")) return null;

    // Heading-like lines (## or ###)
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-text-primary">
          {renderInline(trimmed.replace(/^###\s*/, ""))}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="mt-4 mb-1 text-sm font-bold text-text-primary">
          {renderInline(trimmed.replace(/^##\s*/, ""))}
        </h3>
      );
    }

    // Bullet lists
    if (trimmed.match(/^[-•]\s/)) {
      return (
        <li key={i} className="ml-4 list-disc text-sm text-text-secondary">
          {renderInline(trimmed.replace(/^[-•]\s*/, ""))}
        </li>
      );
    }
    // Numbered lists
    if (trimmed.match(/^\d+\.\s/)) {
      return (
        <li key={i} className="ml-4 list-decimal text-sm text-text-secondary">
          {renderInline(trimmed.replace(/^\d+\.\s*/, ""))}
        </li>
      );
    }

    if (trimmed === "") {
      return <div key={i} className="h-2" />;
    }

    return (
      <p key={i} className="text-sm text-text-secondary">
        {renderInline(trimmed)}
      </p>
    );
  }).filter(Boolean);
}

// ── Player recommendation card ──

function PlayerRecommendation({ player }: { player: PlayerCard }) {
  const isGoalie = player.position === "G";

  return (
    <Link
      href={`/players/${player.id}`}
      className="group block rounded-md border border-border-subtle bg-surface-0 p-3 transition-colors hover:border-accent/40 hover:bg-surface-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TeamLogo teamAbbrev={player.team} size="sm" />
            <span className="font-semibold text-text-primary group-hover:text-accent">
              {player.name}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-data-xs text-text-muted">
            <span>{player.position} · {player.team}</span>
            <span>Age {player.age}</span>
            <span>{fmtAAV(player.aav)}</span>
            <span>
              {player.yearsLeft}yr{player.yearsLeft !== 1 ? "s" : ""} left
            </span>
          </div>
        </div>

        {/* Value score badge */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded",
            scoreBg(player.valueScore),
          )}
        >
          <span className={cn("text-lg font-bold leading-none", scoreColor(player.valueScore))}>
            {player.valueScore ?? "—"}
          </span>
          {player.grade && (
            <span className="mt-0.5 text-[9px] uppercase leading-none text-text-muted">
              {player.grade}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-data-xs text-text-muted">
        {isGoalie ? (
          <>
            <span>{player.gamesPlayed} GP</span>
            {player.svPct != null && (
              <span>.{Math.round(player.svPct * 1000)} SV%</span>
            )}
            {player.gaa != null && <span>{player.gaa.toFixed(2)} GAA</span>}
          </>
        ) : (
          <>
            <span>{player.gamesPlayed} GP</span>
            {player.goals != null && <span>{player.goals}G</span>}
            {player.assists != null && <span>{player.assists}A</span>}
            {player.points != null && <span>{player.points}P</span>}
          </>
        )}
      </div>

      {/* Flags */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {player.hasNMC && (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
            <Shield className="h-2.5 w-2.5" /> NMC
          </span>
        )}
        {player.hasNTC && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            <Shield className="h-2.5 w-2.5" /> NTC
          </span>
        )}
        {player.expiringContract && (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
            <Clock className="h-2.5 w-2.5" /> Expiring
          </span>
        )}
      </div>

      {/* Fit explanation */}
      <p className="mt-2 text-data-xs leading-relaxed text-text-muted">
        {player.fit}
      </p>
    </Link>
  );
}

// ── Main page ──

export default function ScoutPage() {
  usePageView("/scout");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scoutChat = trpc.ai.scoutChat.useMutation({
   onSuccess: (data) => {
     // Safety net: if message looks like raw JSON, extract the message field
     let messageText = data.message;
     if (messageText.trim().startsWith("{") || messageText.trim().startsWith("```")) {
       try {
         let cleaned = messageText.trim();
         if (cleaned.startsWith("```")) {
           cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
         }
         const parsed = JSON.parse(cleaned);
         if (parsed.message) messageText = parsed.message;
       } catch {
         // Not JSON, use as-is
       }
     }

     const assistantMsg: ChatMessage = {
       id: nextId(),
       role: "assistant",
       content: messageText,
       players: (data.players ?? []) as PlayerCard[],
       timestamp: new Date(),
     };
     setMessages((prev) => [...prev, assistantMsg]);
     setHistory((prev) => [
       ...prev,
       { role: "assistant" as const, content: data.rawResponse },
     ]);
   },
    onError: (error) => {
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: `I encountered an error processing your request: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, scoutChat.isPending]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || scoutChat.isPending) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const newHistory = [
        ...history,
        { role: "user" as const, content: text.trim() },
      ];
      setHistory(newHistory);

      scoutChat.mutate({
        message: text.trim(),
        history: history, // Send previous history, not including current message
      });

      setInput("");
    },
    [history, scoutChat],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setHistory([]);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <PageHeader
        title="AI Scout"
        subtitle="Describe the player you need — get data-backed recommendations from our database"
        actions={
          messages.length > 0 ? (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-data-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : undefined
        }
      />

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-1 py-4"
      >
        {isEmpty ? (
          /* Empty state with starter questions */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <MessageSquare className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-primary">
              What are you looking for?
            </h2>
            <p className="mt-1 max-w-md text-center text-sm text-text-muted">
              Describe the type of player you need and I&apos;ll search our
              database of 780+ NHL players to find the best fits.
            </p>

            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_QUESTIONS.map((sq) => (
                <button
                  key={sq.label}
                  onClick={() => sendMessage(sq.question)}
                  disabled={scoutChat.isPending}
                  className="rounded-md border border-border-subtle bg-surface-1 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-text-primary">
                    {sq.label}
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-data-xs text-text-muted">
                    {sq.question}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-3",
                    msg.role === "user"
                      ? "bg-accent text-white"
                      : "bg-surface-1 border border-border-subtle",
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <>
                      <div className="space-y-0.5">
                        {renderMarkdown(msg.content)}
                      </div>

                      {/* Player recommendation cards */}
                      {msg.players && msg.players.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-data-xs font-semibold uppercase tracking-wider text-text-muted">
                            Recommendations
                          </h4>
                          {msg.players.map((p) => (
                            <PlayerRecommendation key={p.id} player={p} />
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <span className="mt-1 block text-[10px] opacity-50">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {scoutChat.isPending && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching database and analyzing players…
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border-subtle bg-surface-1 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the player you're looking for…"
              rows={1}
              disabled={scoutChat.isPending}
              className="w-full resize-none rounded-md border border-border-subtle bg-surface-0 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || scoutChat.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:hover:bg-accent"
          >
            {scoutChat.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-text-muted">
          AI Scout searches {" "}
          <span className="font-medium">780+ NHL players</span> in real time.
          Press Enter to send, Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}
