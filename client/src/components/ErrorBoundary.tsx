/**
 * ErrorBoundary.tsx — runtime error page
 * Design: "Earned Authority" — matches MetFix dark design system
 * Colors: #0A0A0A bg | #C9A96E gold | #EFEFEF text
 */
import { RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

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
        <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#EFEFEF", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div style={{ maxWidth: "640px", width: "100%", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "2.5rem" }}>
              <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
              <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.18em", color: "#C9A96E", textTransform: "uppercase" }}>Unexpected Error</span>
              <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
            </div>

            <h1 style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "clamp(1.75rem, 5vw, 2.5rem)", lineHeight: 1.2, color: "#EFEFEF", marginBottom: "1.25rem" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "rgba(239,239,239,0.7)", marginBottom: "3rem" }}>
              Please reload the page or return to the MetFix home page.
            </p>

            {import.meta.env.DEV && this.state.error?.stack && (
              <pre style={{ textAlign: "left", fontSize: "0.75rem", color: "rgba(239,239,239,0.6)", background: "#151515", padding: "1rem", borderRadius: "4px", overflow: "auto", whiteSpace: "pre-wrap", marginBottom: "2rem" }}>
                {this.state.error.stack}
              </pre>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
                style={{ fontSize: "0.85rem", padding: "0.875rem 2rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <RotateCcw size={14} /> Reload Page
              </button>
              <a
                href="/"
                style={{ fontSize: "0.85rem", padding: "0.875rem 2rem", display: "inline-flex", alignItems: "center", color: "#C9A96E", border: "1px solid #C9A96E", textDecoration: "none" }}
              >
                Back to MetFix
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
