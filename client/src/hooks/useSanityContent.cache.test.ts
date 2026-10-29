/**
 * @vitest-environment jsdom
 * B3 — module-level memoised home/site fetches; one network call per query; none on remount.
 * Rule 4: isolate module state via `vi.resetModules` (no test-only reset production export).
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchHomePage = vi.fn(async () => ({ hero: { eyebrow: "H" } }));
const fetchHomeCourses = vi.fn(async () => []);
const fetchTestimonials = vi.fn(async () => []);
const fetchFaqs = vi.fn(async () => []);
const fetchSiteSettings = vi.fn(async () => ({
  copyrightText: "© MetFix",
  navLinks: [],
}));

vi.mock("@/lib/homeContent", () => ({
  fetchHomePage: () => fetchHomePage(),
  fetchHomeCourses: () => fetchHomeCourses(),
  fetchTestimonials: () => fetchTestimonials(),
  fetchFaqs: () => fetchFaqs(),
}));

vi.mock("@/lib/content", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content")>("@/lib/content");
  return {
    ...actual,
    fetchSiteSettings: () => fetchSiteSettings(),
    fetchCourses: vi.fn(async () => []),
  };
});

vi.mock("@/lib/affiliateContent", () => ({
  fetchAffiliatePage: vi.fn(async () => ({})),
}));

async function loadHooks() {
  vi.resetModules();
  return import("./useSanityContent");
}

beforeEach(() => {
  fetchHomePage.mockClear();
  fetchHomeCourses.mockClear();
  fetchTestimonials.mockClear();
  fetchFaqs.mockClear();
  fetchSiteSettings.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("B3 Sanity fetch once", () => {
  it("useHomeContent fetches each query once; remount does not refetch", async () => {
    const { useHomeContent } = await loadHooks();
    const first = renderHook(() => useHomeContent());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(fetchHomePage).toHaveBeenCalledTimes(1);
    expect(fetchHomeCourses).toHaveBeenCalledTimes(1);
    expect(fetchTestimonials).toHaveBeenCalledTimes(1);
    expect(fetchFaqs).toHaveBeenCalledTimes(1);

    first.unmount();
    const second = renderHook(() => useHomeContent());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetchHomePage).toHaveBeenCalledTimes(1);
    expect(fetchHomeCourses).toHaveBeenCalledTimes(1);
    expect(fetchTestimonials).toHaveBeenCalledTimes(1);
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
  });

  it("useSiteSettings fetches once; remount does not refetch", async () => {
    const { useSiteSettings } = await loadHooks();
    const first = renderHook(() => useSiteSettings());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(fetchSiteSettings).toHaveBeenCalledTimes(1);

    first.unmount();
    const second = renderHook(() => useSiteSettings());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetchSiteSettings).toHaveBeenCalledTimes(1);
  });
});
