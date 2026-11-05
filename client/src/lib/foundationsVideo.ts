/** Parse YouTube / Vimeo links for the Foundations vertical video carousel. */

export type FoundationsVideo = {
  kind: "youtube" | "vimeo";
  embedUrl: string;
  posterUrl?: string;
  label: string;
};

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^[0-9]{1,20}$/;
const VIMEO_HASH_RE = /^[A-Za-z0-9]+$/;

function parseHttps(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeEmbed(videoId: string): FoundationsVideo {
  const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
  embed.searchParams.set("rel", "0");
  embed.searchParams.set("modestbranding", "1");
  embed.searchParams.set("playsinline", "1");
  return {
    kind: "youtube",
    embedUrl: embed.toString(),
    posterUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    label: "YouTube coach testimonial",
  };
}

function vimeoEmbed(videoId: string, privacyHash?: string | null): FoundationsVideo {
  const embed = new URL(`https://player.vimeo.com/video/${videoId}`);
  if (privacyHash && VIMEO_HASH_RE.test(privacyHash)) {
    embed.searchParams.set("h", privacyHash);
  }
  embed.searchParams.set("title", "0");
  embed.searchParams.set("byline", "0");
  embed.searchParams.set("portrait", "0");
  return {
    kind: "vimeo",
    embedUrl: embed.toString(),
    label: "Vimeo coach testimonial",
  };
}

function fromYoutube(url: URL): FoundationsVideo | null {
  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    const embed = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/);
    if (embed?.[1]) videoId = embed[1];
    else videoId = url.searchParams.get("v");
  } else {
    return null;
  }

  if (!videoId || !YT_ID_RE.test(videoId)) return null;
  return youtubeEmbed(videoId);
}

function fromVimeo(url: URL): FoundationsVideo | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;
  let privacyHash: string | null = url.searchParams.get("h");

  if (host === "player.vimeo.com") {
    const i = parts.indexOf("video");
    videoId = i >= 0 ? (parts[i + 1] ?? null) : (parts[0] ?? null);
  } else {
    // vimeo.com/{id} or vimeo.com/{id}/{privacyHash}
    videoId = parts[0] ?? null;
    if (!privacyHash && parts[1] && VIMEO_HASH_RE.test(parts[1])) {
      privacyHash = parts[1];
    }
  }

  if (!videoId || !VIMEO_ID_RE.test(videoId)) return null;
  return vimeoEmbed(videoId, privacyHash);
}

/** Accept watch, share, Shorts, or embed URLs. */
export function parseFoundationsVideoUrl(raw: string): FoundationsVideo | null {
  if (!raw?.trim()) return null;
  const url = parseHttps(raw);
  if (!url) return null;
  return fromYoutube(url) ?? fromVimeo(url);
}

export function parseFoundationsVideos(urls: string[] | undefined | null): FoundationsVideo[] {
  if (!Array.isArray(urls)) return [];
  const out: FoundationsVideo[] = [];
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const parsed = parseFoundationsVideoUrl(raw);
    if (parsed) out.push(parsed);
  }
  return out;
}
