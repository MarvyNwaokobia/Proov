"use client";

import { Component, type ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface State { hasError: boolean; }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Proov] client error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", background: "var(--bg, #f0fdf4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "2rem", fontFamily: "system-ui, sans-serif", textAlign: "center",
        }}>
          <div>
            <div style={{ marginBottom: 16 }}><IconAlertTriangle size={52} stroke={1.4} color="var(--accent)" /></div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text, #052e16)", marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: "var(--text2, rgba(5,46,22,.6))", marginBottom: 24, lineHeight: 1.6 }}>
              A temporary error occurred. Tap below to reload.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "11px 28px", borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg, #059669)", color: "#fff",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
