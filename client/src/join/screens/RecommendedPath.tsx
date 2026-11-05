import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ORG_AFFILIATE_NOTE,
  ORG_CARD_HEADER,
  PRO_CARD_HEADER,
  showOrganizationOwnerCard,
} from "@shared/join";
import { basePath } from "@/const";
import { useCourses } from "@/hooks/useSanityContent";
import { loadOverview, loadSubscriptions } from "@/lib/account";
import { sanitizeClientBillingUrl } from "@/lib/billing-url";
import { fetchCsrf, postWhopCheckout } from "../api";
import { shouldSkipProRecommendation } from "../membership-access";
import {
  courseLandingHref,
  recommendedStartCourses,
  type RecommendedStartCourse,
} from "../data";
import type { JoinProfile } from "../types";

/** After Whop, land back in Join on the post-purchase path. */
const JOIN_AFTER_CHECKOUT = "/join?purchased=1";

/** Live destinations already routed in App.tsx. Order is the recommended sequence. */
const NEXT_STEPS = [
  {
    href: "/account",
    label: "Go to Dashboard",
    detail: "Open your account overview, billing, and courses.",
    primary: true,
  },
  {
    href: "/courses",
    label: "Course list",
    detail: "Browse the MetFix course catalog, including MetFix Essentials.",
    primary: false,
  },
  {
    href: "/library",
    label: "Resources",
    detail: "Read articles, podcasts, and the rest of the library.",
    primary: false,
  },
] as const;

const PRO_BENEFITS = [
  "1 Free Online Course per month",
  "The Daily Fix workouts & recipes",
  "Exclusive resources",
  "AI Tools",
  "App access",
] as const;

const AFFILIATE_BENEFITS = [
  "Full MetFix Membership included ($30/month MetFix Pro is included)",
  "Unlimited online courses",
  "Exclusive resources",
  "AI Tools",
  "Location listing and affiliate resources",
  "App access for use with clients",
] as const;

function PlanCard({
  title,
  price,
  items,
  cta,
  onCta,
  note,
  busy,
  href,
  featured = false,
}: {
  title: string;
  price: string;
  items: readonly string[];
  cta: string;
  onCta?: () => void;
  note?: string;
  busy?: boolean;
  href?: string;
  featured?: boolean;
}) {
  const actionClass = featured
    ? "mt-6 inline-flex w-full items-center justify-center rounded-full bg-[var(--join-accent)] px-6 py-3 text-center text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)] sm:w-auto"
    : "mt-6 block w-full rounded-full bg-[var(--join-accent)] py-3 text-center text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)]";
  const action =
    href != null ? (
      <a
        href={href}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className={`${actionClass} disabled:opacity-70`}
      >
        {cta}
      </a>
    ) : onCta ? (
      <button
        type="button"
        onClick={onCta}
        disabled={busy}
        className={`${actionClass} disabled:opacity-70`}
      >
        {busy ? "Starting checkout…" : cta}
      </button>
    ) : null;
  const heading = (
    <>
      <h3
        className={`font-serif text-[var(--join-cream)] ${featured ? "text-3xl" : "text-2xl"}`}
      >
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--join-accent-3)]">
        {price}
      </p>
      {note ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--join-cream)]/65">
          {note}
        </p>
      ) : null}
    </>
  );
  const benefits = (
    <ul className={`space-y-2 ${featured ? "mt-6 md:mt-1" : "mt-5 flex-1"}`}>
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm text-[var(--join-cream)]/80"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--join-accent-3)]" />
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <article
      className={`flex h-full w-full flex-col rounded-[1.6rem] border border-[var(--join-line-light)] bg-[var(--join-ink-2)] p-6 md:p-7 ${
        featured ? "md:p-8" : ""
      }`}
    >
      {featured ? (
        <div className="md:grid md:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.1fr)] md:items-start md:gap-10">
          <div>
            {heading}
            {action}
          </div>
          {benefits}
        </div>
      ) : (
        <>
          {heading}
          {benefits}
          {action}
        </>
      )}
    </article>
  );
}

