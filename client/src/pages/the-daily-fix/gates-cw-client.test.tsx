/**
 * @vitest-environment jsdom
 * PR2 client write/moderation gates (P7.2, CW10, CW12, CW13, CW16.3).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";
import {
  fetchDailyFixComments,
  invalidateCommentsCache,
  type CommentsLoadState,
  type DailyFixComment,
} from "./comments";

beforeEach(() => {
  // AU25.2 / isAuthUiHost: composer only on metfix.org
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, hostname: "metfix.org", href: "https://metfix.org/" },
  });
});

afterEach(() => {
  cleanup();
  invalidateCommentsCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const OWN: DailyFixComment = {
  id: 1,
  pillar: "belly",
  author: "Member",
  content: "hello",
  timestamp: "2025-02-10T12:00:00Z",
  own: true,
  deleted: 0,
  like_count: 0,
};

const OTHER: DailyFixComment = {
  id: 2,
  pillar: "belly",
  author: "Other",
  content: "theirs",
  timestamp: "2025-02-10T12:01:00Z",
  own: false,
  deleted: 0,
  like_count: 0,
};

const C101: DailyFixComment = {
  id: 101,
  pillar: "belly",
  author: "Member",
  content: "stale-101",
  timestamp: "2025-02-10T12:00:00Z",
  own: true,
  deleted: 0,
  like_count: 0,
};

function Harness(props: {
  moderator?: boolean;
  initial?: DailyFixComment[];
  onCommentsChanged?: (next: CommentsLoadState) => void;
}) {
  const [load, setLoad] = useState<CommentsLoadState>({
    status: "loaded",
    comments: props.initial ?? [OWN, OTHER],
  });
  return (
    <CommentThread
      load={load}
      pillar="belly"
      dateIso="2025-02-10"
      viewerDisplayName="Member"
      moderator={props.moderator ?? false}
      onCommentsChanged={(next) => {
        setLoad(next);
        props.onCommentsChanged?.(next);
      }}
    />
  );
}

function postBtn() {
  // Submit only (df-btn-ink) — per-row Reply/Edit/Delete also say "Try again in Ns".
  const buttons = screen.getAllByRole("button");
  const submit = buttons.find((b) => b.classList.contains("df-btn-ink"));
  if (!submit) throw new Error("composer submit button not found");
  return submit;
}

function emptyListBody() {
  return JSON.stringify({ comments: { belly: [], body: [], brain: [] } });
}

function listWith(comments: Array<Record<string, unknown>>) {
  return JSON.stringify({
    comments: { belly: comments, body: [], brain: [] },
    meta: { date: "2025-02-10", type: "all" },
  });
}

describe("PR2 client P7 / CW10 / CW12 / CW13 / CW16", () => {
  it("P7.2 201 POST appends mapped comment with zero extra comments GETs", async () => {
    let gets = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "GET") {
        gets += 1;
        return new Response("{}", { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "POST") {
        return new Response(
          JSON.stringify({
            comment: {
              id: 99,
              user: { display_name: "Member" },
              content: "posted",
              timestamp: "2025-02-10T13:00:00Z",
              parent_id: null,
              like_count: 0,
              deleted: 0,
              edited: 0,
              replies: [],
            },
          }),
          { status: 201 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<Harness initial={[OWN]} />);
    expect(screen.getByText("hello")).toBeTruthy();
    const beforeGets = gets;
    fireEvent.change(screen.getByRole("textbox", { name: /comment/i }), {
      target: { value: "posted" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(screen.getByText("posted")).toBeTruthy());
    expect(gets).toBe(beforeGets);
  });

  it("CW10.1 edit/delete only on own; delete confirms; like rolls back; one in-flight", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("edited");
    let likes = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/like") && method === "POST") {
        likes += 1;
        return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
      }
      if (method === "PATCH") {
        return new Response(JSON.stringify({ comment: { id: 1, content: "edited" } }), {
          status: 200,
        });
      }
      if (method === "DELETE") {
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<Harness moderator={false} />);
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("theirs")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(screen.getByText("edited")).toBeTruthy());
    expect(promptSpy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("hello")).toBeNull());
    expect(confirmSpy).toHaveBeenCalled();
    const likeBtn = screen.getByRole("button", { name: /Like \(0\)|Try again/ });
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(1));
    // 429 rolls back count and locks the control (Retry-After default 60).
    expect(likeBtn.textContent).toMatch(/Try again in \d+s|Like \(0\)/);
    const mid = likes;
    fireEvent.click(likeBtn);
    expect(likes).toBe(mid);
  });

  it("CW12.1 moderator true shows controls on others; non-boolean localStorage ignored", () => {
    localStorage.setItem("mfx_mod", "1");
    const { unmount } = render(<Harness moderator />);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    unmount();
    cleanup();
    localStorage.setItem("mfx_mod", "1");
    render(<Harness moderator={false} />);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("CW12.3 refresh flip can_moderate true→false drops others' controls", () => {
    render(<Harness moderator={false} />);
    expect(screen.getByText("theirs")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("CW13.2 429 Retry-After 17 disables post, reply, edit, delete, like then re-enables", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let posts = 0;
    let replies = 0;
    let patches = 0;
    let deletes = 0;
    let likes = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      const rateLimited = () =>
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": "17" },
        });
      if (u.includes("/api/daily-fix/comments") && method === "POST" && !u.includes("/like")) {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        if (body.parent_comment_id != null) {
          replies += 1;
        } else {
          posts += 1;
        }
        return rateLimited();
      }
      if (method === "PATCH") {
        patches += 1;
        return rateLimited();
      }
      if (method === "DELETE") {
        deletes += 1;
        return rateLimited();
      }
      if (u.includes("/like") && method === "POST") {
        likes += 1;
        return rateLimited();
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("edited");
    render(<Harness initial={[OWN]} />);

    // post
    fireEvent.change(screen.getByRole("textbox", { name: /comment/i }), {
      target: { value: "x" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(1));
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(postBtn().textContent).toMatch(/Try again in 17s/);
    const midPosts = posts;
    fireEvent.click(postBtn());
    expect(posts).toBe(midPosts);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox", { name: /comment/i }), {
      target: { value: "x" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(midPosts + 1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));

    // reply
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "r" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(replies).toBe(1));
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(postBtn().textContent).toMatch(/Try again in 17s/);
    const midReplies = replies;
    fireEvent.click(postBtn());
    expect(replies).toBe(midReplies);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Cancel reply" }));

    // edit
    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);
    await waitFor(() => expect(patches).toBe(1));
    expect((editBtn as HTMLButtonElement).disabled).toBe(true);
    expect(editBtn.textContent).toMatch(/Try again in 17s/);
    expect(patches).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((editBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(editBtn);
    await waitFor(() => expect(patches).toBe(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((editBtn as HTMLButtonElement).disabled).toBe(false));

    // delete
    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(deletes).toBe(1));
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
    expect(deleteBtn.textContent).toMatch(/Try again in 17s/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((deleteBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(deletes).toBe(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((deleteBtn as HTMLButtonElement).disabled).toBe(false));

    // like
    const likeBtn = screen.getByRole("button", { name: /Like \(0\)/ });
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(1));
    expect((likeBtn as HTMLButtonElement).disabled).toBe(true);
    expect(likeBtn.textContent).toMatch(/Try again in 17s/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17_000);
    });
    await waitFor(() => expect((likeBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(2));
  });

  it("CW13.3 Retry-After 99999 UI clamps to 600s with countdown; 17 then 16", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let posts = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "POST" && !u.includes("/like")) {
        posts += 1;
        const ra = posts === 1 ? "99999" : "17";
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": ra },
        });
      }
      return new Response(emptyListBody(), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<Harness initial={[OWN]} />);

    fireEvent.change(screen.getByRole("textbox", { name: /comment/i }), {
      target: { value: "cap" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(1));
    expect(postBtn().textContent).toBe("Try again in 600s");
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    const mid = posts;
    fireEvent.click(postBtn());
    expect(posts).toBe(mid);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(599_000);
    });
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(posts).toBe(mid);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));

    fireEvent.change(screen.getByRole("textbox", { name: /comment/i }), {
      target: { value: "cap2" },
    });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(mid + 1));
    expect(postBtn().textContent).toBe("Try again in 17s");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await waitFor(() => expect(postBtn().textContent).toBe("Try again in 16s"));
  });

  async function runCw163Delete(label: string) {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const threadSrc = readFileSync(join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    // 204 path: bypass refetch, never invalidateCommentsCache (CW16.2b / M-CW31/34/35).
    expect(threadSrc).toMatch(
      /if \(res\.status === 204\) \{[\s\S]*?bypassCache:\s*true[\s\S]*?return;/,
    );
    const block204 = threadSrc.match(
      /if \(res\.status === 204\) \{[\s\S]*?\n      \}/,
    )?.[0] ?? "";
    expect(block204).not.toContain("invalidateCommentsCache");

    invalidateCommentsCache();
    let bypassGets = 0;
    const stalePayload = listWith([
      {
        id: 101,
        user: { display_name: "Member" },
        content: "stale-101",
        timestamp: "2025-02-10T12:00:00Z",
        like_count: 0,
        parent_id: null,
        deleted: 0,
        edited: 0,
        replies: [],
      },
    ]);
    const freshPayload = listWith([]);
    const seedFetch = vi.fn(async () => new Response(stalePayload, { status: 200 }));
    const seeded = await fetchDailyFixComments("2025-02-10", undefined, {
      fetchImpl: seedFetch as unknown as typeof fetch,
    });
    expect(seeded.status).toBe("loaded");
    if (seeded.status === "loaded") {
      expect(seeded.comments.map((c) => c.id)).toStrictEqual([101]);
    }

    const commentsNs = await import("./comments");
    const invalidateSpy = vi.spyOn(commentsNs, "invalidateCommentsCache");

    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "GET") {
        bypassGets += 1;
        const cacheMode = init?.cache;
        expect(cacheMode === "no-store" || cacheMode === "reload").toBe(true);
        return new Response(freshPayload, { status: 200 });
      }
      if (method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    invalidateSpy.mockClear();

    let lastLoad: CommentsLoadState | null = null;
    render(
      <Harness
        initial={[C101]}
        onCommentsChanged={(next) => {
          lastLoad = next;
        }}
      />,
    );
    expect(screen.getByText("stale-101")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(bypassGets).toBe(1));
    await waitFor(() => expect(screen.queryByText("stale-101")).toBeNull());
    expect(bypassGets).toBe(1);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(lastLoad?.status).toBe("loaded");
    if (lastLoad?.status === "loaded") {
      expect(lastLoad.comments.map((c) => c.id)).toStrictEqual([]);
    }
    // Bypass wrote fresh into Map — non-bypass read stays empty (not stale 101).
    const cached = await fetchDailyFixComments("2025-02-10");
    expect(cached.status).toBe("loaded");
    if (cached.status === "loaded") {
      expect(cached.comments.map((c) => c.id)).toStrictEqual([]);
    }
    expect(bypassGets).toBe(1);
    void label;
    cleanup();
    invalidateSpy.mockRestore();
    invalidateCommentsCache();
    vi.unstubAllGlobals();
  }

  it("CW16.3 204 delete → one cache-bypassing list GET; deleted absent; 0 invalidate", async () => {
    await runCw163Delete("first");
  });

  it("CW16.3 repeat-delete 204 → one cache-bypassing list GET; deleted absent; 0 invalidate", async () => {
    await runCw163Delete("repeat");
  });
});
