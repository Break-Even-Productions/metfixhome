/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommentThread } from "./CommentThread";

afterEach(() => {
  cleanup();
});

describe("CommentThread composer", () => {
  it("shows the name field only when logged out", () => {
    const { rerender } = render(
      <CommentThread load={{ status: "loaded", comments: [] }} pillar="belly" />,
    );
    expect(screen.getByPlaceholderText("Your name")).toBeTruthy();

    rerender(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        viewerDisplayName="Ada Lovelace"
      />,
    );
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
  });

  it("lets the user change comment type from the current tab", async () => {
    render(<CommentThread load={{ status: "loaded", comments: [] }} pillar="body" />);
    const trigger = screen.getByRole("button", { name: /Comment type/i });
    expect(trigger.textContent).toMatch(/Body/i);

    fireEvent.keyDown(trigger, { key: "Enter" });
    const brain = await screen.findByRole("menuitemradio", { name: /Brain/i });
    fireEvent.click(brain);
    expect(screen.getByRole("button", { name: /Comment type/i }).textContent).toMatch(/Brain/i);
  });
});
