import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@isnabero/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
  // resetKey: when this value changes (e.g. the route path) a previously caught error is cleared
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ErrorBoundary: keeps one crashing page from blanking the whole layout — the sidebar stays usable and the
// person can retry or navigate elsewhere. Wraps the route <Outlet> in AppLayout.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong on this page"
        description={this.state.error.message || "An unexpected error occurred."}
        action={<Button onClick={() => this.setState({ error: null })}>Try again</Button>}
      />
    );
  }
}
