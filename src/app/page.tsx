"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Value Score Engine",
    description:
      "Proprietary 0–99 scoring system evaluating every NHL contract across production, efficiency, durability, and age curve factors.",
  },
  {
    icon: BarChart3,
    title: "Contract Explorer",
    description:
      "Filter, sort, and analyze every active NHL contract. Compare AAV, term, trade clauses, and projected market value in real time.",
  },
  {
    icon: Shield,
    title: "Cap Space Tracker",
    description:
      "Real-time salary cap tracking with multi-year projections. See cap ceiling forecasts and identify upcoming flexibility windows.",
  },
  {
    icon: Zap,
    title: "Trade Analyzer",
    description:
      "Model trade scenarios with instant cap impact analysis. Evaluate package fairness using value scores and market comps.",
  },
] as const;

const STATS = [
  { value: "800+", label: "Players Scored" },
  { value: "32", label: "Teams Tracked" },
  { value: "4", label: "Seasons of Data" },
  { value: "Real-time", label: "Value Updates" },
] as const;

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      {/* Navigation */}
      <nav className="border-b border-border-subtle bg-surface-0/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Roster Matrix"
              className="h-10 w-10 rounded-md object-cover"
            />
            <span className="text-lg font-semibold tracking-tight">
              Roster Matrix
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/signin"
              className="text-data-sm text-text-muted transition-colors hover:text-text-primary"
            >
              Sign In
            </Link>
            <Link
              href="/demo"
              className="rounded-md bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Know What Every Player{" "}
              <span className="text-accent">Is Worth</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
              The NHL&apos;s most advanced contract value analytics platform.
              Built for General Managers, Agents, and Executives.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/demo"
                className="group flex items-center gap-2 rounded-md bg-accent px-8 py-3 text-base font-semibold text-white transition-all hover:bg-accent-hover"
              >
                Try Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#request-access"
                className="rounded-md border border-border-subtle bg-surface-1 px-8 py-3 text-base font-semibold text-text-primary transition-colors hover:bg-surface-2"
              >
                Request Access
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-mono text-2xl font-bold text-accent sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-data-sm text-text-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border-subtle bg-surface-1/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Every Edge, Quantified
            </h2>
            <p className="mt-4 text-text-secondary">
              Purpose-built analytics that turn raw contract data into
              actionable intelligence.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-lg border border-border-subtle bg-surface-1 p-6 transition-colors hover:border-accent/30"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-accent-muted">
                  <feature.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 leading-relaxed text-text-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / credibility */}
      <section className="border-t border-border-subtle py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the Front Office
            </h2>
            <p className="mt-4 text-text-secondary">
              The same depth of analysis used in professional hockey operations
              — now available to your team.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              "Role-based access control for your entire organization",
              "Real-time notifications on value score changes",
              "Custom watchlists with automated alerts",
              "PDF report generation for meetings and presentations",
              "Multi-season historical trend analysis",
              "Market value calculator with positional comps",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span className="text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request Access */}
      <section
        id="request-access"
        className="border-t border-border-subtle bg-surface-1/50 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Request Access
          </h2>
          <p className="mt-4 text-text-secondary">
            Roster Matrix is currently in private beta. Leave your email and
            we&apos;ll be in touch.
          </p>
          {submitted ? (
            <div className="mt-8 flex items-center justify-center gap-2 rounded-md border border-success/30 bg-success-muted px-6 py-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-medium text-success">
                You&apos;re on the list. We&apos;ll be in touch soon.
              </span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address"
                className="flex-1 rounded-md border border-border-subtle bg-surface-1 px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-md bg-accent px-8 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Request Access
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface-0 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Roster Matrix"
              className="h-6 w-6 rounded object-cover"
            />
            <span className="text-data-sm font-medium">Roster Matrix</span>
          </div>
          <p className="text-data-xs text-text-muted">
            &copy; {new Date().getFullYear()} Roster Matrix. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
