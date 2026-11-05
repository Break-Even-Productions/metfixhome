import { needsConditionalStep, type RoleId } from "@shared/join";
import type { Course } from "@/lib/contentTypes";
import type { JoinProfile, RecommendArticle } from "./types";

export const emptyProfile: JoinProfile = {
  firstName: "",
  lastName: "",
  email: "",
  authProvider: null,
  roles: [],
  hasPhysicalGym: null,
  hasPhysicalClinic: null,
  completed: false,
};

export const catalogArticles: RecommendArticle[] = [
  {
    id: "what-it-means",
    title: "What metabolic health actually means",
    category: "Foundations",
    description: "A plain-language map of the systems that shape energy, weight, and recovery.",
    minutes: "6 min",
    roles: ["individual"],
    body: [
      "Metabolic health is less about a single number and more about how well your body produces, stores, and uses energy.",
      "In this overview we look at insulin sensitivity, inflammation, sleep, and movement as a connected system.",
    ],
  },
  {
    id: "blood-sugar",
    title: "Understanding blood sugar without the jargon",
    category: "Science",
    description: "How glucose, insulin, and daily habits interact — without the lecture.",
    minutes: "7 min",
    roles: ["individual"],
    body: [
      "Blood sugar is a signal, not a verdict. This piece explains what spikes, dips, and averages actually tell you.",
    ],
  },
  {
    id: "five-markers",
    title: "Five markers of metabolic health worth understanding",
    category: "Markers",
    description: "The handful of markers that help you see the bigger picture.",
    minutes: "8 min",
    roles: ["individual"],
    body: [
      "Waist, triglycerides, HDL, blood pressure, and fasting glucose are a useful starting set.",
    ],
  },
  {
    id: "talking-clients",
    title: "Talking to clients about metabolic health",
    category: "Coaching",
    description: "Language that builds trust without overstepping scope.",
    minutes: "8 min",
    roles: ["coach"],
    body: [
      "Clients do not need a biochemistry lecture. They need a clear story about energy, hunger, sleep, and consistency.",
    ],
  },
  {
    id: "beyond-calories",
    title: "Moving beyond calories: a coaching framework",
    category: "Coaching",
    description: "A practical structure for protein, movement, sleep, and stress.",
    minutes: "9 min",
    roles: ["coach"],
    body: ["Calories still matter, but they are rarely the whole conversation."],
  },
  {
    id: "when-to-refer",
    title: "When a client should be referred to a clinician",
    category: "Scope",
    description: "Clear flags for staying in your lane — and getting clients the right help.",
    minutes: "5 min",
    roles: ["coach"],
    body: ["Knowing when to refer is part of being a trusted coach."],
  },
  {
    id: "gym-culture",
    title: "Building a metabolic-health-focused gym culture",
    category: "Operations",
    description: "How programming, staff language, and environment reinforce the same story.",
    minutes: "8 min",
    roles: ["gym_owner"],
    body: ["Affiliate gyms do more than hang a logo."],
  },
  {
    id: "affiliate-how",
    title: "How the MetFix Affiliate program works",
    category: "Affiliate",
    description: "Requirements, listing, leads, and what physical location actually means.",
    minutes: "6 min",
    roles: ["gym_owner"],
    body: [
      "Affiliate status is for physical locations that complete MetFix Essentials and meet eligibility requirements.",
    ],
  },
  {
    id: "coaches-in-gym",
    title: "Helping coaches use MetFix with their clients",
    category: "Staff",
    description: "A simple rollout so your team uses the same playbook.",
    minutes: "7 min",
    roles: ["gym_owner"],
    body: ["The fastest way to stall an Affiliate gym is mixed messaging."],
  },
  {
    id: "shift-work",
    title: "Shift work and metabolic health",
    category: "First Responders",
    description: "What rotating schedules do to insulin, sleep, and appetite.",
    minutes: "7 min",
    roles: ["first_responder"],
    body: ["Shift work is a metabolic stressor."],
  },
  {
    id: "sleep-shifts",
    title: "Sleep strategies for unpredictable schedules",
    category: "Recovery",
    description: "Tactics that work when a perfect 10 p.m. bedtime is not an option.",
    minutes: "6 min",
    roles: ["first_responder"],
    body: ["You cannot always control the clock."],
  },
  {
    id: "nutrition-shifts",
    title: "Nutrition when your schedule works against you",
    category: "Nutrition",
    description: "Meal structure for long shifts, late calls, and station food.",
    minutes: "6 min",
    roles: ["first_responder"],
    body: ["The goal is not a perfect meal plan."],
  },
  {
    id: "clinician-talk",
    title: "A practical framework for discussing metabolic health",
    category: "Clinical",
    description: "How to open the conversation without losing the visit.",
    minutes: "8 min",
    roles: ["clinician"],
    body: ["Patients hear metabolism as a verdict."],
  },
  {
    id: "markers-clinician",
    title: "Metabolic markers clinicians should know",
    category: "Clinical",
    description: "A concise view of markers that show up across MetFix education.",
    minutes: "9 min",
    roles: ["clinician"],
    body: ["This is not a diagnostic protocol. It is a shared vocabulary."],
  },
  {
    id: "lifestyle-alongside",
    title: "Using lifestyle interventions alongside clinical care",
    category: "Practice",
    description: "Where education, coaching, and medical care can reinforce one another.",
    minutes: "8 min",
    roles: ["clinician"],
    body: ["Lifestyle is not a replacement for care."],
  },
];

