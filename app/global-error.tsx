"use client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 0, backgroundColor: "#0a0a0a", color: "#fafafa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>App crashed</h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1.5rem" }}>
            {error.message || "An unrecoverable error occurred."}
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #3f3f46", backgroundColor: "#18181b", color: "#fafafa", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Reload app
          </button>
        </div>
      </body>
    </html>
  );
}
