import type { DailyFixDay } from "./mapper";
import { plainText, readMinutes } from "./text";

/** Compact per-day row for the archive list and client-side search. */
export type DailyFixArchiveEntry = {
  date: string;
  belly: { title: string; protein: string | null; excerpt: string; photo: string | null };
  body: { title: string; excerpt: string; photo: string | null };
  brain: { title: string; excerpt: string; photo: string | null; minutes: number | null };
};

export type DailyFixArchive = {
  days: DailyFixArchiveEntry[];
};

const EXCERPT_MAX = 160;

function clip(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= EXCERPT_MAX) return text;
  return `${chars.slice(0, EXCERPT_MAX - 1).join("").trimEnd()}\u2026`;
}

export function toArchiveEntry(day: DailyFixDay): DailyFixArchiveEntry {
  return {
    date: day.date,
    belly: {
      title: plainText(day.belly.title),
      protein: day.belly.protein_name,
      excerpt: clip(plainText(day.belly.excerpt)),
      photo: day.belly.photo_url,
    },
    body: {
      title: plainText(day.body.title),
      excerpt: clip(plainText(day.body.excerpt ?? day.body.html)),
      photo: day.body.photo_url,
    },
    brain: {
      title: plainText(day.brain.title),
      excerpt: clip(plainText(day.brain.excerpt ?? day.brain.html)),
      photo: day.brain.photo_url,
      minutes: readMinutes(day.brain.html),
    },
  };
}

/** Versioned so a shape change never serves a stale cached archive. */
export function archiveCacheKeyRequest(): Request {
  return new Request("https://metfix.org/__dfcache/archive-v2", { method: "GET" });
}
