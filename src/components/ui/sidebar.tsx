"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import {
  LayoutDashboard,
  Users,
  FileText,
  ArrowLeftRight,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  GitCompareArrows,
  ClipboardList,
  Shield,
  Sparkles,
  MessageSquare,
  Building2,
  Menu,
  X,
  Loader2,
  BarChart3,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/briefing", label: "Team Briefing", icon: Sparkles, tourId: "nav-briefing" },
  { href: "/scout", label: "AI Scout", icon: MessageSquare },
  { href: "/players", label: "Players", icon: Users },
  { href: "/team", label: "Teams", icon: Building2 },
  { href: "/contracts", label: "Contracts", icon: FileText, tourId: "nav-contracts" },
  { href: "/trade-analyzer", label: "Trade Analyzer", icon: ArrowLeftRight, tourId: "nav-trade" },
  { href: "/league-overview", label: "League Overview", icon: Globe },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/watchlist", label: "Watch Lists", icon: Star, tourId: "nav-watchlist" },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md bg-surface-1 p-2 text-text-muted shadow-md transition-colors hover:bg-surface-2 hover:text-text-secondary lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full flex-col border-r border-border-subtle bg-surface-1 transition-all duration-200",
          // Desktop: normal or collapsed
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[260px] max-lg:shadow-xl",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          // Desktop sizes
          collapsed ? "lg:w-[60px]" : "lg:w-[240px]",
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo + mobile close */}
        <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
            aria-label="Roster Matrix — Go to dashboard"
          >
            <img
              src="/logo.png"
              alt="Roster Matrix"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            {(!collapsed || mobileOpen) && (
              <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-text-primary">
                ROSTER MATRIX
              </span>
            )}
          </Link>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-text-muted transition-colors hover:text-text-secondary lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {(!collapsed || mobileOpen) && <SidebarSearch />}

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Primary">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent-muted text-accent font-medium"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-secondary",
                  collapsed && !mobileOpen && "lg:justify-center lg:px-0",
                )}
                title={collapsed && !mobileOpen ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                {...(item.tourId ? { "data-tour": item.tourId } : {})}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {(!collapsed || mobileOpen) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-border-subtle p-2 lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md py-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounce the query by 250ms
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = trpc.compare.searchPlayers.useQuery(
    { query: debouncedQuery, limit: 6 },
    { enabled: debouncedQuery.length >= 2 },
  );

  const trackMutation = trpc.analytics.track.useMutation();

  // Show dropdown when we have a query
  useEffect(() => {
    setOpen(debouncedQuery.length >= 2);
    if (debouncedQuery.length >= 2) {
      trackMutation.mutate({ eventType: "SEARCH", metadata: { query: debouncedQuery } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(playerId: string) {
    setQuery("");
    setOpen(false);
    router.push(`/players/${playerId}`);
  }

  return (
    <div className="relative border-b border-border-subtle p-3" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-md bg-surface-0 px-2.5 py-1.5">
        {isFetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" aria-hidden="true" />
        ) : (
          <Search className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (debouncedQuery.length >= 2) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder="Search players..."
          aria-label="Search players"
          className="w-full bg-transparent text-data-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border-subtle bg-surface-2 shadow-lg">
          {results && results.length > 0 ? (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-3"
              >
                <PlayerAvatar
                  headshotUrl={p.headshotUrl}
                  nhlApiId={p.nhlApiId}
                  teamAbbrev={p.teamAbbreviation}
                  firstName={p.fullName.split(" ")[0] ?? ""}
                  lastName={p.fullName.split(" ").slice(1).join(" ") || ""}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-data-sm font-medium text-text-primary">
                    {p.fullName}
                  </p>
                  <p className="text-data-xs text-text-muted">
                    {p.position}
                    {p.teamAbbreviation ? ` · ${p.teamAbbreviation}` : ""}
                  </p>
                </div>
              </button>
            ))
          ) : debouncedQuery.length >= 2 && !isFetching ? (
            <p className="px-3 py-4 text-center text-data-sm text-text-muted">
              No players found
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
