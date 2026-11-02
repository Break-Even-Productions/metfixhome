/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NEWSLETTER_FORM_ACTION } from "@/components/siteFooterNav";
import { NEWSLETTER_STORAGE_KEY } from "@/data/newsletter";
import { NewsletterModal } from "./NewsletterModal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("NewsletterModal", () => {
  it("submits EMAIL + FNAME to Mailchimp via hidden form and stores preferences", async () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const onClose = vi.fn();
    render(<NewsletterModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("City or region"), {
      target: { value: "London" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Metabolic health/i }));

    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole("button", { name: /^Sign up$/i }));

    expect(submitSpy).toHaveBeenCalled();
    const form = appendChild.mock.calls
      .map((call) => call[0] as Node)
      .find((node) => node instanceof HTMLFormElement) as HTMLFormElement | undefined;
    expect(form?.action).toBe(NEWSLETTER_FORM_ACTION);
    expect(form?.querySelector('input[name="EMAIL"]')?.getAttribute("value")).toBe(
      "ada@example.com",
    );
    expect(form?.querySelector('input[name="FNAME"]')?.getAttribute("value")).toBe(
      "Ada Lovelace",
    );

    const stored = JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY) || "{}");
    expect(stored.email).toBe("ada@example.com");
    expect(stored.interests).toEqual(["metabolic-health"]);
    expect(stored.location).toBe("London");

    await waitFor(() => {
      expect(screen.getByText(/on the list/i)).toBeTruthy();
      expect(
        screen.getByText((text) =>
          /send metabolic health to ada@example\.com/i.test(text),
        ),
      ).toBeTruthy();
    });
  });

  it("requires at least one interest", () => {
    render(<NewsletterModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("City or region"), {
      target: { value: "London" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign up$/i }));
    expect(screen.getByText(/Pick at least one topic/i)).toBeTruthy();
  });
});
