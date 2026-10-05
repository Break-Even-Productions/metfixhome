import { Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MealPhoto } from "./MealPhoto";
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
  const videoId = belly.yt_url;
  const showWatch = hasMealPhoto && Boolean(videoId);
  const plainMacros = hasMealPhoto ? [] : visibleMacros(belly);
  const ingredients = belly.has_structured_ingredients ? sortedIngredients(belly.recipe_ingredients) : [];
  const steps = belly.has_structured_steps ? sortedSteps(belly.recipe_steps) : [];
  const [playing, setPlaying] = useState(false);
  const mealKey = day.date;

  useEffect(() => {
    setPlaying(false);
  }, [mealKey]);

  const onPlay = useCallback(() => setPlaying(true), []);
  const onClose = useCallback(() => setPlaying(false), []);

  return (
    <div>
      <h3 className="df-heading">{belly.title}</h3>
      {hasMealPhoto && photoUrl ? (
        <MealPhoto
          key={mealKey}
          dayKey={mealKey}
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
      {showWatch ? (
        <div className="df-belly-chrome">
          <button type="button" className="df-watch" onClick={onPlay}>
            <Play className="df-watch-icon" aria-hidden="true" />
            Watch video
          </button>
        </div>
      ) : null}
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
  return (
    <div>
      <h3 className="df-heading">{day.body.title}</h3>
      <HtmlBlock html={day.body.html} />
    </div>
  );
}

function BrainContent({ day }: { day: DailyFixDay }) {
  const href = day.brain.article_url?.trim();
  return (
    <div>
      <h3 className="df-heading">{day.brain.title}</h3>
      <HtmlBlock html={day.brain.html} />
      {href ? (
        <a className="df-article" href={href} target="_blank" rel="noreferrer">
          {brainButtonText(day.brain)}
          <span aria-hidden="true">→</span>
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
