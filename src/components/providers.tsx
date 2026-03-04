"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TourProvider } from "@/components/tour/tour-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function getTRPCErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;
    switch (code) {
      case "UNAUTHORIZED":
        return "Please sign in to continue.";
      case "FORBIDDEN":
        return "You don't have permission to do that.";
      case "NOT_FOUND":
        return "The requested resource was not found.";
      case "TOO_MANY_REQUESTS":
        return "Too many requests. Please try again shortly.";
      default:
        return error.message || "Something went wrong.";
    }
  }
  return "An unexpected error occurred.";
}

function InnerProviders({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const onMutationError = useCallback(
    (error: unknown) => {
      toast({
        variant: "error",
        title: "Error",
        description: getTRPCErrorMessage(error),
      });
    },
    [toast],
  );

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            onError: onMutationError,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <TourProvider>{children}</TourProvider>
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <InnerProviders>{children}</InnerProviders>
      </ToastProvider>
    </ErrorBoundary>
  );
}
