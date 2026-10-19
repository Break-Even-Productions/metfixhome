/**
 * NotFound.tsx — 404 page
 * Design: "Earned Authority" — matches MetFix dark design system
 * Colors: #0A0A0A bg | #C9A96E gold | #EFEFEF text
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function NotFound() {
  usePageMeta({
    title: "Page Not Found — MetFix",
    description: "This page could not be found. Return to MetFix for metabolic health affiliation, courses, and seminars.",
    robots: "noindex, follow",
  });
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#EFEFEF", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: "640px", width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "2.5rem" }}>
          <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
          <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.18em", color: "#C9A96E", textTransform: "uppercase" }}>Error 404</span>
          <div style={{ width: "2rem", height: "1px", background: "#C9A96E" }} />
        </div>

        <h1 style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "clamp(1.75rem, 5vw, 2.5rem)", lineHeight: 1.2, color: "#EFEFEF", marginBottom: "1.25rem" }}>
          We couldn't find that page
        </h1>
        <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "rgba(239,239,239,0.7)", marginBottom: "3rem" }}>
          The page you're looking for may have moved or no longer exists.
        </p>

        <Link href="/" className="btn-primary" style={{ fontSize: "0.85rem", padding: "0.875rem 2rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          Back to MetFix <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
