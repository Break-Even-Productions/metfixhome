/**
 * Posts index — unavailable stub. No fetch, no list, no detail routes.
 */
import { usePageMeta } from "@/hooks/usePageMeta";

const UNAVAILABLE_COPY =
  "Posts are unavailable right now. This page does not load an archive or invent articles to fill the gap.";

export default function PostsPage() {
  usePageMeta({
    title: "Posts — MetFix",
    description: "MetFix posts are unavailable right now.",
    robots: "noindex, follow",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#EFEFEF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6rem 2rem 3rem",
      }}
    >
      <div style={{ maxWidth: "40rem", width: "100%", textAlign: "center" }} role="status">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
          <span
            style={{
              fontFamily: "'DM Mono'",
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
              color: "#C9A96E",
              textTransform: "uppercase",
            }}
          >
            Posts
          </span>
          <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display'",
            fontWeight: 700,
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
            lineHeight: 1.2,
            color: "#EFEFEF",
            marginBottom: "1.25rem",
          }}
        >
          Posts are unavailable
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans'",
            fontSize: "1.05rem",
            lineHeight: 1.6,
            color: "rgba(239,239,239,0.72)",
            margin: 0,
          }}
        >
          {UNAVAILABLE_COPY}
        </p>
      </div>
    </main>
  );
}
