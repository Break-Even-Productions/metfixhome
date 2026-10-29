import { Check } from "lucide-react";
import { useRef, useState } from "react";
import {
  ORG_AFFILIATE_NOTE,
  ORG_CARD_HEADER,
  PRO_CARD_HEADER,
  showOrganizationOwnerCard,
} from "@shared/join";
import { fetchCsrf, postWhopCheckout } from "../api";
import { recommendedArticles, recommendedCourses } from "../data";
import type { JoinProfile, RecommendArticle, RecommendCourse, WhopPlan } from "../types";
import { GoldButton } from "../ui";

const railClass =
  "-mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-3 scrollbar-hide md:-mx-8 md:px-8";

const itemClass = "w-[17.5rem] shrink-0 snap-start sm:w-[20rem]";

function PhoneMock() {
  return (
    <div
      data-testid="phone-mock"
      className="relative mx-auto h-[22rem] w-[11.5rem] rounded-[2.2rem] border-[6px] border-[var(--join-ink)] bg-[var(--join-ink)] shadow-[0_24px_50px_rgba(0,0,0,0.28)]"
    >
      <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-[var(--join-ink-3)]" />
      <div className="absolute inset-[8px] overflow-hidden rounded-[1.7rem] bg-[var(--join-cream)]">
        <div className="bg-[var(--join-ink)] px-3 pb-3 pt-7 text-[var(--join-cream)]">
          <p className="font-serif text-lg">MetFix</p>
          <p className="mt-1 text-[10px] text-[var(--join-cream)]/60">Your next lesson</p>
        </div>
        <div className="space-y-2 p-3">
          <div className="h-16 rounded-2xl bg-[var(--join-accent)]/50" />
          <div className="h-10 rounded-2xl bg-[var(--join-cream-2)]" />
          <div className="h-10 rounded-2xl bg-[var(--join-cream-2)]" />
          <div className="h-10 rounded-2xl bg-[var(--join-cream-2)]" />
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  items,
  cta,
  onCta,
  note,
  busy,
  href,
}: {
  title: string;
  price: string;
  items: string[];
  cta: string;
  onCta?: () => void;
  note?: string;
  busy?: boolean;
  href?: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-[1.6rem] border border-[var(--join-line-light)] bg-[var(--join-ink-2)] p-6 md:p-7">
      <h3 className="font-serif text-2xl text-[var(--join-cream)]">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--join-accent-3)]">
        {price}
      </p>
      {note ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--join-cream)]/65">{note}</p>
      ) : null}
      <ul className="mt-5 flex-1 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-[var(--join-cream)]/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--join-accent-3)]" />
            {item}
          </li>
        ))}
      </ul>
      {href ? (
        <a
          href={href}
          className="mt-6 block w-full rounded-full bg-[var(--join-accent)] py-3 text-center text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)]"
        >
          {cta}
        </a>
      ) : (
        <button
          type="button"
          onClick={onCta}
          disabled={busy}
          className="mt-6 w-full rounded-full bg-[var(--join-accent)] py-3 text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)] disabled:opacity-70"
        >
          {busy ? "Starting checkout…" : cta}
        </button>
      )}
    </article>
  );
}