const rolePriority: RoleId[] = [
  "coach",
  "gym_owner",
  "clinician",
  "first_responder",
  "individual",
];

function pickByRole<T extends { id: string; roles: RoleId[] }>(
  items: T[],
  selected: RoleId[],
  limit: number,
) {
  const seen = new Set<string>();
  const out: T[] = [];
  const active = rolePriority.filter((role) => selected.includes(role));
  const queues = active.map((role) => items.filter((item) => item.roles.includes(role)));
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const queue of queues) {
      const item = queue.find((entry) => !seen.has(entry.id));
      if (!item) continue;
      seen.add(item.id);
      out.push(item);
      progressed = true;
      if (out.length >= limit) return out;
    }
  }
  return out;
}

const START_COURSE_KEYS = [
  "free-class",
  "fit-for-duty",
  "prepared-patient",
  "medical-nutrition",
  "essentials-advanced",
] as const;

type StartCourseKey = (typeof START_COURSE_KEYS)[number];

/** Real catalog ids, in the order we suggest them for each onboarding role. */
const START_BY_ROLE: Record<RoleId, readonly StartCourseKey[]> = {
  individual: ["free-class", "prepared-patient"],
  coach: ["free-class", "essentials-advanced"],
  gym_owner: ["essentials-advanced", "free-class"],
  first_responder: ["fit-for-duty", "free-class"],
  clinician: ["medical-nutrition", "free-class"],
};

function matchesStartCourse(course: Course, key: StartCourseKey): boolean {
  if (course.id === key) return true;
  const title = course.title.toLowerCase();
  switch (key) {
    case "free-class":
      return title.includes("what is metfix");
    case "fit-for-duty":
      return title.includes("fit for duty");
    case "prepared-patient":
      return title.includes("prepared patient");
    case "medical-nutrition":
      return title.includes("medical nutrition");
    case "essentials-advanced":
      return title.includes("essentials");
    default: {
      const unreachable: never = key;
      return unreachable;
    }
  }
}

/** http(s) landing page only. Courses without one are not offered as links. */
export function courseLandingHref(course: Course): string | null {
  const raw = course.landingPageUrl?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export type RecommendedStartCourse = {
  course: Course;
  href: string;
};

/** Role-matched courses from the live catalog that have a real landing page. */
export function recommendedStartCourses(
  catalog: readonly Course[],
  selected: readonly RoleId[],
): RecommendedStartCourse[] {
  const limit = selected.length > 1 ? 4 : 2;
  const active = rolePriority.filter((role) => selected.includes(role));
  const queues = active.map((role) => {
    const picks: RecommendedStartCourse[] = [];
    for (const key of START_BY_ROLE[role]) {
      const course = catalog.find((item) => matchesStartCourse(item, key));
      if (!course) continue;
      const href = courseLandingHref(course);
      if (!href) continue;
      picks.push({ course, href });
    }
    return picks;
  });
  const seen = new Set<string>();
  const out: RecommendedStartCourse[] = [];
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const queue of queues) {
      const item = queue.find((entry) => !seen.has(entry.course.id));
      if (!item) continue;
      seen.add(item.course.id);
      out.push(item);
      progressed = true;
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function recommendedArticles(selected: RoleId[]) {
  return pickByRole(catalogArticles, selected, 3);
}

/** Whop (or our own return URL) signals that membership checkout succeeded. */
export function isJoinCheckoutSuccess(params: URLSearchParams): boolean {
  if (params.get("purchased") === "1") return true;
  const status = (params.get("status") ?? params.get("payment") ?? "").toLowerCase();
  return status === "succeeded" || status === "success" || status === "paid";
}

export { needsConditionalStep as needsConditional };
