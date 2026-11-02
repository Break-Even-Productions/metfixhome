/**
 * ErrorBoundary.tsx — runtime error page (F1 light cream / ink / gold)
 */
import { RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import "./error-boundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-page">
          <div className="page-stack">
            <div className="section-card">
              <div className="eb-eyebrow">
                <div className="eb-eyebrow-rule" />
                <span className="eb-eyebrow-label">Unexpected Error</span>
                <div className="eb-eyebrow-rule" />
              </div>

              <h1>Something went wrong</h1>
              <p className="eb-body">
                Please reload the page or return to the MetFix home page.
              </p>

              {import.meta.env.DEV && this.state.error?.stack && (
                <pre className="eb-stack">{this.state.error.stack}</pre>
              )}

              <div className="eb-actions">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-primary eb-cta"
                >
                  <RotateCcw size={14} /> Reload Page
                </button>
                <a href="/" className="eb-ghost">
                  Back to MetFix
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
