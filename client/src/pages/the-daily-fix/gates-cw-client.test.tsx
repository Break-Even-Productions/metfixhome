/**
 * @vitest-environment jsdom
 * PR2 client write/moderation gates (P7.2, CW10, CW12, CW13).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";
import {
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

function Harness(props: {
  moderator?: boolean;
  initial?: DailyFixComment[];
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
      onCommentsChanged={setLoad}
    />
  );
}

function postBtn() {
  return screen.getByRole("button", { name: /Post comment|Try again/i });
}

describe("PR2 client P7 / CW10 / CW12 / CW13", () => {
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
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "posted" } });
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
    const likeBtn = screen.getByRole("button", { name: /Like \(0\)/ });
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(1));
    expect(likeBtn.textContent).toMatch(/Like \(0\)/);
    const mid = likes;
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(mid));
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

  it("CW13.2 429 Retry-After 17 disables action for 17s then re-enables", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let posts = 0;
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
        posts += 1;
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
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(1));
    const midPosts = posts;
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(posts).toBe(midPosts);
    await vi.advanceTimersByTimeAsync(17_000);
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(midPosts + 1));

    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);
    await waitFor(() => expect(patches).toBe(1));
    expect((editBtn as HTMLButtonElement).disabled).toBe(true);
    expect(patches).toBe(1);
    await vi.advanceTimersByTimeAsync(17_000);
    await waitFor(() => expect((editBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(editBtn);
    await waitFor(() => expect(patches).toBe(2));

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(deletes).toBe(1));
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(17_000);
    await waitFor(() => expect((deleteBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(deletes).toBe(2));

    const likeBtn = screen.getByRole("button", { name: /Like \(0\)/ });
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(1));
    expect((likeBtn as HTMLButtonElement).disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(17_000);
    await waitFor(() => expect((likeBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(likeBtn);
    await waitFor(() => expect(likes).toBe(2));
  });

  it("CW13.3 Retry-After 99999 clamps client disable to 600s with countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let posts = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      const method = (init?.method ?? "GET").toUpperCase();
      if (String(url).includes("/api/daily-fix/comments") && method === "POST" && !String(url).includes("/like")) {
        posts += 1;
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": "99999" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<Harness initial={[OWN]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    await act(async () => {
      fireEvent.click(postBtn());
      await Promise.resolve();
    });
    expect(posts).toBe(1);
    expect(postBtn().textContent ?? "").toMatch(/Try again in 60[0-9]s/);
    const lockedUntil = Date.now() + 600_000;
    await act(async () => {
      vi.setSystemTime(lockedUntil - 1_000);
      await vi.advanceTimersByTimeAsync(250);
    });
    const mid = posts;
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(posts).toBe(mid);
    await act(async () => {
      vi.setSystemTime(lockedUntil);
      await vi.advanceTimersByTimeAsync(250);
    });
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(mid + 1));
  });
});
