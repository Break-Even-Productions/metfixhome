// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveBrowser } from "./ArchiveBrowser";
import { DAILY_FIX_ARCHIVE_URL, resetDailyFixDayCache } from "./data";
import type { DailyFixArchiveEntry } from "./model";

function entry(date: string, belly: string, protein: string | null, brain: string): DailyFixArchiveEntry {
  return {
    date,
    belly: { title: belly, protein, excerpt: `${belly} excerpt`, photo: null },
    body: { title: "For load:", excerpt: "Deadlift 5-5-5", photo: null },
    brain: { title: brain, excerpt: "", photo: null, minutes: null },
  };
}

const BELLY_PHOTO = "https://brokenscience.org/wp-content/uploads/2025/11/chowder-1024x576.png";
const BRAIN_PHOTO = "https://example.com/cocaine.jpg";

const today = entry("2026-10-14", "White Fish Chowder", "Seafood", "Keep Your Cocaine");
today.belly.photo = BELLY_PHOTO;
today.brain.photo = BRAIN_PHOTO;
today.brain.minutes = 5;

const DAYS = [
  today,
  entry("2026-10-13", "Spicy Ginger Turkey Bowl", "Chicken", "Instagram glitched"),
  ...Array.from({ length: 30 }, (_, i) =>
    entry(`2026-08-${String(i + 1).padStart(2, "0")}`, `Steak ${i + 1}`, "Beef", `Reading ${i + 1}`),
  ),
];

let intersect: (() => void) | null = null;

beforeEach(() => {
  resetDailyFixDayCache();
  intersect = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        intersect = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  resetDailyFixDayCache();
  vi.unstubAllGlobals();
});

function stubArchive(response: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    expect(String(input)).toBe(DAILY_FIX_ARCHIVE_URL);
    return response();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ArchiveBrowser", () => {
  it("waits until near the viewport, then shows only the past week as day cards", async () => {
    const fetchMock = stubArchive(() => new Response(JSON.stringify({ days: DAYS }), { status: 200 }));
    render(<ArchiveBrowser todayIso="2026-10-14" backdrop={null} onOpen={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();

    intersect!();
    expect(await screen.findByText("The past week · search all 32 days")).toBeTruthy();
    const list = screen.getByRole("list");
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();

    const first = cards[0];
    expect(within(first).getByText("Wed · Oct 14")).toBeTruthy();
    expect(within(first).getByText("261014")).toBeTruthy();
    const [belly, body, brain] = within(first).getAllByRole("link");
    expect(belly.getAttribute("href")).toBe("/the-daily-fix");
    expect(within(belly).getByText("White Fish Chowder")).toBeTruthy();
    expect(within(belly).getByText("Seafood")).toBeTruthy();
    expect(body.getAttribute("href")).toBe("/the-daily-fix?tab=body");
    expect(within(body).getByText("Deadlift 5-5-5")).toBeTruthy();
    expect(brain.getAttribute("href")).toBe("/the-daily-fix?tab=brain");
    expect(within(brain).getByText("5 min")).toBeTruthy();

    expect(belly.querySelector("img")?.getAttribute("src")).toBe(
      "https://brokenscience.org/wp-content/uploads/2025/11/chowder-150x150.png",
    );
    expect(body.querySelector("img")).toBeNull();
    expect(brain.querySelector("img")?.getAttribute("src")).toBe(BRAIN_PHOTO);

    fireEvent.error(belly.querySelector("img")!);
    expect(belly.querySelector("img")?.getAttribute("src")).toBe(BELLY_PHOTO);
    fireEvent.error(belly.querySelector("img")!);
    expect(belly.querySelector("img")).toBeNull();

    expect(within(cards[2]).getByText("Sat · Aug 1")).toBeTruthy();
  });

  it("search matches every term across titles, protein, excerpts, and dates", async () => {
    stubArchive(() => new Response(JSON.stringify({ days: DAYS }), { status: 200 }));
    render(<ArchiveBrowser todayIso="2026-10-14" backdrop={null} onOpen={() => {}} />);
    intersect!();
    await screen.findByText("The past week · search all 32 days");
    const input = screen.getByRole("searchbox", { name: "Search" });

    fireEvent.change(input, { target: { value: "cocaine" } });
    expect(screen.getByText("1 day matches “cocaine”")).toBeTruthy();

    fireEvent.change(input, { target: { value: "chicken ginger" } });
    expect(within(screen.getByRole("list")).getByText("Spicy Ginger Turkey Bowl")).toBeTruthy();

    fireEvent.change(input, { target: { value: "october 2026" } });
    expect(screen.getByText("2 days match “october 2026”")).toBeTruthy();

    fireEvent.change(input, { target: { value: "beef" } });
    expect(screen.getByText("30 days match “beef”")).toBeTruthy();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(24);

    fireEvent.change(input, { target: { value: "beef nonsense" } });
    expect(screen.getByText("0 days match “beef nonsense”")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("section chips limit cards and search to one pillar; protein filters by belly protein", async () => {
    stubArchive(() => new Response(JSON.stringify({ days: DAYS }), { status: 200 }));
    const { container } = render(
      <ArchiveBrowser todayIso="2026-10-14" backdrop="https://example.com/tab.jpg" onOpen={() => {}} />,
    );
    expect(container.querySelector(".df-search-backdrop")?.getAttribute("src")).toBe("https://example.com/tab.jpg");
    intersect!();
    await screen.findByText("The past week · search all 32 days");
    const input = screen.getByRole("searchbox", { name: "Search" });

    expect(screen.getByRole("button", { name: "All days" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Brain" }));
    expect(screen.getByRole("button", { name: "Brain" }).getAttribute("aria-pressed")).toBe("true");
    const firstCard = within(screen.getByRole("list")).getAllByRole("listitem")[0];
    const links = within(firstCard).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/the-daily-fix?tab=brain");

    fireEvent.change(input, { target: { value: "chowder" } });
    expect(screen.getByText("0 days match “chowder”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Belly" }));
    expect(screen.getByText("1 day matches “chowder”")).toBeTruthy();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "All days" }));

    fireEvent.keyDown(screen.getByRole("button", { name: "Protein" }), { key: "Enter" });
    expect((await screen.findAllByRole("menuitemradio")).map((item) => item.textContent)).toEqual([
      "All proteins",
      "Beef",
      "Chicken",
      "Seafood",
    ]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Chicken" }));
    expect(screen.getByText("1 day · Chicken")).toBeTruthy();
    expect(within(screen.getByRole("list")).getByText("Spicy Ginger Turkey Bowl")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chicken" })).toBeTruthy();
  });

  it("shows a retry state on failure and recovers", async () => {
    let ok = false;
    const fetchMock = stubArchive(() =>
      ok ? new Response(JSON.stringify({ days: DAYS }), { status: 200 }) : new Response("", { status: 503 }),
    );
    render(<ArchiveBrowser todayIso="2026-10-14" backdrop={null} onOpen={() => {}} />);
    intersect!();
    expect(await screen.findByRole("heading", { name: "The archive didn’t load" })).toBeTruthy();

    ok = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    intersect!();
    expect(await screen.findByText("The past week · search all 32 days")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