export function RecommendedPath({
  profile,
  onStartCourse,
  onOpenArticle,
}: {
  profile: JoinProfile;
  onStartCourse: (course: RecommendCourse) => void;
  onOpenArticle: (article: RecommendArticle) => void;
}) {
  const courses = recommendedCourses(profile.roles);
  const articles = recommendedArticles(profile.roles);
  const isCoach = profile.roles.includes("coach");
  const isGym = profile.roles.includes("gym_owner");
  const isClinician = profile.roles.includes("clinician");
  const isResponder = profile.roles.includes("first_responder");
  const showCoach = isCoach || isGym;
  const showOrg = showOrganizationOwnerCard(
    profile.roles,
    profile.hasPhysicalGym,
    profile.hasPhysicalClinic,
  );

  const [checkoutBusy, setCheckoutBusy] = useState<WhopPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const inflight = useRef(false);

  const startCheckout = async (plan: WhopPlan) => {
    if (inflight.current) return;
    inflight.current = true;
    setCheckoutBusy(plan);
    setCheckoutError(null);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setCheckoutError("Could not start a secure session.");
        return;
      }
      const result = await postWhopCheckout(plan, csrf, "/join?step=path");
      if (!result.ok) {
        setCheckoutError("Checkout is temporarily unavailable.");
        return;
      }
      window.location.assign(result.checkout_url);
    } catch {
      setCheckoutError("Checkout is temporarily unavailable.");
    } finally {
      inflight.current = false;
      setCheckoutBusy(null);
    }
  };

  let appNote = "";
  if (isCoach) {
    appNote =
      "MetFix Coaches can also use the app with their clients after earning their Foundations Coach credential.";
  }
  if (isGym) {
    appNote = appNote
      ? `${appNote} MetFix Affiliate locations can use the app as part of their client experience.`
      : "MetFix Affiliate locations can use the app as part of their client experience.";
  }

  return (
    <div className="pb-8">
      <p className="font-serif text-lg text-[var(--join-accent-2)]">
        Welcome, {profile.firstName}.
      </p>
      <h1 className="mt-2 font-serif text-4xl leading-[1.1] text-[var(--join-ink)] md:text-5xl">
        Your recommended path
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--join-muted)]">
        Based on what you told us, here’s where we recommend starting.
      </p>

      <div className="mt-8 rounded-[1.5rem] border border-[var(--join-accent)]/40 bg-[var(--join-accent)]/20 px-5 py-4 md:px-6">
        <p className="font-serif text-xl text-[var(--join-ink)]">Your first month is on us.</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--join-ink)]/75">
          Explore MetFix classes, resources, and tools free for 30 days.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-3xl text-[var(--join-ink)]">Start with these courses</h2>
        <div className={railClass} tabIndex={0} aria-label="Recommended courses">
          {courses.map((course) => (
            <article
              key={course.id}
              className={`${itemClass} flex flex-col overflow-hidden rounded-[1.6rem] border border-[var(--join-line)] bg-[var(--join-paper)] shadow-[0_12px_30px_rgba(23,21,18,0.04)]`}
            >
              <div
                className="aspect-[16/8] w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${course.image}), ${course.tone}` }}
                role="img"
                aria-label={course.title}
              />
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
                  {course.category}
                </p>
                <h3 className="mt-1 font-serif text-2xl text-[var(--join-ink)]">{course.title}</h3>
                {course.badge ? (
                  <p className="mt-2 inline-block rounded-full bg-[var(--join-accent)]/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--join-ink)]">
                    {course.badge}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-[var(--join-muted)]">
                  {course.description}
                </p>
                <p className="mt-3 flex-1 text-xs text-[var(--join-muted-2)]">{course.hours}</p>
                <button
                  type="button"
                  onClick={() => onStartCourse(course)}
                  className="mt-5 self-start rounded-full bg-[var(--join-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)]"
                >
                  Start course
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-3xl text-[var(--join-ink)]">Resources picked for you</h2>
        <div className={railClass} tabIndex={0} aria-label="Recommended resources">
          {articles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => onOpenArticle(article)}
              className={`${itemClass} rounded-[1.4rem] border border-[var(--join-line)] bg-[var(--join-paper)] p-5 text-left transition-shadow duration-300 ease-out hover:shadow-[0_12px_28px_rgba(23,21,18,0.06)]`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
                {article.category}
              </p>
              <h3 className="mt-1 font-serif text-xl text-[var(--join-ink)]">{article.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--join-muted)]">
                {article.description}
              </p>
              <p className="mt-3 text-xs text-[var(--join-muted-2)]">{article.minutes} read</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-14 overflow-hidden rounded-[1.8rem] bg-[var(--join-paper)] px-6 py-10 md:px-10">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-serif text-3xl text-[var(--join-ink)]">Take MetFix with you</h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--join-muted)]">
              Learn, track your progress, and access MetFix wherever you are.
            </p>
            {appNote ? (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--join-ink)]/80">
                {appNote}
              </p>
            ) : null}
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="mt-14 overflow-hidden rounded-[1.8rem] bg-[var(--join-ink)] px-5 py-10 text-[var(--join-cream)] md:px-8 md:py-12">
        <h2 className="font-serif text-3xl">Your membership</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--join-cream)]/65">
          {isResponder
            ? "Start with first-responder classes and resources. Your membership unlocks the full library after a free month."
            : "Your first month is free. Foundations Coach is a qualification path — not a paid subscription tier."}
        </p>
        {checkoutError ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {checkoutError}
          </p>
        ) : null}
        <div
          className="-mx-5 mt-8 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 scrollbar-hide md:-mx-8 md:px-8"
          tabIndex={0}
          aria-label="Membership options"
        >
          {/* WJ11: MetFix Pro always shown (Trap 4 fix) */}
          <div className={`${itemClass} flex`} data-testid="pro-plan-card">
            <PlanCard
              title="MetFix Membership"
              price={PRO_CARD_HEADER.replace(/ · /g, "\n")}
              items={[
                "Full access to online courses (including MetFix Essentials)",
                "The Daily Fix workouts & recipes",
                "Full video and article library",
                "Cumulative LTV Certificate Claiming — every monthly payment builds your certificate budget, or buy any course directly at its listed price",
                "App access",
              ]}
              cta="Start my free month"
              busy={checkoutBusy === "pro"}
              onCta={() => void startCheckout("pro")}
            />
          </div>

          {showCoach ? (
            <div className={`${itemClass} flex`} data-testid="coach-plan-card">
              <PlanCard
                title="Become a Foundations Coach"
                price="Two qualification paths · Valid 3 years"
                note="Foundations Coach is never granted by a four-figure LTV spend threshold and is not a paid subscription tier. Both paths carry a 3-year credential expiration (expires_at)."
                items={[
                  "Path A — In-Person Seminar (valid 3 years): Attend an in-person MetFix Seminar (checked in on-site).",
                  "Path B — Online MetFix Essentials + Certificate Claimed (valid 3 years): Complete MetFix Essentials AND claim the certificate via cumulative LTV budget or direct purchase.",
                ]}
                cta="Start MetFix Essentials"
                href="/library"
              />
            </div>
          ) : null}

          {showCoach ? (
            <div className={`${itemClass} flex`} data-testid="seminars-cta-card">
              <PlanCard
                title="In-person seminars"
                price="Valid for 3 years from check-in"
                items={[
                  "Register for an upcoming MetFix Seminar",
                  "Check in on-site to start your 3-year Foundations Coach credential",
                ]}
                cta="View Upcoming Seminars"
                // Ruling (b): prefer /seminars when routed; App only mounts /affiliate-seminars.
                href="/affiliate-seminars"
              />
            </div>
          ) : null}

          {showOrg ? (
            <div className={`${itemClass} flex`} data-testid="org-plan-card">
              <PlanCard
                title="Become a MetFix Affiliate"
                price={ORG_CARD_HEADER.replace(/ · /g, "\n")}
                note={`${ORG_AFFILIATE_NOTE} Covers Gym Affiliates and Doctor / Clinical Practice locations.`}
                items={[
                  "Full MetFix Pro access included ($30/month MetFix Pro is included)",
                  "Organization Owner tier for Gym Affiliate & Doctor Practice",
                  "Location listing and affiliate resources",
                  "App access for use with clients",
                ]}
                cta="Start my Affiliate membership"
                busy={checkoutBusy === "org"}
                onCta={() => void startCheckout("org")}
              />
            </div>
          ) : null}

          {isClinician ? (
            <div className={`${itemClass} flex`} data-testid="medical-society-info">
              <PlanCard
                title="MetFix Medical Society"
                price="Directory listing & clinical peer network"
                note="Medical Society is not a separate paid subscription tier. Clinicians with a physical clinic use Organization Owner ($170/month); others use MetFix Pro ($30/month)."
                items={[
                  "Clinical directory listing",
                  "Peer network and clinician resources",
                ]}
                cta="Explore Medical Society"
                href="/join?explore=medical-society"
              />
            </div>
          ) : null}
        </div>
      </section>

      <p className="mt-8 text-center text-sm text-[var(--join-muted)]">
        You can explore the rest of MetFix anytime. Your first month stays free.
      </p>
      <div className="mx-auto mt-4 max-w-xs">
        <GoldButton
          onClick={() =>
            document.getElementById("join-scroll")?.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          Back to your path
        </GoldButton>
      </div>
    </div>
  );
}
