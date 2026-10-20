/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JoinModal } from "./JoinModal";

afterEach(() => {
  cleanup();
});

describe("JoinModal", () => {
  it("shakes Join with Email and warns when the email is missing or invalid", () => {
    render(<JoinModal open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /Join with Email/i });

    fireEvent.click(submit);
    expect(screen.getByRole("alert").textContent).toMatch(/Add your email/i);
    expect(submit.className).toMatch(/df-join-shake/);
    expect(screen.getByPlaceholderText("you@email.com").getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(screen.getByPlaceholderText("you@email.com"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(submit);
    expect(screen.getByRole("alert").textContent).toMatch(/Add your email/i);

    fireEvent.change(screen.getByPlaceholderText("you@email.com"), {
      target: { value: "pat@example.com" },
    });
    fireEvent.click(submit);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submit.className).not.toMatch(/df-join-shake/);
  });

  it("shows the Google logo on Continue with Google", () => {
    render(<JoinModal open onClose={() => {}} />);
    const google = screen.getByRole("button", { name: /Continue with Google/i });
    expect(google.querySelector("svg.df-join-google-logo")).toBeTruthy();
  });
});
