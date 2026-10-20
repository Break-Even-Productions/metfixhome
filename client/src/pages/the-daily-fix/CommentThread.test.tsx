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
  it("never shows a name field (R22 / C7.1)", () => {
    const { rerender } = render(
      <CommentThread load={{ status: "loaded", comments: [] }} pillar="belly" />,
    );
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();

    rerender(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        viewerDisplayName="Ada Lovelace"
      />,
    );
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    expect(screen.getByText(/Signed in as Ada Lovelace/i)).toBeTruthy();
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
