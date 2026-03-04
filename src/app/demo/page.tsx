"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();
  const { status } = useSession();
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }
    if (status === "loading") return;

    // Auto sign-in as demo user
    signIn("credentials", {
      email: "demo@rostermatrix.app",
      password: "demo2025",
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        setError("Demo account not available. Please run the database seed.");
      } else {
        router.replace("/dashboard");
      }
    });
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent text-xl font-bold text-white">
          CV
        </div>
        {error ? (
          <p className="text-data-sm text-danger">{error}</p>
        ) : (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-text-muted border-t-accent" />
            <p className="text-data-sm text-text-muted">Launching demo…</p>
          </>
        )}
      </div>
    </div>
  );
}
