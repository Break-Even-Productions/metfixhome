/**
 * NotFound.tsx — 404 page (F1 light cream / ink / gold)
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import "./not-found.css";

export default function NotFound() {
  usePageMeta({
    title: "Page Not Found — MetFix",
    description: "This page could not be found. Return to MetFix for metabolic health affiliation, courses, and seminars.",
    robots: "noindex, follow",
  });
  return (
    <div className="not-found-page">
      <div className="page-stack">
        <div className="section-card">
          <div className="nf-eyebrow">
            <div className="nf-eyebrow-rule" />
            <span className="nf-eyebrow-label">Error 404</span>
            <div className="nf-eyebrow-rule" />
          </div>

          <h1>We couldn't find that page</h1>
          <p className="nf-body">
            The page you're looking for may have moved or no longer exists.
          </p>

          <Link href="/" className="btn-primary nf-cta">
            Back to MetFix <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
