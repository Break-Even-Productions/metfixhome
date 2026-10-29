import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  buildLibraryHead,
  isResourceType,
  joinCtaHref,
  RESOURCE_ID_MAX,
  RESOURCE_ID_RE,
  type LibraryDetail,
} from "@shared/library";
import { SafeHtml } from "@/components/SafeHtml";
import { usePageMeta } from "@/hooks/usePageMeta";
import NotFound from "@/pages/NotFound";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useJoinFlowOptional } from "@/contexts/JoinFlowContext";
import { JoinModal } from "./JoinModal";
import { fetchLibraryItem } from "./api";
import "./library.css";

type DetailState =
  | { status: "loading" }
  | { status: "data"; resource: LibraryDetail }
  | { status: "error" }
  | { status: "not_found" };

function parseId(raw: string | undefined): number | null {
  if (raw == null || !RESOURCE_ID_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > RESOURCE_ID_MAX) return null;
  return n;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LibraryDetailPage({
  params: routeParams,
}: {
  params?: { type?: string; id?: string };
}) {
  const hookParams = useParams<{ type?: string; id?: string }>();
  const joinFlow = useJoinFlowOptional();
  const typeRaw = routeParams?.type ?? hookParams.type;
  const id = useMemo(
    () => parseId(routeParams?.id ?? hookParams.id),
    [routeParams?.id, hookParams.id],
  );
  const typeOk = typeRaw != null && isResourceType(typeRaw);

  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [showJoin, setShowJoin] = useState(false);

  const headInput = useMemo(() => {
    if (state.status === "data") {
      return {
        kind: "detail" as const,
        type: state.resource.type,
        id: state.resource.id,
        title: state.resource.title,
        excerpt: state.resource.excerpt,
        permalink: state.resource.permalink,
        image: state.resource.image,
      };
    }
    return { kind: "hub" as const };
  }, [state]);

  const head = buildLibraryHead(headInput);
  usePageMeta({
    title: head.title,
    description: head.description,
    robots: head.robots,
    canonical: head.canonical,
    ogType: head.ogType,
    ogImage: head.ogImage,
    ogUrl: head.ogUrl,
  });

  useEffect(() => {
    if (!typeOk || id == null) {
      setState({ status: "not_found" });
      return;
    }
    if (typeRaw === "daily_fix") {
      // Prefer Daily Fix surface
      window.location.replace("/the-daily-fix");
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const body = await fetchLibraryItem(typeRaw!, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: "data", resource: body.resource });
        if (body.resource.locked) setShowJoin(true);
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [typeOk, typeRaw, id]);

  if (!typeOk || id == null || state.status === "not_found") {
    return <NotFound />;
  }

  if (state.status === "loading") {
    return (
      <div className="library-page">
        <div className="library-reader">
          <p className="library-status">Loading…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="library-page">
        <div className="library-reader">
          <p className="library-status">This resource is temporarily unavailable.</p>
          <Link href="/library" className="library-reader-back">
            ← Back to library
          </Link>
        </div>
      </div>
    );
  }

  const r = state.resource;
  const isPreview = r.access.access === "preview" && !r.locked;

  return (
    <div className="library-page">
      <article className="library-reader">
        <Link href="/library" className="library-reader-back">
          ← Resource Library
        </Link>
        {r.access.is_exclusive || r.access.has_content_access ? (
          <p className="library-card-pro">Professional</p>
        ) : null}
        <h1 className="library-reader-title">{r.title}</h1>
        <div className="library-reader-meta">
          <time dateTime={r.date}>{formatDate(r.date)}</time>
          {r.author ? <> · {r.author}</> : null}
        </div>

        {r.locked ? (
          <div className="library-stub">
            <strong>Members-only</strong>
            Sign in with an entitled MetFix account to read this resource on metfix.org.
            <div className="library-modal-actions" style={{ marginTop: "1rem" }}>
              {joinFlow ? (
                <button
                  type="button"
                  className="library-btn library-btn-gold"
                  onClick={() => joinFlow.openJoinFlow()}
                >
                  Start my free month
                </button>
              ) : (
                <a className="library-btn library-btn-gold" href={joinCtaHref()}>
                  Log in / Join
                </a>
              )}
              <button
                type="button"
                className="library-btn library-btn-ghost"
                onClick={() => setShowJoin(true)}
              >
                Why is this locked?
              </button>
            </div>
            <UpgradePrompt title="Unlock this resource" />
          </div>
        ) : isPreview ? (
          <div className="library-preview-wrap">
            <div className="library-reader-body">
              <SafeHtml html={r.content} />
            </div>
            <div className="library-preview-fade">
              <div className="library-preview-fade-inner">
                <UpgradePrompt
                  title="Continue with MetFix"
                  body="You’re seeing a preview. Join or sign in for the full piece."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="library-reader-body">
            <SafeHtml html={r.content} />
          </div>
        )}
      </article>

      <JoinModal open={showJoin} title={r.title} onClose={() => setShowJoin(false)} />
    </div>
  );
}
