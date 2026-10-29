import {
  isLocalAuthEnabled,
  LOCAL_AUTH_HOSTS,
  type LocalAuthEnv,
} from "../dev-auth";
import type { Env } from "../upstream";

/** AUTH-HOST: auth and write routes only on exact Host metfix.org (AU25.1). */
export const AUTH_HOST = "metfix.org";

/** Single declaration of STAGING_AUTH_HOSTS lives on Env; pick it here. */
export type AuthHostEnv = LocalAuthEnv & Pick<Env, "STAGING_AUTH_HOSTS">;

/** Module-level cache: raw env string → parsed exact host Set. */
let cachedRaw: string | undefined;
let cachedHosts: ReadonlySet<string> = new Set();
/** Log rejected entries once per distinct raw value. */
let loggedRaw: string | undefined;

/** Host header: hostname or hostname:port — never a URL / userinfo / path. */
const HOST_HEADER_RE = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;
/** Bare hostname (reCAPTCHA / Origin hostname / env tokens) — no port. */
const BARE_HOSTNAME_RE = /^[A-Za-z0-9.-]+$/;

/** Lowercase and strip at most one trailing dot. */
function canonicalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/**
 * Parse a raw Host header without adding a scheme (B3).
 * Returns null if the value is not exactly hostname or hostname:port.
 */
export function parseHostHeader(
  hostHeader: string,
): { hostname: string; port: string | null } | null {
  const raw = hostHeader.trim();
  if (!raw || !HOST_HEADER_RE.test(raw)) return null;
  const colon = raw.indexOf(":");
  const hostPart = colon === -1 ? raw : raw.slice(0, colon);
  const port = colon === -1 ? null : raw.slice(colon + 1);
  const hostname = canonicalizeHostname(hostPart);
  // After stripping one trailing dot, must still be a non-empty bare hostname.
  if (!hostname || !BARE_HOSTNAME_RE.test(hostname)) return null;
  return { hostname, port };
}

/**
 * Normalize a Host header to a bare lowercase hostname.
 * Never adds a scheme. Rejects userinfo/path/fragment/scheme forms.
 * Accepts only absent port or :443 (S1); other ports → "".
 */
export function normalizeHost(hostHeader: string): string {
  const parsed = parseHostHeader(hostHeader);
  if (!parsed) return "";
  if (parsed.port !== null && parsed.port !== "443") return "";
  return parsed.hostname;
}

/**
 * Bare hostname only (reCAPTCHA siteverify / Origin hostname / env tokens).
 * No port. Never adds a scheme.
 */
export function normalizeHostname(hostname: string): string {
  const raw = hostname.trim();
  if (!raw || !BARE_HOSTNAME_RE.test(raw)) return "";
  const bare = canonicalizeHostname(raw);
  if (!bare || !BARE_HOSTNAME_RE.test(bare)) return "";
  return bare;
}

function parseStagingAuthHostsRawImpl(raw: string): {
  hosts: ReadonlySet<string>;
  rejected: string[];
} {
  if (raw.length === 0) return { hosts: new Set(), rejected: [] };
  const hosts = new Set<string>();
  const rejected: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue; // "" / " , " → empty allowlist, not a reject log
    const h = normalizeHostname(trimmed);
    if (!h) {
      rejected.push(trimmed);
      continue;
    }
    hosts.add(h);
  }
  return { hosts, rejected };
}

/**
 * Indirection so tests can `vi.spyOn(stagingAuthHostsParse, "raw")` and
 * observe cache hits (one parse per raw value).
 */
export const stagingAuthHostsParse = {
  raw: parseStagingAuthHostsRawImpl,
};

/** Exported for tests / direct parse without touching the module cache. */
export function parseStagingAuthHostsRaw(raw: string): {
  hosts: ReadonlySet<string>;
  rejected: string[];
} {
  return stagingAuthHostsParse.raw(raw);
}

/**
 * Cached Set of exact staging auth hostnames from STAGING_AUTH_HOSTS.
 * Keyed on the raw env string (B1).
 */
export function stagingAuthHostsSet(env?: AuthHostEnv): ReadonlySet<string> {
  const raw = typeof env?.STAGING_AUTH_HOSTS === "string" ? env.STAGING_AUTH_HOSTS : "";
  if (raw === cachedRaw) return cachedHosts;
  const { hosts, rejected } = stagingAuthHostsParse.raw(raw);
  cachedRaw = raw;
  cachedHosts = hosts;
  if (rejected.length > 0 && loggedRaw !== raw) {
    loggedRaw = raw;
    console.warn(`[auth] STAGING_AUTH_HOSTS rejected entries: ${rejected.join(", ")}`);
  }
  return cachedHosts;
}

/** Parse STAGING_AUTH_HOSTS into exact bare hostnames (array view of the cached Set). */
export function parseStagingAuthHosts(env?: AuthHostEnv): string[] {
  return [...stagingAuthHostsSet(env)];
}

/** Exact hostname match against STAGING_AUTH_HOSTS (no suffix / wildcard). */
export function isStagingAuthHost(bareHost: string, env?: AuthHostEnv): boolean {
  const bare = normalizeHostname(bareHost);
  if (!bare) return false;
  return stagingAuthHostsSet(env).has(bare);
}

function isDefaultOrHttpsPort(port: string | null): boolean {
  return port === null || port === "443";
}

/**
 * Production: only metfix.org (default port or :443).
 * Staging preview: exact hosts listed in STAGING_AUTH_HOSTS (default/:443).
 * Local: when env.LOCAL_AUTH is set, also localhost / 127.0.0.1 (any port).
 */
export function isAuthHost(request: Request, env?: AuthHostEnv): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  const parsed = parseHostHeader(host);
  if (!parsed) return false;
  const { hostname: bare, port } = parsed;
  if (bare === AUTH_HOST) return isDefaultOrHttpsPort(port);
  if (stagingAuthHostsSet(env).has(bare)) return isDefaultOrHttpsPort(port);
  if (isLocalAuthEnabled(env) && (LOCAL_AUTH_HOSTS as readonly string[]).includes(bare)) {
    return true;
  }
  return false;
}

/**
 * siteverify hostname: metfix.org, or an exact STAGING_AUTH_HOSTS entry when set.
 * Bare hostname only — no port (B3).
 */
export function isAllowedRecaptchaHostname(
  hostname: unknown,
  env?: AuthHostEnv,
): boolean {
  if (typeof hostname !== "string") return false;
  const bare = normalizeHostname(hostname);
  if (!bare) return false;
  if (bare === AUTH_HOST) return true;
  return stagingAuthHostsSet(env).has(bare);
}
