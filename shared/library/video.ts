/**
 * Shared ResourceVideo mapper (PL6 / CQ-2 / SEC10).
 * Supports BSI object `{ type, url, embed_url, video_id }` and legacy string URLs.
 */
import { BSI_ORIGIN, IMAGE_HOST } from "./constants";
import type { ResourceVideo } from "./types";

const YT_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const VIMEO_ID_RE = /^[0-9]{1,20}$/;

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function hasExplicitPort(raw: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^/@]+@)?[^/:]+:\d+/.test(raw);
}

function parseHttpsUrl(raw: string, resolveRelative = false): URL | null {
  if (!raw || hasExplicitPort(raw) || raw.startsWith("//") || raw.includes("..")) return null;
  try {
    const url = resolveRelative ? new URL(raw, `${BSI_ORIGIN}/`) : new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    if (url.port !== "") return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeFromUrl(url: URL): ResourceVideo | null {
  if (!YT_HOSTS.has(url.hostname)) return null;
  let videoId: string | null = null;
  if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else {
    const embed = url.pathname.match(/\/embed\/([^/?#]+)/);
    if (embed?.[1]) videoId = embed[1];
    else videoId = url.searchParams.get("v");
  }
  if (!videoId || !YT_ID_RE.test(videoId)) return null;
  const nocookie =
    url.hostname === "youtube-nocookie.com" ||
    url.hostname === "www.youtube-nocookie.com";
  const embedUrl = nocookie
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://www.youtube.com/embed/${videoId}`;
  return {
    kind: "youtube",
    embedUrl,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  };
}

function vimeoFromUrl(url: URL): ResourceVideo | null {
  if (!VIMEO_HOSTS.has(url.hostname)) return null;
  let videoId: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "player.vimeo.com") {
    const i = parts.indexOf("video");
    videoId = i >= 0 ? (parts[i + 1] ?? null) : (parts[0] ?? null);
  } else {
    videoId = parts[0] ?? null;
  }
  if (!videoId || !VIMEO_ID_RE.test(videoId)) return null;
  return {
    kind: "vimeo",
    embedUrl: `https://player.vimeo.com/video/${videoId}`,
    url: `https://vimeo.com/${videoId}`,
    videoId,
  };
}

function selfHostedFromUrl(url: URL): ResourceVideo | null {
  if (url.hostname !== IMAGE_HOST) return null;
  if (url.pathname.includes("..")) return null;
  return {
    kind: "self_hosted",
    embedUrl: null,
    url: url.href,
    videoId: null,
  };
}

function fromParsedUrl(url: URL): ResourceVideo | null {
  return youtubeFromUrl(url) ?? vimeoFromUrl(url) ?? selfHostedFromUrl(url);
}

function normalizeType(raw: unknown): "youtube" | "vimeo" | "self_hosted" | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (t === "youtube") return "youtube";
  if (t === "vimeo") return "vimeo";
  if (t === "self hosted" || t === "selfhosted") return "self_hosted";
  return null;
}

function fromObject(raw: Record<string, unknown>): ResourceVideo | null {
  const kind = normalizeType(raw.type);
  const videoIdRaw = typeof raw.video_id === "string" ? raw.video_id.trim() : "";
  const embedRaw = typeof raw.embed_url === "string" ? raw.embed_url.trim() : "";
  const urlRaw = typeof raw.url === "string" ? raw.url.trim() : "";

  if (kind === "youtube") {
    let videoId = videoIdRaw && YT_ID_RE.test(videoIdRaw) ? videoIdRaw : null;
    if (!videoId && embedRaw) {
      const u = parseHttpsUrl(embedRaw);
      if (u) videoId = youtubeFromUrl(u)?.videoId ?? null;
    }
    if (!videoId && urlRaw) {
      const u = parseHttpsUrl(urlRaw);
      if (u) videoId = youtubeFromUrl(u)?.videoId ?? null;
    }
    if (!videoId) return null;
    const nocookie =
      embedRaw.includes("youtube-nocookie.com") ||
      (parseHttpsUrl(embedRaw)?.hostname.includes("youtube-nocookie") ?? false);
    return {
      kind: "youtube",
      embedUrl: nocookie
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : `https://www.youtube.com/embed/${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  }

  if (kind === "vimeo") {
    let videoId = videoIdRaw && VIMEO_ID_RE.test(videoIdRaw) ? videoIdRaw : null;
    if (!videoId && embedRaw) {
      const u = parseHttpsUrl(embedRaw);
      if (u) videoId = vimeoFromUrl(u)?.videoId ?? null;
    }
    if (!videoId && urlRaw) {
      const u = parseHttpsUrl(urlRaw);
      if (u) videoId = vimeoFromUrl(u)?.videoId ?? null;
    }
    if (!videoId) return null;
    return {
      kind: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      url: `https://vimeo.com/${videoId}`,
      videoId,
    };
  }

  if (kind === "self_hosted") {
    const candidate = urlRaw || embedRaw;
    if (!candidate) return null;
    const u = parseHttpsUrl(candidate, true);
    return u ? selfHostedFromUrl(u) : null;
  }

  // Unknown type — try URL fields
  for (const candidate of [embedRaw, urlRaw]) {
    if (!candidate) continue;
    const u = parseHttpsUrl(candidate, true);
    if (!u) continue;
    const mapped = fromParsedUrl(u);
    if (mapped) return mapped;
  }
  return null;
}

/**
 * Map upstream video to ResourceVideo | null.
 * When `allowPlayable` is false (locked && !show_video_in_preview), returns null
 * so playable URLs are never leaked to the client (SEC10 / CQ-2.3).
 */
export function mapResourceVideo(
  raw: unknown,
  opts?: { allowPlayable?: boolean },
): ResourceVideo | null {
  if (opts?.allowPlayable === false) return null;
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const u = parseHttpsUrl(trimmed, true);
    return u ? fromParsedUrl(u) : null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return fromObject(raw as Record<string, unknown>);
  }
  return null;
}

export function isResourceVideo(value: unknown): value is ResourceVideo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== "youtube" && v.kind !== "vimeo" && v.kind !== "self_hosted") {
    return false;
  }
  if (!(v.embedUrl === null || typeof v.embedUrl === "string")) return false;
  if (!(v.url === null || typeof v.url === "string")) return false;
  if (!(v.videoId === null || typeof v.videoId === "string")) return false;
  return true;
}