function CourseCard({ course, href }: RecommendedStartCourse) {
  const stat = course.stats[0];
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col rounded-[1.4rem] border border-[var(--join-ink)]/25 bg-white p-5 shadow-[0_10px_24px_rgba(23,21,18,0.07)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--join-accent-2)] hover:shadow-[0_16px_32px_rgba(23,21,18,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--join-accent-2)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--join-accent-2)]">
        {course.audience || course.tag}
      </p>
      <h3 className="mt-2 font-serif text-2xl text-[var(--join-ink)]">{course.title}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--join-ink)]/80">
        {course.details}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--join-ink)]">
        {course.price || stat?.value || "View course"}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}

function NextSteps() {
  return (
    <section className="mt-8" aria-label="Recommended next steps" data-testid="next-steps">
      <ol className="space-y-3">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.href}>
            <a
              href={basePath(step.href)}
              className={
                step.primary ? "join-next-step join-next-step--primary" : "join-next-step"
              }
            >
              <span className="join-next-step__index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="join-next-step__label">{step.label}</span>
                <span className="join-next-step__detail">{step.detail}</span>
              </span>
              <ArrowRight className="join-next-step__arrow h-4 w-4" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RecommendedPath({
  profile,
  purchased,
  onOpenAffiliate,
}: {
  profile: JoinProfile;
  purchased: boolean;
  onOpenAffiliate: () => void;
}) {
  const isCoach = profile.roles.includes("coach");
  const isGym = profile.roles.includes("gym_owner");
  const isClinician = profile.roles.includes("clinician");
  const showCoach = isCoach || isGym;
  const showOrg = showOrganizationOwnerCard(
    profile.roles,
    profile.hasPhysicalGym,
    profile.hasPhysicalClinic,
  );
  const { courses: catalog } = useCourses();
  const courses = recommendedStartCourses(catalog, profile.roles);
  const essentialsHref =
    catalog
      .filter((course) => /essentials/i.test(course.title))
      .map((course) => courseLandingHref(course))
      .find((href): href is string => href != null) ?? basePath("/courses");

  const [phase, setPhase] = useState<"loading" | "plans" | "path">(
    purchased ? "path" : "loading",
  );
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    if (purchased) {
      setPhase("path");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    Promise.allSettled([
      loadSubscriptions({ force: true }),
      loadOverview({ force: true }),
    ]).then(([subsResult, overviewResult]) => {
      if (cancelled) return;
      const subs = subsResult.status === "fulfilled" ? subsResult.value : null;
      const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      if (!subs && !overview) {
        setPhase("plans");
        return;
      }
      setPhase(shouldSkipProRecommendation(subs, overview) ? "path" : "plans");
    });
    return () => {
      cancelled = true;
    };
  }, [purchased]);

  const startCheckout = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setCheckoutError("Could not start a secure session.");
        return;
      }
      const result = await postWhopCheckout("pro", csrf, JOIN_AFTER_CHECKOUT);
      if (!result.ok) {
        setCheckoutError("Checkout is temporarily unavailable.");
        return;
      }
      const checkoutUrl = sanitizeClientBillingUrl(
        result.checkout_url,
        "whop_only",
      );
      if (!checkoutUrl) {
        setCheckoutError("Checkout is temporarily unavailable.");
        return;
      }
      window.location.assign(checkoutUrl);
    } catch {
      setCheckoutError("Checkout is temporarily unavailable.");
    } finally {
      inflight.current = false;
      setCheckoutBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <p className="text-sm text-[var(--join-muted)]" data-testid="path-loading">
        Checking your membership…
      </p>
    );
  }

  if (phase === "path") {
    return (
      <div className="pb-8" data-testid="path-step">
        <p className="font-serif text-lg text-[var(--join-accent-2)]">
          Welcome, {profile.firstName}.
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-[1.1] text-[var(--join-ink)] md:text-5xl">
          Your recommended path
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--join-ink)]/80">
          Your membership is active. Here’s where to go next.
        </p>
        <NextSteps />
      </div>
    );
  }

  return (
    <div className="pb-8" data-testid="plans-step">
      <p className="font-serif text-lg text-[var(--join-accent-2)]">
        Welcome, {profile.firstName}.
      </p>
      <h1 className="mt-2 font-serif text-4xl leading-[1.1] text-[var(--join-ink)] md:text-5xl">
        Recommended for you
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--join-muted)]">
        Based on what you told us, start with a membership and these courses.
        Next steps open after you purchase a membership.
      </p>

      <section className="mt-10 overflow-hidden rounded-[1.8rem] bg-[var(--join-ink)] px-5 py-10 text-[var(--join-cream)] md:px-8 md:py-12">
        <h2 className="font-serif text-3xl">Your membership</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--join-cream)]/75">
          MetFix Membership includes a free first month, then $30/month.
          Affiliate membership is $170/month and opens after your application is
          approved.
        </p>
        {checkoutError ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {checkoutError}
          </p>
        ) : null}
        <div className="mt-8" data-testid="pro-plan-card">
          <PlanCard
            featured
            title="MetFix Membership"
            price={PRO_CARD_HEADER.replace(/ · /g, "\n")}
            items={PRO_BENEFITS}
            cta="Start my free month"
            busy={checkoutBusy}
            onCta={() => void startCheckout()}
          />
        </div>

        {showCoach || showOrg || isClinician ? (
          <div
            className="mt-4 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Additional options"
          >
            {showCoach ? (
              <div className="flex" data-testid="coach-plan-card">
                <PlanCard
                  title="Become a Foundations Coach"
                  price="Qualification · Valid 3 years"
                  note="Foundations Coach is a qualification, not a paid subscription. The credential is valid for 3 years."
                  items={[
                    "Complete MetFix Essentials",
                    "Claim the Foundations Coach certificate (valid 3 years)",
                  ]}
                  cta="Start MetFix Essentials"
                  href={essentialsHref}
                />
              </div>
            ) : null}

            {showOrg ? (
              <div className="flex" data-testid="org-plan-card">
                <PlanCard
                  title="Become a MetFix Affiliate"
                  price={ORG_CARD_HEADER.replace(/ · /g, "\n")}
                  note={`${ORG_AFFILIATE_NOTE} Covers Gym Affiliates and Doctor / Clinical Practice locations.`}
                  items={AFFILIATE_BENEFITS}
                  cta="Start my Affiliate membership"
                  onCta={onOpenAffiliate}
                />
              </div>
            ) : null}

            {isClinician ? (
              <div className="flex" data-testid="medical-society-info">
                <PlanCard
                  title="MetFix Medical Society"
                  price="Directory listing & clinical peer network"
                  note="Medical Society is not a separate paid subscription tier. Clinicians with a physical clinic use Organization Owner ($170/month); others use MetFix Pro ($30/month)."
                  items={[
                    "Clinical directory listing",
                    "Peer network and clinician resources",
                  ]}
                  cta="Browse resources"
                  href={basePath("/library")}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {courses.length > 0 ? (
        <section className="mt-12" aria-label="Recommended courses" data-testid="recommended-courses">
          <h2 className="font-serif text-3xl text-[var(--join-ink)]">
            Courses to start with
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--join-ink)]/80">
            {showOrg
              ? "MetFix Membership includes 1 free online course per month. Affiliate membership includes unlimited online courses."
              : "MetFix Membership includes 1 free online course per month. These match what you told us."}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {courses.map((item) => (
              <CourseCard key={item.course.id} course={item.course} href={item.href} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto mt-10 max-w-xs">
        <button
          type="button"
          onClick={onOpenAffiliate}
          className="w-full text-center text-sm font-semibold text-[var(--join-ink)] underline decoration-[var(--join-line)] underline-offset-4"
        >
          Affiliate application
        </button>
      </div>
    </div>
  );
}
