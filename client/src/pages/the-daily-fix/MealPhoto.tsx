import { Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { initLiquidGlass } from "./liquidGlass";
import {
  glassMacroRows,
  youtubeEmbedUrl,
  type BellyMacros,
} from "./model";

type LiquidGlassInstance = { destroy: () => void };

type MealPhotoProps = {
  /** day.date — identity for one glass instance per shown day */
  dayKey: string;
  title: string;
  photoUrl: string;
  /** Parsed 11-char YouTube id, or null */
  videoId: string | null;
  macros: BellyMacros;
  playing: boolean;
  onPlay: () => void;
  onClose: () => void;
};

/**
 * Belly meal photo: 16/9 still, optional frosted macros + play, iframe only after click.
 * LiquidGlass loads dynamically after a CORS-capable photo load — never in the main App chunk.
 */
export function MealPhoto({
  dayKey,
  title,
  photoUrl,
  videoId,
  macros,
  playing,
  onPlay,
  onClose,
}: MealPhotoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const macrosRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [crossOrigin, setCrossOrigin] = useState<"anonymous" | undefined>("anonymous");
  const [corsPlain, setCorsPlain] = useState(false);
  const [glassFailed, setGlassFailed] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);

  const glassDisabled = corsPlain || glassFailed;
  const glassRows = glassMacroRows(macros);
  const showPlay = Boolean(videoId) && !playing;
  // Glass macros card only with a CORS-capable photo and successful glass boot.
  const showGlassMacros = !glassDisabled && !playing && glassRows.length > 0;
  const canInitGlass =
    !glassDisabled && !playing && photoReady && (glassRows.length > 0 || Boolean(videoId));

  // Cached images may already be complete on mount (e.g. switching back to Belly).
  // key={day.date} on MealPhoto resets React state — no separate reset effect.
  useLayoutEffect(() => {
    const photo = photoRef.current;
    if (photo?.complete && photo.naturalWidth > 0) {
      setPhotoReady(true);
    }
  }, [crossOrigin, photoUrl]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".df-watch")) return;
      const frame = videoFrameRef.current;
      if (frame && target instanceof Node && frame.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        iframe.focus();
      } catch {
        /* ignore cross-origin focus failures */
      }
    }
  }, [playing]);

  useEffect(() => {
    if (!canInitGlass) return;
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    let instance: LiquidGlassInstance | null = null;

    const glassElements: HTMLElement[] = [];
    if (macrosRef.current && showGlassMacros) glassElements.push(macrosRef.current);
    if (playRef.current && showPlay) glassElements.push(playRef.current);
    if (glassElements.length === 0) return;

    void initLiquidGlass({
      root,
      glassElements,
      defaults: {
        brightness: -0.15,
        blurAmount: 0.22,
        cornerRadius: 32,
        button: true,
      },
    })
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        instance = next;
      })
      .catch(() => {
        if (!cancelled) setGlassFailed(true);
      });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [canInitGlass, dayKey, photoUrl, showGlassMacros, showPlay, playing]);

  const onImgError = () => {
    if (crossOrigin === "anonymous") {
      setCrossOrigin(undefined);
      setCorsPlain(true);
      setPhotoReady(false);
      setGlassFailed(false);
      return;
    }
  };

  const onImgLoad = () => {
    setPhotoReady(true);
  };

  const frameClass = ["df-meal-photo", playing ? "df-meal-photo-playing" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={frameClass} data-day={dayKey}>
      <img
        key={`${dayKey}-${crossOrigin ?? "plain"}`}
        ref={photoRef}
        className="df-meal-photo-img"
        src={photoUrl}
        alt={title}
        width={1024}
        height={576}
        decoding="async"
        crossOrigin={crossOrigin}
        onError={onImgError}
        onLoad={onImgLoad}
      />
      {playing && videoId ? (
        <div ref={videoFrameRef} className="df-meal-photo-video">
          <iframe
            ref={iframeRef}
            src={youtubeEmbedUrl(videoId)}
            title={`${title} short`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            tabIndex={0}
          />
        </div>
      ) : null}
      {showPlay ? (
        <button
          ref={playRef}
          type="button"
          className="df-meal-play"
          onClick={onPlay}
          aria-label="Play the short"
          data-config='{"brightness":-0.15,"blurAmount":0.22,"cornerRadius":32,"button":true}'
        >
          <Play className="df-meal-play-icon" aria-hidden="true" />
        </button>
      ) : null}
      {showGlassMacros ? (
        <div
          ref={macrosRef}
          className="df-meal-macros"
          data-config='{"brightness":-0.4,"blurAmount":0.3,"cornerRadius":22,"button":false}'
        >
          <div className="df-meal-macros-inner">
            <p className="df-meal-macros-label">Per serving</p>
            <dl className="df-meal-macros-list">
              {glassRows.map((row) => (
                <div key={row.label}>
                  <dd>{row.grams}g</dd>
                  <dt>{row.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
