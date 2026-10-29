/**
 * Posts list — fetches `/api/posts?page=N` once per parsed page (A19 / CQ12).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { MAX_PAGE, type PostListBody } from "@shared/posts";
import { fetchPostsPage } from "@/lib/fetchPostsPage";
import { usePostsPageMeta } from "@/hooks/usePostsPageMeta";
import { PostCard } from "./PostCard";
import { PostsError, PostsLayout, PostsLoading } from "./PostsLayout";
import { parseListPage } from "./parsePage";

type ListState =
  | { status: "loading" }
  | { status: "data"; body: PostListBody }
  | { status: "error" };

export default function PostsPage() {
  const search = useSearch();
  const parsed = useMemo(() => parseListPage(search), [search]);
  const page = parsed.page;

  const [state, setState] = useState<ListState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  usePostsPageMeta({ kind: "list", page });

  useEffect(() => {
    // Q16: invalid ?page= → fetch page 1 and normalize the URL. Read live search so
    // replaceState is not an effect dep (would double-fetch after the clean URL).
    if (parseListPage(window.location.search).invalid) {
      window.history.replaceState(null, "", "/posts");
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const body = await fetchPostsPage(page, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: "data", body });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [page, retryCount]);

  const onRetry = () => {
    setRetryCount((n) => n + 1);
  };

  return (
    <PostsLayout>
      <h1 className="posts-title">Posts</h1>
      <p className="posts-lead">Articles from Broken Science.</p>

      {state.status === "loading" ? <PostsLoading /> : null}

      {state.status === "error" ? <PostsError onRetry={onRetry} /> : null}

      {state.status === "data" ? (
        <ListBody body={state.body} page={page} />
      ) : null}
    </PostsLayout>
  );
}

function ListBody({ body, page }: { body: PostListBody; page: number }) {
  const { posts, has_more } = body;
  const empty = posts.length === 0;

  if (empty && page === 1 && !has_more) {
    return (
      <div className="posts-empty">
        <p>No posts yet</p>
      </div>
    );
  }

  if (empty && page > 1 && !has_more) {
    return (
      <div className="posts-empty">
        <p>
          <Link href="/posts" className="posts-link">
            Back to page 1
          </Link>
        </p>
      </div>
    );
  }

  if (empty && has_more) {
    return (
      <div className="posts-empty">
        <p>No posts on this page.</p>
        <Pager page={page} hasMore={has_more} />
      </div>
    );
  }

  return (
    <>
      <ul className="posts-list">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
      <Pager page={page} hasMore={has_more} />
    </>
  );
}

function Pager({ page, hasMore }: { page: number; hasMore: boolean }) {
  const showNewer = page > 1;
  const showOlder = hasMore && page < MAX_PAGE;

  if (!showNewer && !showOlder) return null;

  const newerHref = page <= 2 ? "/posts" : `/posts?page=${page - 1}`;
  const olderHref = `/posts?page=${page + 1}`;

  return (
    <nav className="posts-pager" aria-label="Posts pagination">
      {showNewer ? (
        <Link href={newerHref} className="posts-pager-link">
          Newer
        </Link>
      ) : (
        <span className="posts-pager-spacer" />
      )}
      {showOlder ? (
        <Link href={olderHref} className="posts-pager-link">
          Older
        </Link>
      ) : (
        <span className="posts-pager-spacer" />
      )}
    </nav>
  );
}
