import {
  ISO_DATE,
  TWO_DIGITS,
  YYYYMMDD,
  YYMMDD,
  isoFromYymmdd,
  isValidCalendarDay,
  yymmddFromIso,
} from "./dates";

export type DailyFixTab = "body" | "brain";

export type NormalizeDailyFixPathResult =
  | { kind: "serve"; mode: "bare"; tab: DailyFixTab | null }
  | { kind: "serve"; mode: "dated"; iso: string; yymmdd: string; tab: DailyFixTab | null }
  | { kind: "redirect"; location: string }
  | { kind: "notFound" };

const PREFIX = "/the-daily-fix";

type QueryParse = {
  /** Original query without leading `?`, or "". */
  raw: string;
  /** Ordered pairs as raw `key=value` or `key` substrings (no leading `?`/`&`). */
  pairs: string[];
};

function parseQuery(search: string): QueryParse {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return { raw: "", pairs: [] };
  return { raw, pairs: raw.split("&") };
}

function pairKey(pair: string): string {
  const eq = pair.indexOf("=");
  return eq === -1 ? pair : pair.slice(0, eq);
}

function pairValue(pair: string): string | null {
  const eq = pair.indexOf("=");
  return eq === -1 ? null : pair.slice(eq + 1);
}

function buildQuery(pairs: string[]): string {
  if (pairs.length === 0) return "";
  return `?${pairs.join("&")}`;
}

/**
 * Normalize Daily Fix path + query.
 * Trailing slash (except the bare prefix with no date): strip via 301 to the slash-less form.
 * Unknown path pillar (e.g. /261004/foo) → notFound.
 */
export function normalizeDailyFixPath(pathname: string, search = ""): NormalizeDailyFixPathResult {
  let path = pathname;
  if (path.length > 1 && path.endsWith("/")) {
    const stripped = path.replace(/\/+$/, "") || "/";
    const q = search.startsWith("?") ? search : search ? `?${search}` : "";
    // Bare `/the-daily-fix/` → redirect to `/the-daily-fix`
    return { kind: "redirect", location: `${stripped}${q}` };
  }

  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) {
    return { kind: "notFound" };
  }

  const rest = path === PREFIX ? "" : path.slice(PREFIX.length + 1);
  const segments = rest === "" ? [] : rest.split("/");
  const query = parseQuery(search);

  if (segments.length >= 4) {
    return { kind: "notFound" };
  }

  // Bare
  if (segments.length === 0) {
    return finalizeServe({ mode: "bare" }, query);
  }

  // /YY/MM/DD
  if (segments.length === 3) {
    const [yy, mm, dd] = segments;
    if (!TWO_DIGITS.test(yy) || !TWO_DIGITS.test(mm) || !TWO_DIGITS.test(dd)) {
      return { kind: "notFound" };
    }
    const code = `${yy}${mm}${dd}`;
    const iso = isoFromYymmdd(code);
    if (!iso) return { kind: "notFound" };
    const target = `${PREFIX}/${code}${buildQuery(query.pairs)}`;
    return { kind: "redirect", location: target };
  }

  // /date[/pillar]
  if (segments.length === 1 || segments.length === 2) {
    const dateSeg = segments[0]!;
    const pillarSeg = segments[1];

    const parsed = parseDateSegment(dateSeg);
    if (parsed === "invalid") return { kind: "notFound" };

    if (pillarSeg != null) {
      if (pillarSeg !== "belly" && pillarSeg !== "body" && pillarSeg !== "brain") {
        return { kind: "notFound" };
      }
      // Path pillar → 301 to ?tab= (belly drops param). Append tab last (Q10).
      const pairs = query.pairs.filter((p) => pairKey(p) !== "tab" && pairKey(p) !== "tab[]");
      if (pillarSeg === "body" || pillarSeg === "brain") {
        pairs.push(`tab=${pillarSeg}`);
      }
      const loc = `${PREFIX}/${parsed.yymmdd}${buildQuery(pairs)}`;
      // Always redirect path-pillar forms (even belly with no other change) to canonical.
      return { kind: "redirect", location: loc };
    }

    // Non-canonical date forms → 301 to YYMMDD
    if (parsed.form !== "yymmdd") {
      return {
        kind: "redirect",
        location: `${PREFIX}/${parsed.yymmdd}${buildQuery(query.pairs)}`,
      };
    }

    return finalizeServe(
      { mode: "dated", iso: parsed.iso, yymmdd: parsed.yymmdd },
      query,
    );
  }

  return { kind: "notFound" };
}

