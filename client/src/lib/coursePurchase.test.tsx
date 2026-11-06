/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeCourseCard } from "@/lib/homeTypes";
import { HomeClasses } from "@/components/home/HomeClasses";
import { openWhopCheckout, purchaseCourseCheckout } from "@/lib/account";
import { loadMe } from "@/lib/session";

vi.mock("@/lib/session", () => ({
  peekMe: vi.fn(() => null),
  loadMe: vi.fn(),
}));

vi.mock("@/lib/account", () => ({
  purchaseCourseCheckout: vi.fn(),
  openWhopCheckout: vi.fn(() => true),
}));

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverStub,
});

const course: HomeCourseCard = {
  id: "essentials-advanced",
  label: "Professional",
  name: "MetFix Essentials Advanced",
  desc: "The complete professional curriculum.",
  href: "/classes",
  tag: "$500",
  live: true,
  notify: false,
  bsiPostId: 20231,
  price: "$500",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("guest course Buy now", () => {
  it("asks a signed-out buyer for email, then starts checkout", async () => {
    vi.mocked(loadMe).mockResolvedValue({ status: "signed_out" });
    vi.mocked(purchaseCourseCheckout).mockResolvedValue({
      checkout_url: "https://whop.com/checkout/plan_test",
    });

    render(<HomeClasses onJoin={() => undefined} courses={[course]} />);

    const buy = await screen.findByRole("button", { name: "Buy Now" });
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Email for this purchase")).toBeNull();

    fireEvent.click(buy);
    const dialog = await screen.findByRole("dialog", { name: "Email for this purchase" });
    expect(purchaseCourseCheckout).not.toHaveBeenCalled();

    const email = screen.getByRole("textbox", { name: "Email for this purchase" });
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.submit(email.closest("form")!);
    expect(purchaseCourseCheckout).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent ?? "").toContain("Enter the email");

    fireEvent.change(email, { target: { value: "guest.buyer@example.test" } });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => {
      expect(purchaseCourseCheckout).toHaveBeenCalledWith(20231, {
        return_path: "/checkout/complete",
        email: "guest.buyer@example.test",
      });
    });
    expect(openWhopCheckout).toHaveBeenCalledWith("https://whop.com/checkout/plan_test");
  });

  it("does not ask a signed-in buyer for email", async () => {
    vi.mocked(loadMe).mockResolvedValue({
      status: "signed_in",
      public_name: "Ada",
      moderator: false,
    });
    vi.mocked(purchaseCourseCheckout).mockResolvedValue({
      checkout_url: "https://whop.com/checkout/plan_test",
    });

    render(<HomeClasses onJoin={() => undefined} courses={[course]} />);

    const buy = await screen.findByRole("button", { name: "Buy Now" });
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByLabelText("Email for this purchase")).toBeNull();

    fireEvent.click(buy);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(purchaseCourseCheckout).toHaveBeenCalledWith(20231, {
        return_path: "/checkout/complete",
      });
    });
  });
});
