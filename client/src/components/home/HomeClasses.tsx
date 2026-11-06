import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { assetUrl } from "@/const";
import { COURSE_FILTERS, type CourseFilter } from "@/data/home/audience";
import { useCoursePurchase } from "@/lib/coursePurchase";
import type { HomeCourseCard } from "@/lib/homeTypes";
import { easeOutExpo, fadeUp, stagger } from "./motion";
import { Reveal } from "./Reveal";
import { SectionCard, SectionPad } from "./SectionCard";

type HomeClassesProps = {
  onJoin: () => void;
  courses: HomeCourseCard[];
};

function resolveCourseImage(src: string | undefined): string | null {
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  return assetUrl(src);
}

function courseStatusLabel(course: HomeCourseCard): string {
  if (course.live) return "Enroll";
  if (course.notify) return "Notify Me";
  return "Coming Soon";
}

function CourseCard({ course, onJoin }: { course: HomeCourseCard; onJoin: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = !imageFailed ? resolveCourseImage(course.image) : null;
  const canBuy = Boolean(course.live && course.bsiPostId);
  const statusLabel = courseStatusLabel(course);
  const { signedIn, buying, error: buyError, buy, emailModal } = useCoursePurchase(
    course.bsiPostId,
  );

  const openLanding = () => {
    if (!course.href || course.href === "#") return;
    if (course.href.startsWith("http")) {
      window.open(course.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(course.href);
    }
  };

  return (
    <motion.article
      layout
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="group w-[min(18.75rem,78%)] shrink-0 cursor-pointer md:w-[20.5rem]"
      id={`course-${course.id}`}
      role="link"
      tabIndex={0}
      aria-label={`Open ${course.name}`}
      onClick={openLanding}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLanding();
        }
      }}
    >
      <div className="relative overflow-hidden rounded-[1.35rem] bg-ink-2 transition-[transform,translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
        {image ? (
          <img
            src={image}
            alt=""
            decoding="async"
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="course-photo pointer-events-none absolute inset-x-0 top-0 aspect-video w-full object-cover transition-transform duration-700 ease-out will-change-transform"
          />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 aspect-video bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--color-accent)_38%,transparent),rgba(44,41,37,0.15)_70%)]"
          />
        )}
        <div className="relative z-10">
          <div className="relative aspect-video">
            <p className="absolute bottom-3 left-3 w-fit bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {course.label}
            </p>
          </div>
          <div className="card-body px-4 pb-4 pt-3">
            <h3 className="font-serif text-[1.15rem] leading-snug">{course.name}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-current/80">
              <Clock className="h-3.5 w-3.5" />
              {course.tag}
            </p>
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-current/80">{course.desc}</p>
            <div className="mt-3 border-t border-current/20 pt-3">
              {canBuy ? (
                <div
                  className="flex flex-col gap-2"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {emailModal}
                  <button
                    type="button"
                    disabled={buying || signedIn == null}
                    aria-busy={buying || undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void buy();
                    }}
                    className="course-buy-btn inline-flex w-full items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-[#171512] shadow-[0_1px_0_rgba(23,21,18,0.04)] transition-[background-color,box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-px hover:border-ink/15 hover:bg-cream hover:shadow-[0_8px_20px_rgba(23,21,18,0.08)] disabled:cursor-wait disabled:opacity-70"
                  >
                    {buying ? "Opening…" : "Buy Now"}
                  </button>
                </div>
              ) : (
                <p className="font-serif text-[1.35rem] leading-none tracking-tight">{statusLabel}</p>
              )}
              {course.live || course.notify ? (
                <p className="mt-2 text-[12.5px] font-bold leading-snug text-current">
                  or Free with{" "}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onJoin();
                    }}
                    className="font-bold underline decoration-current/45 underline-offset-[3px] transition-opacity duration-300 ease-out hover:opacity-70"
                  >
                    membership
                  </button>
                </p>
              ) : null}
              {buyError ? (
                <p className="mt-1.5 text-[12px] leading-snug text-red-300" role="alert">
                  {buyError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function HomeClasses({ onJoin, courses }: HomeClassesProps) {
  const [active, setActive] = useState<CourseFilter>("All Classes");

  const visible = useMemo(() => {
    if (active === "All Classes") return courses;
    const needle = active.toLowerCase().replace(/s$/, "");
    return courses.filter((c) =>
      [c.label, c.name, c.desc, c.tag].some((part) => part.toLowerCase().includes(needle)),
    );
  }, [active, courses]);

  return (
    <SectionCard id="classes" tone="ink">
      <SectionPad>
        <Reveal className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl md:text-[2.6rem]">Explore MetFix Classes</h2>
          <Link
            href="/courses"
            className="hidden items-center gap-1 text-sm text-cream/80 transition-colors duration-300 ease-out hover:text-cream sm:inline-flex"
          >
            View All Classes
            <span aria-hidden="true">→</span>
          </Link>
        </Reveal>

        <LayoutGroup>
          <div className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide md:flex-wrap">
            {COURSE_FILTERS.map((filter) => {
              const isActive = filter === active;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActive(filter)}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-300 ease-out ${
                    isActive ? "text-ink" : "text-cream/80 hover:text-cream"
                  }`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="filter-pill"
                      className="absolute inset-0 rounded-full bg-accent"
                      transition={{ duration: 0.4, ease: easeOutExpo }}
                    />
                  ) : (
                    <span className="absolute inset-0 rounded-full border border-line-light" />
                  )}
                  <span className="relative z-[1]">{filter}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <motion.div
          data-course-rail
          className="course-rail mt-5 flex gap-4 overflow-x-auto overscroll-x-contain scrollbar-hide"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <AnimatePresence mode="popLayout">
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} onJoin={onJoin} />
            ))}
          </AnimatePresence>
        </motion.div>

        {visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-cream/60">
            More classes in this path are coming soon.
          </p>
        ) : null}

        <div className="mt-8 flex justify-end md:mt-10">
          <button
            type="button"
            onClick={onJoin}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-accent-2"
          >
            Join now to get all classes
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </SectionPad>
    </SectionCard>
  );
}
