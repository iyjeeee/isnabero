import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@isnabero/ui";
import { useT } from "@/i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
  // resetKey: when this value changes (e.g. the route path) a previously caught error is cleared
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ErrorFallback: functional child so it can use the useT hook (class components can't use hooks)
function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useT();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t("errors.pageTitle")}
      description={error.message || t("app.errorBoundary.unexpected")}
      action={<Button onClick={onRetry}>{t("common.retry")}</Button>}
    />
  );
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
    return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}
