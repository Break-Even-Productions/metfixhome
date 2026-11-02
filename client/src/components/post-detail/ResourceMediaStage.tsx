import { Lock } from "lucide-react";
import { joinCtaHref } from "@shared/library";
import type { DetailReaderModel } from "./types";

type ResourceMediaStageProps = {
  model: DetailReaderModel;
};

export function ResourceMediaStage({ model }: ResourceMediaStageProps) {
  const suppressPlayable =
    model.locked && model.access.show_video_in_preview !== true;
  const video = suppressPlayable ? null : model.video;

  if (video?.embedUrl) {
    return (
      <div className="resource-media-stage" data-testid="resource-media-stage">
        <iframe
          className="resource-media-stage__embed"
          src={video.embedUrl}
          title={`Video: ${model.title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (video?.url && video.kind === "self_hosted") {
    return (
      <div className="resource-media-stage" data-testid="resource-media-stage">
        <video
          className="resource-media-stage__video"
          controls
          preload="metadata"
          poster={model.image ?? undefined}
          src={video.url}
        />
      </div>
    );
  }

  if (model.image) {
    return (
      <div
        className={
          suppressPlayable
            ? "resource-media-stage resource-media-stage--locked"
            : "resource-media-stage"
        }
        data-testid="resource-media-stage"
      >
        <img
          className="resource-media-stage__image"
          src={model.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {suppressPlayable ? (
          <div className="resource-media-stage__lock" data-testid="resource-media-locked">
            <Lock size={28} strokeWidth={2} aria-hidden />
            <p className="resource-media-stage__lock-title">
              MetFix Professional Access Required
            </p>
            <a className="resource-media-stage__lock-cta" href={joinCtaHref()}>
              Join / Sign in
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  if (suppressPlayable) {
    return (
      <div
        className="resource-media-stage resource-media-stage--locked resource-media-stage--empty"
        data-testid="resource-media-stage"
      >
        <div className="resource-media-stage__lock" data-testid="resource-media-locked">
          <Lock size={28} strokeWidth={2} aria-hidden />
          <p className="resource-media-stage__lock-title">
            MetFix Professional Access Required
          </p>
          <a className="resource-media-stage__lock-cta" href={joinCtaHref()}>
            Join / Sign in
          </a>
        </div>
      </div>
    );
  }

  return null;
}
