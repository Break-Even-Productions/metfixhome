/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setJoinModalFetchForTests, JoinModal } from "./JoinModal";

beforeEach(() => {
  __setJoinModalFetchForTests(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "test-csrf" }), { status: 200 });
      }
      if (url.includes("/api/auth/login")) {
        return new Response(JSON.stringify({ signed_in: true, public_name: "Pat" }), {
          status: 200,
        });
      }
      if (url.includes("/api/auth/me")) {
        return new Response(JSON.stringify({ signed_in: true, public_name: "Pat" }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  __setJoinModalFetchForTests(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JoinModal", () => {
  it("shakes Sign in and warns when identifier or password is missing", () => {
    render(<JoinModal open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /^Sign in$/i });

    fireEvent.click(submit);
    expect(screen.getByRole("alert").textContent).toMatch(/email\/username and password/i);
    expect(submit.className).toMatch(/df-join-shake/);
  });

  it("hides Google when the gate is off (R9)", () => {
    render(<JoinModal open onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /Continue with Google/i })).toBeNull();
  });

  it("shows Google when googleEnabled", () => {
    render(<JoinModal open onClose={() => {}} googleEnabled />);
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeTruthy();
  });

  it("posts login with CSRF after valid fields", async () => {
    const onSignedIn = vi.fn();
    render(<JoinModal open onClose={() => {}} onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByPlaceholderText(/Email or username/i), {
      target: { value: "pat@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const loginCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/auth/login"));
    expect(loginCall).toBeTruthy();
    expect(loginCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-Token": "test-csrf" }),
      }),
    );
  });
});
