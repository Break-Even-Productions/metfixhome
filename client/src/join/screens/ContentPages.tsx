import type { RecommendArticle, RecommendCourse } from "../types";
import { GoldButton, Kicker, Question } from "../ui";

export function ArticlePage({
  article,
  onBack,
}: {
  article: RecommendArticle;
  onBack: () => void;
}) {
  return (
    <article>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
        {article.category} · {article.minutes} read
      </p>
      <Question>{article.title}</Question>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--join-muted)]">{article.description}</p>
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-[var(--join-ink)]/85">
        {article.body.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>
      <div className="mt-10">
        <GoldButton onClick={onBack}>Back to your path</GoldButton>
      </div>
    </article>
  );
}

export function CoursePage({
  course,
  onBack,
}: {
  course: RecommendCourse;
  onBack: () => void;
}) {
  return (
    <div>
      <Kicker>{course.category}</Kicker>
      <Question>{course.title}</Question>
      {course.badge ? (
        <p className="mt-4 inline-block rounded-full bg-[var(--join-accent)]/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--join-ink)]">
          {course.badge}
        </p>
      ) : null}
      <p className="mt-5 text-[15px] leading-relaxed text-[var(--join-muted)]">{course.description}</p>
      <p className="mt-3 text-sm text-[var(--join-muted-2)]">{course.hours}</p>
      <div className="mt-8">
        <GoldButton onClick={onBack}>Back to your path</GoldButton>
      </div>
    </div>
  );
}
