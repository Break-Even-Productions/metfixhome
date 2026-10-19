import { isoFromYymmdd, yymmddFromIso } from "./dates";

export const FIRST_FIX_ISO = "2025-02-10";

/** Query param carrying the YYMMDD a reader asked for before being sent elsewhere. */
export const MISSING_PARAM = "missing";

/**
 * Where a dated route outside FIRST_FIX_ISO..todayIso belongs, or null when it's in range.
 * Future days go to today; days before the first fix go to the first fix. The requested
 * code rides along as `?missing=` so the page can say why the reader moved.
 */
export function outOfRangeLocation(iso: string, todayIso: string, search = ""): string | null {
  let path: string;
  if (iso > todayIso) path = "/the-daily-fix";
  else if (iso < FIRST_FIX_ISO) path = `/the-daily-fix/${yymmddFromIso(FIRST_FIX_ISO)}`;
  else return null;

  const raw = search.startsWith("?") ? search.slice(1) : search;
  const pairs = raw ? raw.split("&").filter((pair) => !isMissingPair(pair)) : [];
  pairs.push(`${MISSING_PARAM}=${yymmddFromIso(iso)}`);
  return `${path}?${pairs.join("&")}`;
}

/** ISO day named by `?missing=`, if it's a real calendar day. */
export function missingIsoFromSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  for (const pair of raw ? raw.split("&") : []) {
    if (!isMissingPair(pair)) continue;
    return isoFromYymmdd(pair.slice(MISSING_PARAM.length + 1));
  }
  return null;
}

export function isMissingPair(pair: string): boolean {
  return pair === MISSING_PARAM || pair.startsWith(`${MISSING_PARAM}=`);
}
