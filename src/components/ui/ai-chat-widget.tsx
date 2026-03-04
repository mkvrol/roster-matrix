"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Bot,
  User,
  ExternalLink,
  Trash2,
  Sparkles,
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
  return `chat-${Date.now()}-${++msgCounter}`;
}

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
  return lines
    .map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) return null;
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={i} className="mb-1 mt-3 text-xs font-semibold text-text-primary">
            {renderInline(trimmed.replace(/^###\s*/, ""))}
          </h4>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={i} className="mb-1 mt-3 text-xs font-bold text-text-primary">
            {renderInline(trimmed.replace(/^##\s*/, ""))}
          </h3>
        );
      }
      if (trimmed.match(/^[-•]\s/)) {
        return (
          <li key={i} className="ml-4 list-disc text-xs text-text-secondary">
            {renderInline(trimmed.replace(/^[-•]\s*/, ""))}
          </li>
        );
      }
      if (trimmed.match(/^\d+\.\s/)) {
        return (
          <li key={i} className="ml-4 list-decimal text-xs text-text-secondary">
            {renderInline(trimmed.replace(/^\d+\.\s*/, ""))}
          </li>
        );
      }
      if (trimmed === "") return <div key={i} className="h-1.5" />;
      return (
        <p key={i} className="text-xs text-text-secondary">
          {renderInline(trimmed)}
        </p>
      );
    })
    .filter(Boolean);
}

// ── Compact player card ──

function MiniPlayerCard({ player }: { player: PlayerCard }) {
  const isGoalie = player.position === "G";
  return (
    <Link
      href={`/players/${player.id}`}
      className="group block rounded border border-border-subtle bg-surface-0 p-2 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <TeamLogo teamAbbrev={player.team} size="sm" />
            <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
              {player.name}
            </span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-text-muted opacity-0 group-hover:opacity-100" />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-data-xs text-text-muted">
            <span>{player.position} · {player.team}</span>
            <span>{fmtAAV(player.aav)}</span>
            {isGoalie ? (
              player.svPct != null && <span>.{Math.round(player.svPct * 1000)} SV%</span>
            ) : (
              player.points != null && <span>{player.points}P</span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded",
            scoreBg(player.valueScore),
          )}
        >
          <span className={cn("text-sm font-bold leading-none", scoreColor(player.valueScore))}>
            {player.valueScore ?? "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Starter suggestions ──

const STARTERS = [
  "Best value centers under $7M",
  "Overpaid defensemen",
  "Top ELC steals",
  "Backup goalies under $2M",
];

// ── Widget ──

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ⌘K shortcut to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const scoutChat = trpc.ai.scoutChat.useMutation({
    onSuccess: (data) => {
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
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `Error: ${error.message}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Auto-scroll
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
        history,
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
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all hover:bg-accent/90 hover:shadow-xl active:scale-95"
          aria-label="Open AI Chat (⌘K)"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-foreground" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[100] flex h-[min(600px,calc(100vh-3rem))] w-[min(400px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-1 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Roster Matrix AI</p>
                <p className="text-[10px] text-text-muted">Player search &amp; analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
                  aria-label="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
                aria-label="Close chat (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                  <MessageSquare className="h-5 w-5 text-accent" />
                </div>
                <p className="mt-3 text-center text-xs text-text-muted">
                  Ask about players, contracts, or trades
                </p>
                <div className="mt-4 flex w-full flex-col gap-1.5">
                  {STARTERS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={scoutChat.isPending}
                      className="rounded-md border border-border-subtle bg-surface-0 px-3 py-2 text-left text-data-xs text-text-secondary transition-colors hover:border-accent/40 hover:bg-surface-2 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2",
                        msg.role === "user"
                          ? "bg-accent text-white"
                          : "border border-border-subtle bg-surface-0",
                      )}
                    >
                      {msg.role === "user" ? (
                        <p className="text-xs">{msg.content}</p>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            {renderMarkdown(msg.content)}
                          </div>
                          {msg.players && msg.players.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {msg.players.map((p) => (
                                <MiniPlayerCard key={p.id} player={p} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {scoutChat.isPending && (
                  <div className="flex gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-lg border border-border-subtle bg-surface-0 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing…
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border-subtle px-3 py-2">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about players…"
                rows={1}
                disabled={scoutChat.isPending}
                className="flex-1 resize-none rounded-md border border-border-subtle bg-surface-0 px-2.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                style={{ maxHeight: "80px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 80)}px`;
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || scoutChat.isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                {scoutChat.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
            <p className="mt-1 text-center text-[9px] text-text-muted">
              ⌘K to toggle · Enter to send
            </p>
          </div>
        </div>
      )}
    </>
  );
}
