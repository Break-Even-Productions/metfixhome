import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [crossOrigin, setCrossOrigin] = useState<"anonymous" | undefined>("anonymous");
  const [corsPlain, setCorsPlain] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const glassRows = glassMacroRows(macros);
  const showPlay = Boolean(videoId) && !playing;
  // Glass macros card only with a CORS-capable photo; never a CSS glass stand-in.
  const showGlassMacros = !corsPlain && !playing && glassRows.length > 0;
  const canInitGlass =
    !corsPlain && !playing && photoReady && (glassRows.length > 0 || Boolean(videoId));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Reset CORS / load state when the day or photo changes.
  useEffect(() => {
    setCrossOrigin("anonymous");
    setCorsPlain(false);
    setPhotoReady(false);
  }, [dayKey, photoUrl]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onPointer = (event: PointerEvent) => {
      const frame = videoFrameRef.current;
      if (frame && event.target instanceof Node && frame.contains(event.target)) return;
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
    if (!canInitGlass) return;
    const root = rootRef.current;
    const photo = photoRef.current;
    if (!root || !photo) return;

    let cancelled = false;
    let instance: LiquidGlassInstance | null = null;

    const boot = () => {
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
      }).then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        instance = next;
      });
    };

    if (photo.complete && photo.naturalWidth > 0) boot();
    else photo.addEventListener("load", boot, { once: true });

    return () => {
      cancelled = true;
      photo.removeEventListener("load", boot);
      instance?.destroy();
    };
  }, [canInitGlass, dayKey, photoUrl, showGlassMacros, showPlay, playing]);

  const onImgError = () => {
    if (crossOrigin === "anonymous") {
      setCrossOrigin(undefined);
      setCorsPlain(true);
      setPhotoReady(false);
      return;
    }
  };

  const onImgLoad = () => {
    setPhotoReady(true);
  };

  const frameClass = [
    "df-meal-photo",
    playing ? "df-meal-photo-playing" : "",
    reduceMotion ? "df-meal-photo-reduce" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={frameClass} data-day={dayKey}>
      <img
        key={`${dayKey}-${crossOrigin ?? "plain"}`}
        ref={photoRef}
        className="df-meal-photo-img"
        src={photoUrl}
        alt={playing ? "" : title}
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
            src={youtubeEmbedUrl(videoId)}
            title={`${title} short`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
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
