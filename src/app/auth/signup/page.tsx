"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Team = {
  id: string;
  name: string;
  abbreviation: string;
};

const ROLES = ["ANALYST", "SCOUT", "VIEWER"] as const;

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("VIEWER");
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/teams")
      .then((res) => res.json())
      .then((data) => setTeams(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, teamId, role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign-in failed. Please sign in manually.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="Roster Matrix"
            className="h-16 w-16 rounded-lg object-cover"
          />
          <span className="text-sm font-semibold tracking-widest text-text-primary">
            ROSTER MATRIX
          </span>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-8">
          <h1 className="mb-6 text-center text-lg font-semibold text-text-primary">
            Create your account
          </h1>

          {error && (
            <div className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-data-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-data-sm text-text-secondary"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-data-sm text-text-secondary"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-data-sm text-text-secondary"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-data-sm text-text-secondary"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="team"
                className="mb-1.5 block text-data-sm text-text-secondary"
              >
                Team affiliation
              </label>
              <select
                id="team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">None</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.abbreviation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-2 block text-data-sm text-text-secondary">
                Role
              </span>
              <div className="flex gap-4">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-1.5 text-data-sm text-text-primary"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="accent-accent"
                    />
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {isLoading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          {/* Link to signin */}
          <p className="mt-6 text-center text-data-sm text-text-muted">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="text-accent transition-colors hover:text-accent/80"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
