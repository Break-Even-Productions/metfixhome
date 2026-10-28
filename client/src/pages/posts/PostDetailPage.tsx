/**
 * Post detail — `/posts/:id` (A20). Invalid id → NotFound, no fetch.
 * Imports SafeHtml (DOMPurify); keep this module out of the entry chunk via
 * React.lazy in App.tsx (PX8 / CQ14).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import {
  isPostDetailBody,
  POST_ID_MAX,
  POST_ID_RE,
  type DetailPost,
} from "@shared/posts";
import { BackToTop } from "@/components/BackToTop";
import { SiteFooter } from "@/components/SiteFooter";
import { DetailReader } from "@/components/post-detail/DetailReader";
import { PostReaderSkeleton } from "@/components/post-detail/PostReaderSkeleton";
import { toDetailReaderModel } from "@/components/post-detail/types";
import { SafeHtml } from "@/components/SafeHtml";
import { usePostsPageMeta } from "@/hooks/usePostsPageMeta";
import NotFound from "@/pages/NotFound";
import "@/styles/post-prose.css";
import { PostsError, PostsLayout } from "./PostsLayout";

type DetailState =
  | { status: "loading" }
  | { status: "data"; post: DetailPost }
  | { status: "error" }
  | { status: "not_found" };

function parsePostId(raw: string | undefined): number | null {
  if (raw == null || !POST_ID_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > POST_ID_MAX) return null;
  return n;
}

export default function PostDetailPage({
  params: routeParams,
}: {
  params?: { id?: string };
}) {
  const hookParams = useParams<{ id?: string }>();
  const rawId = routeParams?.id ?? hookParams.id;
  const id = useMemo(() => parsePostId(rawId), [rawId]);

  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  const headInput = useMemo(() => {
    if (state.status === "data") {
      return {
        kind: "detail" as const,
        id: state.post.id,
        title: state.post.title,
        excerpt: state.post.excerpt,
        permalink: state.post.permalink,
        image: state.post.image,
      };
    }
    return { kind: "list" as const };
  }, [state]);

  usePostsPageMeta(headInput);

  useEffect(() => {
    if (id == null) {
      setState({ status: "not_found" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(`/api/posts/${id}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const json: unknown = await res.json();
        if (controller.signal.aborted) return;
        if (!isPostDetailBody(json)) {
          setState({ status: "error" });
          return;
        }
        setState({ status: "data", post: json.post });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [id, retryCount]);

  if (id == null || state.status === "not_found") {
    return <NotFound />;
  }

  const onRetry = () => {
    setRetryCount((n) => n + 1);
  };

  return (
    <>
      <PostsLayout wide={state.status === "data" || state.status === "loading"}>
        {state.status === "loading" ? <PostReaderSkeleton /> : null}
        {state.status === "error" ? <PostsError onRetry={onRetry} /> : null}
        {state.status === "data" ? <DetailBody post={state.post} /> : null}
      </PostsLayout>
      <SiteFooter />
    </>
  );
}

function DetailBody({ post }: { post: DetailPost }) {
  const model = toDetailReaderModel(post);
  return (
    <>
      <DetailReader model={model}>
        <SafeHtml html={post.content} className="posts-detail-content" as="div" />
        {post.permalink ? (
          <a
            className="posts-external"
            href={post.permalink}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read on Broken Science
          </a>
        ) : null}
      </DetailReader>
      <BackToTop mode="document" />
    </>
  );
}
