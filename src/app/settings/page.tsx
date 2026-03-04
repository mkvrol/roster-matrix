"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import {
  Globe,
  User,
  Bell,
  Monitor,
  Database,
  Check,
  Pencil,
  Copy,
  Key,
} from "lucide-react";

// ── Main page ──

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Account preferences and application configuration"
      />
      <div className="max-w-2xl space-y-4">
        <ProfileSection />
        <TeamAffiliationSection />
        <NotificationsSection />
        <PlaceholderSection
          icon={Monitor}
          title="Display"
          description="Theme, data density, and stat display preferences"
        />
        <ApiKeySection />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Profile Section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ProfileSection() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.settings.getProfile.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      utils.settings.getProfile.invalidate();
      setEditing(false);
      toast({ variant: "success", title: "Profile updated" });
    },
  });

  const changePassword = trpc.settings.changePassword.useMutation({
    onSuccess: () => {
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      toast({ variant: "success", title: "Password updated" });
    },
    onError: (err) => {
      setPasswordError(err.message);
    },
  });

  if (isLoading) return <SectionSkeleton />;
  if (!profile) return null;

  const handleEdit = () => {
    setName(profile.name ?? "");
    setEditing(true);
  };

  const handleSaveProfile = () => {
    updateProfile.mutate({ name });
  };

  const handleSavePassword = () => {
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <User className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-text-primary">Profile</h3>
          <p className="mt-1 text-data-sm text-text-muted">
            Your name, email, and role within the platform
          </p>
        </div>
        {!editing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-data-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        {editing ? (
          <>
            <div className="space-y-1">
              <label className="text-data-xs text-text-muted">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <ProfileField label="Email" value={profile.email} />
            <ProfileField label="Role" value={formatRole(profile.role)} />

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending}
                className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent/90"
              >
                {updateProfile.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded px-4 py-2 text-data-sm text-text-muted transition-colors hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>

            <div className="border-t border-border-subtle pt-3">
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="text-data-sm text-accent transition-colors hover:text-accent/80"
              >
                {showPasswordChange ? "Cancel Password Change" : "Change Password"}
              </button>
              {showPasswordChange && (
                <div className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <label className="text-data-xs text-text-muted">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-data-xs text-text-muted">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-data-xs text-text-muted">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
                    />
                  </div>
                  {passwordError && (
                    <p className="text-data-xs text-red-400">{passwordError}</p>
                  )}
                  <button
                    onClick={handleSavePassword}
                    disabled={changePassword.isPending}
                    className="rounded bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent/90"
                  >
                    {changePassword.isPending ? "Updating…" : "Update Password"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <ProfileField label="Name" value={profile.name ?? "—"} />
            <ProfileField label="Email" value={profile.email} />
            <ProfileField label="Role" value={formatRole(profile.role)} />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-data-sm text-text-muted">{label}</span>
      <span className="font-mono text-data-sm text-text-primary">{value}</span>
    </div>
  );
}

function formatRole(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Team Affiliation Section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TeamAffiliationSection() {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } =
    trpc.settings.getProfile.useQuery();
  const { data: teams, isLoading: teamsLoading } =
    trpc.settings.getTeams.useQuery();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = trpc.settings.updateTeamAffiliation.useMutation({
    onSuccess: () => {
      utils.settings.getProfile.invalidate();
      utils.dashboard.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (error) => {
      toast({ variant: "error", title: "Failed to save", description: error.message });
    },
  });

  const isLoading = profileLoading || teamsLoading;
  if (isLoading) return <SectionSkeleton />;

  const currentTeamId =
    selectedTeamId !== null ? selectedTeamId : (profile?.teamAffiliationId ?? "");

  const hasChange =
    selectedTeamId !== null &&
    selectedTeamId !== (profile?.teamAffiliationId ?? "");

  const handleSave = () => {
    mutation.mutate({ teamId: selectedTeamId || null });
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-text-primary">
            Primary Team
          </h3>
          <p className="mt-1 text-data-sm text-text-muted">
            Set your primary team affiliation to personalize your dashboard,
            highlight your roster in player views, and default the trade
            analyzer to your team.
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border-subtle pt-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-data-xs text-text-muted">
              Team Affiliation
            </label>
            <select
              value={currentTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
            >
              <option value="">No team selected</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbreviation} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChange || mutation.isPending}
            className={cn(
              "flex items-center gap-1.5 rounded px-4 py-2 text-data-sm font-medium transition-colors",
              hasChange
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-surface-2 text-text-muted",
            )}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : mutation.isPending ? (
              "Saving…"
            ) : (
              "Save"
            )}
          </button>
        </div>

        {profile?.teamAffiliation && (
          <p className="mt-2 text-data-xs text-text-muted">
            Currently set to{" "}
            <span className="font-medium text-text-secondary">
              {profile.teamAffiliation.name}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Notifications Section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotificationsSection() {
  const [contractSignings, setContractSignings] = useState(true);
  const [tradeActivity, setTradeActivity] = useState(true);
  const [valueScoreChanges, setValueScoreChanges] = useState(false);
  const [capUpdates, setCapUpdates] = useState(false);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <Bell className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-text-primary">
            Notifications
          </h3>
          <p className="mt-1 text-data-sm text-text-muted">
            Configure alerts for contract signings, trade activity, and cap
            changes
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        <ToggleRow
          label="Contract Signings"
          description="Notify on new signings"
          enabled={contractSignings}
          onToggle={() => setContractSignings(!contractSignings)}
        />
        <ToggleRow
          label="Trade Activity"
          description="Notify on trades"
          enabled={tradeActivity}
          onToggle={() => setTradeActivity(!tradeActivity)}
        />
        <ToggleRow
          label="Value Score Changes"
          description="Notify on significant score changes"
          enabled={valueScoreChanges}
          onToggle={() => setValueScoreChanges(!valueScoreChanges)}
        />
        <ToggleRow
          label="Cap Updates"
          description="Notify on salary cap changes"
          enabled={capUpdates}
          onToggle={() => setCapUpdates(!capUpdates)}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-data-sm text-text-primary">{label}</p>
        <p className="text-data-xs text-text-muted">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${label}`}
        onClick={onToggle}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            enabled ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API Key Management Section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateRandomKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "ci_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

function maskKey(key: string): string {
  if (key.length <= 10) return key;
  return key.slice(0, 3) + "****…****" + key.slice(-4);
}

function ApiKeySection() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handleGenerate = () => {
    const key = generateRandomKey();
    setApiKey(key);
    setCreatedAt(new Date());
    setShowFull(true);
  };

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-text-primary">API Key</h3>
          <p className="mt-1 text-data-sm text-text-muted">
            Manage your API key for programmatic access
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        {apiKey ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded border border-border-subtle bg-surface-2 px-3 py-2">
                <code
                  className="cursor-pointer text-data-sm text-text-primary"
                  onClick={() => setShowFull(!showFull)}
                >
                  {showFull ? apiKey : maskKey(apiKey)}
                </code>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded px-3 py-2 text-data-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            {createdAt && (
              <p className="text-data-xs text-text-muted">
                Created {createdAt.toLocaleDateString()} at{" "}
                {createdAt.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 rounded px-3 py-2 text-data-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
            >
              <Key className="h-3.5 w-3.5" />
              Generate New Key
            </button>
          </>
        ) : (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            <Key className="h-3.5 w-3.5" />
            Generate API Key
          </button>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Placeholder sections (coming soon)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PlaceholderSection({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text-primary">{title}</h3>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-data-xs text-text-muted">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-data-sm text-text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="h-24 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
  );
}
