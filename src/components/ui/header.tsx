"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { NotificationCenter } from "@/components/ui/notification-center";
import { TeamLogo } from "@/components/ui/team-logo";

const seasons = ["2025-26", "2024-25", "2023-24", "2022-23", "2021-22"];

export function Header() {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const seasonRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userRole = session?.user?.role ?? "ANALYST";
  const { data: userTeamId } = trpc.trade.getUserTeam.useQuery();
  const { data: teams } = trpc.trade.getTeams.useQuery();
  const userTeamAbbrev = teams?.find((t) => t.id === userTeamId)?.abbreviation ?? null;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (seasonRef.current && !seasonRef.current.contains(e.target as Node)) {
        setSeasonOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard navigation for dropdowns
  const handleSeasonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setSeasonOpen(false);
  };
  const handleUserKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setUserMenuOpen(false);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-4 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Spacer for mobile hamburger */}
        <div className="w-8 lg:hidden" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <span className="hidden text-data-xs uppercase tracking-widest text-text-muted sm:inline">
            Season
          </span>
          <div className="relative" ref={seasonRef} onKeyDown={handleSeasonKeyDown}>
            <button
              onClick={() => setSeasonOpen(!seasonOpen)}
              aria-expanded={seasonOpen}
              aria-haspopup="listbox"
              aria-label={`Season selector: ${selectedSeason}`}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1 text-data-sm font-medium text-text-primary transition-colors hover:border-border"
            >
              {selectedSeason}
              <ChevronDown className="h-3 w-3 text-text-muted" aria-hidden="true" />
            </button>
            {seasonOpen && (
              <div
                role="listbox"
                aria-label="Select season"
                className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border-subtle bg-surface-2 py-1 shadow-lg"
              >
                {seasons.map((s) => (
                  <button
                    key={s}
                    role="option"
                    aria-selected={s === selectedSeason}
                    onClick={() => {
                      setSelectedSeason(s);
                      setSeasonOpen(false);
                    }}
                    className={cn(
                      "w-full px-2.5 py-1.5 text-left text-data-sm transition-colors hover:bg-surface-3",
                      s === selectedSeason
                        ? "text-accent"
                        : "text-text-secondary",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hidden h-4 w-px bg-border-subtle sm:block" aria-hidden="true" />
        <span className="hidden font-data text-data-xs text-text-muted sm:inline">
          Roster Matrix
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationCenter />
        <div className="hidden h-4 w-px bg-border-subtle sm:block" aria-hidden="true" />
        <div className="relative" ref={userRef} onKeyDown={handleUserKeyDown}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label={`User menu for ${userName}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
          >
            <TeamLogo teamAbbrev={userTeamAbbrev} size="sm" />
            <span className="hidden text-data-sm sm:inline">{userName}</span>
            <span className="hidden rounded bg-surface-3 px-1.5 py-0.5 text-data-xs text-text-muted sm:inline">
              {userRole.charAt(0) + userRole.slice(1).toLowerCase()}
            </span>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
          {userMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border-subtle bg-surface-2 shadow-lg"
            >
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="text-data-sm font-medium text-text-primary">
                  {userName}
                </p>
                <p className="text-data-xs text-text-muted">{userEmail}</p>
                <span className="mt-1 inline-block rounded bg-surface-3 px-1.5 py-0.5 text-data-xs text-text-muted">
                  {userRole.charAt(0) + userRole.slice(1).toLowerCase()}
                </span>
              </div>
              <div className="py-1">
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-data-sm text-text-secondary transition-colors hover:bg-surface-3"
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  Settings
                </button>
                <button
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-data-sm text-text-secondary transition-colors hover:bg-surface-3"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
