"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleSignIn() {
    signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
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
            Sign in to your account
          </h1>

          {error && (
            <div className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-data-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-data-xs text-text-muted">OR</span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border-subtle bg-surface-2 py-2.5 text-sm text-text-primary transition-colors hover:bg-surface-3"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Demo shortcut */}
          <div className="mt-4 border-t border-border-subtle pt-4">
            <a
              href="/demo"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Try Demo — No Account Needed
            </a>
          </div>

          {/* Link to signup */}
          <p className="mt-6 text-center text-data-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-accent transition-colors hover:text-accent/80"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