type ParsedDate =
  | { form: "yymmdd" | "yyyymmdd" | "iso"; iso: string; yymmdd: string }
  | "invalid";

function parseDateSegment(segment: string): ParsedDate {
  const six = YYMMDD.exec(segment);
  if (six) {
    const iso = isoFromYymmdd(segment);
    if (!iso) return "invalid";
    return { form: "yymmdd", iso, yymmdd: segment };
  }

  const eight = YYYYMMDD.exec(segment);
  if (eight) {
    const year = Number(eight[1]);
    const month = Number(eight[2]);
    const day = Number(eight[3]);
    if (!isValidCalendarDay(year, month, day)) return "invalid";
    const iso = `${eight[1]}-${eight[2]}-${eight[3]}`;
    const code = yymmddFromIso(iso);
    if (!code) return "invalid";
    return { form: "yyyymmdd", iso, yymmdd: code };
  }

  const isoMatch = ISO_DATE.exec(segment);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDay(year, month, day)) return "invalid";
    const code = yymmddFromIso(segment);
    if (!code) return "invalid";
    return { form: "iso", iso: segment, yymmdd: code };
  }

  return "invalid";
}

function finalizeServe(
  base:
    | { mode: "bare" }
    | { mode: "dated"; iso: string; yymmdd: string },
  query: QueryParse,
): NormalizeDailyFixPathResult {
  const tabPairs = query.pairs.filter((p) => pairKey(p) === "tab" || pairKey(p) === "tab[]");
  const otherPairs = query.pairs.filter((p) => pairKey(p) !== "tab" && pairKey(p) !== "tab[]");

  if (tabPairs.length === 0) {
    return base.mode === "bare"
      ? { kind: "serve", mode: "bare", tab: null }
      : { kind: "serve", mode: "dated", iso: base.iso, yymmdd: base.yymmdd, tab: null };
  }

  // Repeated / array / empty / unknown / belly → strip tab
  if (tabPairs.length !== 1 || pairKey(tabPairs[0]!) === "tab[]") {
    return redirectTabless(base, otherPairs);
  }

  const rawVal = pairValue(tabPairs[0]!);
  if (rawVal === null || rawVal === "") {
    return redirectTabless(base, otherPairs);
  }

  const decoded = (() => {
    try {
      return decodeURIComponent(rawVal.replace(/\+/g, " "));
    } catch {
      return rawVal;
    }
  })();

  if (decoded === "belly") {
    return redirectTabless(base, otherPairs);
  }

  if (decoded === "body" || decoded === "brain") {
    return base.mode === "bare"
      ? { kind: "serve", mode: "bare", tab: decoded }
      : { kind: "serve", mode: "dated", iso: base.iso, yymmdd: base.yymmdd, tab: decoded };
  }

  // Case-only difference → 301 to lowercase allowlisted tab
  const lower = decoded.toLowerCase();
  if (lower === "body" || lower === "brain") {
    const pairs = [...otherPairs];
    // Keep other pairs byte-for-byte; replace tab value with lowercase, preserving original tab pair position.
    const rebuilt: string[] = [];
    let tabPlaced = false;
    for (const p of query.pairs) {
      if (pairKey(p) === "tab" || pairKey(p) === "tab[]") {
        if (!tabPlaced) {
          rebuilt.push(`tab=${lower}`);
          tabPlaced = true;
        }
        continue;
      }
      rebuilt.push(p);
    }
    if (!tabPlaced) rebuilt.push(`tab=${lower}`);
    const path = base.mode === "bare" ? PREFIX : `${PREFIX}/${base.yymmdd}`;
    return { kind: "redirect", location: `${path}${buildQuery(rebuilt)}` };
  }

  // Unknown tab → strip
  return redirectTabless(base, otherPairs);
}

function redirectTabless(
  base:
    | { mode: "bare" }
    | { mode: "dated"; iso: string; yymmdd: string },
  otherPairs: string[],
): NormalizeDailyFixPathResult {
  const path = base.mode === "bare" ? PREFIX : `${PREFIX}/${base.yymmdd}`;
  return { kind: "redirect", location: `${path}${buildQuery(otherPairs)}` };
}
