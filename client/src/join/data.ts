import { needsConditionalStep, type RoleId } from "@shared/join";
import type { JoinProfile, RecommendArticle, RecommendCourse } from "./types";

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

const img = {
  foundations:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=70",
  everyday:
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=70",
  essentials:
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=70",
  gym: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=70",
  responder:
    "https://images.unsplash.com/photo-1475776408506-9a5371e7a068?auto=format&fit=crop&w=900&q=70",
  sleep:
    "https://images.unsplash.com/photo-1515895309288-54173f3c3256?auto=format&fit=crop&w=900&q=70",
  clinician:
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=70",
  practice:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=70",
};

export const catalogCourses: RecommendCourse[] = [
  {
    id: "foundations",
    title: "Metabolic Health Foundations",
    category: "Core",
    description:
      "Understand the fundamentals of metabolism, insulin, nutrition, movement, and lifestyle.",
    hours: "24 hrs",
    image: img.foundations,
    tone: "linear-gradient(160deg, #5c4638 0%, #1f1a16 100%)",
    roles: ["individual", "coach"],
  },
  {
    id: "everyday",
    title: "Everyday Metabolic Health",
    category: "Lifestyle",
    description: "Practical ways to apply metabolic health principles in everyday life.",
    hours: "8 hrs",
    image: img.everyday,
    tone: "linear-gradient(160deg, #4a3b2c 0%, #151310 100%)",
    roles: ["individual"],
  },
  {
    id: "essentials",
    title: "MetFix Essentials",
    category: "Professional",
    description:
      "The foundational professional course required to earn the Foundations Coach credential.",
    hours: "18 hrs",
    image: img.essentials,
    tone: "linear-gradient(160deg, #3d4a3a 0%, #161814 100%)",
    badge: "Path to Foundations Coach",
    roles: ["coach", "gym_owner"],
  },
  {
    id: "gym-building",
    title: "Building Metabolic Health Into Your Gym",
    category: "Affiliate",
    description:
      "Practical strategies for integrating MetFix principles into your facility and client experience.",
    hours: "10 hrs",
    image: img.gym,
    tone: "linear-gradient(160deg, #4a3a2c 0%, #1a1612 100%)",
    badge: "For Affiliate locations",
    roles: ["gym_owner"],
  },
  {
    id: "fr-metabolic",
    title: "Metabolic Health for First Responders",
    category: "First Responders",
    description:
      "Metabolic health fundamentals designed around shift work and the demands of first responder careers.",
    hours: "12 hrs",
    image: img.responder,
    tone: "linear-gradient(160deg, #3d4a3a 0%, #161814 100%)",
    roles: ["first_responder"],
  },
  {
    id: "sleep",
    title: "Sleep, Stress & Recovery",
    category: "Recovery",
    description: "Strategies for improving recovery when schedules and stress are difficult to control.",
    hours: "6 hrs",
    image: img.sleep,
    tone: "linear-gradient(160deg, #2c3340 0%, #12141a 100%)",
    roles: ["first_responder"],
  },
  {
    id: "clinician-foundations",
    title: "Metabolic Health Foundations for Clinicians",
    category: "Clinical",
    description: "An evidence-focused introduction to core MetFix concepts for healthcare professionals.",
    hours: "16 hrs",
    image: img.clinician,
    tone: "linear-gradient(160deg, #6b5a48 0%, #2a241e 100%)",
    roles: ["clinician"],
  },
  {
    id: "clinical-practice",
    title: "Applying Metabolic Health in Clinical Practice",
    category: "Clinical",
    description: "Practical tools and frameworks for patient care.",
    hours: "12 hrs",
    image: img.practice,
    tone: "linear-gradient(160deg, #5a4630 0%, #1a1612 100%)",
    roles: ["clinician"],
  },
];

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

export function recommendedCourses(selected: RoleId[]) {
  const limit = selected.length > 1 ? 4 : 2;
  return pickByRole(catalogCourses, selected, limit);
}

export function recommendedArticles(selected: RoleId[]) {
  return pickByRole(catalogArticles, selected, 3);
}

export { needsConditionalStep as needsConditional };
