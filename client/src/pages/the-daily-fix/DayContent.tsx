import { ArrowUpRight, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { MealPhoto } from "./MealPhoto";
import { ShareMenu } from "./ShareMenu";
import {
  brainButtonText,
  sortedIngredients,
  sortedSteps,
  visibleMacros,
  type DailyFixDay,
  type Pillar,
} from "./model";

function HtmlBlock({ html }: { html: string }) {
  return <div className="df-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

function BellyContent({ day }: { day: DailyFixDay }) {
  const { belly } = day;
  const photoUrl = belly.photo_url;
  const hasMealPhoto = Boolean(photoUrl);
  const videoId = belly.yt_id;
  const showWatch = hasMealPhoto && Boolean(videoId);
  // Spec B2c: MealPhoto mounted → never show plain .df-macros (even CORS/glassFailed/all-0).
  const plainMacros = hasMealPhoto ? [] : visibleMacros(belly);
  const ingredients = belly.has_structured_ingredients ? sortedIngredients(belly.recipe_ingredients) : [];
  const steps = belly.has_structured_steps ? sortedSteps(belly.recipe_steps) : [];
  // DayContent is keyed by day.date in DayPanel, so playing resets on date change.
  const [playing, setPlaying] = useState(false);

  const onPlay = useCallback(() => setPlaying(true), []);
  const onClose = useCallback(() => setPlaying(false), []);

  return (
    <div>
      <h3 className="df-heading">{belly.title}</h3>
      {hasMealPhoto && photoUrl ? (
        <MealPhoto
          key={day.date}
          dayKey={day.date}
          title={belly.title}
          photoUrl={photoUrl}
          videoId={videoId}
          macros={belly}
          playing={playing}
          onPlay={onPlay}
          onClose={onClose}
        />
      ) : null}
      {plainMacros.length > 0 ? (
        <dl className="df-macros">
          {plainMacros.map((row) => (
            <div key={row.label}>
              <dd>{row.grams}g</dd>
              <dt>{row.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="df-chrome">
        <ShareMenu dateIso={day.date} pillar="belly" title={belly.title} />
        {showWatch ? (
          <button type="button" className="df-watch" onClick={onPlay}>
            <Play className="df-watch-icon" aria-hidden="true" />
            Watch video
          </button>
        ) : null}
      </div>
      <div className="df-recipe">
        <div>
          <h4>Ingredients</h4>
          {belly.has_structured_ingredients ? (
            <ul className="df-list">
              {ingredients.map((item) => (
                <li key={`${item.sort_order}-${item.display}`}>
                  <span aria-hidden="true">—</span>
                  {item.display}
                </li>
              ))}
            </ul>
          ) : belly.body ? (
            <HtmlBlock html={belly.body} />
          ) : null}
        </div>
        <div>
          <h4>Method</h4>
          {belly.has_structured_steps ? (
            <ol className="df-list">
              {steps.map((step, index) => (
                <li key={`${step.sort_order}-${index}`}>
                  <span className="df-serif">{index + 1}.</span>
                  {step.instruction}
                </li>
              ))}
            </ol>
          ) : belly.steps ? (
            <HtmlBlock html={belly.steps} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BodyContent({ day }: { day: DailyFixDay }) {
  const { body } = day;
  const prescription = body.legacy && body.hasContent ? body.excerpt : null;
  return (
    <div>
      <h3 className="df-heading">{body.title}</h3>
      <div className="df-chrome">
        <ShareMenu dateIso={day.date} pillar="body" title={body.title} />
      </div>
      {prescription ? <HtmlBlock html={prescription} /> : null}
      <HtmlBlock html={body.html} />
      {body.scale ? <HtmlBlock html={body.scale} /> : null}
    </div>
  );
}

function BrainContent({ day }: { day: DailyFixDay }) {
  const { brain } = day;
  const href = brain.article_url?.trim();
  return (
    <div>
      <h3 className="df-heading">{brain.title}</h3>
      {brain.photo_url ? (
        <img
          className="df-photo"
          src={brain.photo_url}
          alt={brain.title}
          width={1024}
          height={576}
          decoding="async"
        />
      ) : null}
      <div className="df-chrome">
        <ShareMenu dateIso={day.date} pillar="brain" title={brain.title} />
      </div>
      <HtmlBlock html={brain.html} />
      {href ? (
        <a className="df-btn df-btn-ink df-article" href={href} target="_blank" rel="noreferrer">
          {brainButtonText(brain)}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

export function DayContent({ day, pillar }: { day: DailyFixDay; pillar: Pillar }) {
  if (pillar === "body") return <BodyContent day={day} />;
  if (pillar === "brain") return <BrainContent day={day} />;
  return <BellyContent day={day} />;
}
