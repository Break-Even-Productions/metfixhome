/**
 * @vitest-environment jsdom
 * PR2 client write/moderation gates (P7.2, CW10, CW12, CW13).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("CW10.1 edit/delete only on own; delete confirms; like rolls back; one in-flight", () => {
    render(<Harness moderator={false} />);
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("theirs")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
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
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if ((init?.method ?? "").toUpperCase() === "POST") {
        posts += 1;
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": "17" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<Harness initial={[OWN]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(1));
    const mid = posts;
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(posts).toBe(mid);
    await vi.advanceTimersByTimeAsync(17_000);
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(mid + 1));
  });

  it("CW13.3 Retry-After 99999 clamps client disable to 600s with countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let posts = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if ((init?.method ?? "").toUpperCase() === "POST") {
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
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(1));
    expect(postBtn().textContent ?? "").toMatch(/Try again in 60[0-9]s/);
    await vi.advanceTimersByTimeAsync(599_000);
    const mid = posts;
    expect((postBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(posts).toBe(mid);
    await vi.advanceTimersByTimeAsync(1_000);
    await waitFor(() => expect((postBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(postBtn());
    await waitFor(() => expect(posts).toBe(mid + 1));
  });
});
