import type { DailyFixDay } from "./mapper";

export type UpstreamOutcome =
  | { kind: "ok"; status: 200; json: unknown; mapped: DailyFixDay }
  | { kind: "not_found"; status: 404 }
  | { kind: "mismatch"; status: 200; json: unknown; mapped: DailyFixDay }
  | { kind: "unmappable"; status: 200; json: unknown }
  | { kind: "upstream_error"; status: number }
  | { kind: "timeout" }
  | { kind: "throw" }
  | { kind: "nokey" };

export type HeadKind = "full" | "generic" | "generic_noindex";

export type RouteStatus = {
  httpStatus: 200 | 404 | 503;
  headKind: HeadKind;
  /** Whether the response may write the edge cache entry for this ISO. */
  cacheable: boolean;
  /** Inject df-initial with raw upstream JSON. */
  injectInitial: boolean;
};

/**
 * Shared status module: (route, upstream result) → status + head kind.
 * Q5: bare-unusable and 503 → generic head, no noindex, no canonical.
 * Q6: dated mismatch is never cached.
 */
export function resolveDailyFixStatus(
  route: "bare" | "dated",
  outcome: UpstreamOutcome,
): RouteStatus {
  if (
    outcome.kind === "upstream_error" ||
    outcome.kind === "timeout" ||
    outcome.kind === "throw" ||
    outcome.kind === "nokey"
  ) {
    return {
      httpStatus: 503,
      headKind: "generic",
      cacheable: false,
      injectInitial: false,
    };
  }

  if (route === "dated") {
    if (outcome.kind === "ok") {
      return {
        httpStatus: 200,
        headKind: "full",
        cacheable: true,
        injectInitial: true,
      };
    }
    if (outcome.kind === "not_found" || outcome.kind === "mismatch") {
      return {
        httpStatus: 404,
        headKind: "generic_noindex",
        cacheable: false,
        injectInitial: false,
      };
    }
    // unmappable 200 on dated → treat like not usable for HTML (404 noindex)
    return {
      httpStatus: 404,
      headKind: "generic_noindex",
      cacheable: false,
      injectInitial: false,
    };
  }

  // bare
  if (outcome.kind === "ok") {
    return {
      httpStatus: 200,
      headKind: "full",
      cacheable: true,
      injectInitial: true,
    };
  }
  // bare unusable (404, mismatch, unmappable)
  return {
    httpStatus: 200,
    headKind: "generic",
    cacheable: false,
    injectInitial: false,
  };
}
