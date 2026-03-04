"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] items-center justify-center bg-surface-0 p-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-muted">
              <AlertTriangle className="h-7 w-7 text-danger" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              Something went wrong
            </h2>
            <p className="text-sm text-text-muted">
              An unexpected error occurred. Try refreshing or contact support if
              the problem persists.
            </p>
            {this.state.error && (
              <pre className="w-full overflow-auto rounded-md border border-border-subtle bg-surface-1 p-3 text-left text-data-xs text-text-muted">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
