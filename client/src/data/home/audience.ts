export const audienceLinks = [
  { label: "For Individuals", href: "#for-individuals" },
  { label: "For Athletes", href: "#for-athletes" },
  { label: "For Coaches", href: "#for-coaches" },
  { label: "For Gym Owners", href: "#for-gym-owners" },
  { label: "For First Responders", href: "#for-first-responders" },
  { label: "For Clinicians", href: "#for-clinicians" },
  { label: "For Organizations", href: "#for-organizations" },
] as const;

export type AudienceHref = (typeof audienceLinks)[number]["href"];

export const audienceTheme: Record<AudienceHref, string> = {
  "#for-individuals": "individual",
  "#for-athletes": "athlete",
  "#for-coaches": "coach",
  "#for-gym-owners": "gym",
  "#for-first-responders": "responder",
  "#for-clinicians": "clinician",
  "#for-organizations": "organization",
};

export type LandingCopy = {
  heroLines: readonly string[];
  heroSubtitle: string;
  testimonialsTitle: string;
  resourcesTitle: string;
};

const defaultLandingCopy: LandingCopy = {
  heroLines: ["Metabolic Health", "Classes for Real Life"],
  heroSubtitle:
    "Evidence-informed education for women's health, first responders, physicians, and coaches.",
  testimonialsTitle: "Why Learners Choose MetFix",
  resourcesTitle: "Let's Start with the Truth",
};

const audienceLandingCopy: Partial<Record<AudienceHref, LandingCopy>> = {
  "#for-athletes": {
    heroLines: ["Fuel for Optimal", "Performance"],
    heroSubtitle:
      "Evidence-informed education for athletes who want sharper fueling, stronger recovery, and metabolic resilience that holds up under training and competition.",
    testimonialsTitle: "Why Athletes Choose MetFix",
    resourcesTitle: "Let's Start with the Truth",
  },
  "#for-coaches": {
    heroLines: ["Become a Certified", "MetFix Coach"],
    heroSubtitle:
      "We train coaches and health leaders to prevent and reverse chronic disease using metabolic science that works in the real world.",
    testimonialsTitle: "Why Coaches Choose MetFix",
    resourcesTitle: "Resources for Coaches",
  },
  "#for-first-responders": {
    heroLines: ["Ready for the Call.", "Built for the Long Career."],
    heroSubtitle:
      "Practical metabolic education for firefighters, police officers, EMTs, and other first responders navigating shift work, sleep debt, stress, and the physical demands of the job.",
    testimonialsTitle: "Why First Responders Choose MetFix",
    resourcesTitle: "Let's Start with the Truth",
  },
  "#for-clinicians": {
    heroLines: ["A deeper understanding", "of metabolic medicine"],
    heroSubtitle:
      "Education, evidence, and collaboration for clinicians and coaches who want a more useful path from research to patient outcomes.",
    testimonialsTitle: "Why Clinicians Choose MetFix",
    resourcesTitle: "Let's Start with the Truth",
  },
  "#for-gym-owners": {
    heroLines: ["Metabolic Health", "Classes for Real Life"],
    heroSubtitle:
      "Evidence-informed education for women's health, first responders, physicians, and coaches.",
    testimonialsTitle: "Why Gym Owners Choose MetFix",
    resourcesTitle: "Let's Start with the Truth",
  },
  "#for-organizations": {
    heroLines: ["Metabolic Health", "Classes for Real Life"],
    heroSubtitle:
      "Evidence-informed education for women's health, first responders, physicians, and coaches.",
    testimonialsTitle: "Why Organizations Choose MetFix",
    resourcesTitle: "Let's Start with the Truth",
  },
};

export function landingCopyFor(audience: AudienceHref): LandingCopy {
  return audienceLandingCopy[audience] ?? defaultLandingCopy;
}

export function audienceFromHash(hash: string): AudienceHref | null {
  return audienceLinks.find((link) => link.href === hash)?.href ?? null;
}

export const DEFAULT_AUDIENCE: AudienceHref = "#for-individuals";

export const COURSE_FILTERS = [
  "All Classes",
  "Women's Health",
  "First Responder",
  "Physician",
  "Coaches",
  "Metabolism",
  "Nutrition",
  "Behavior Change",
] as const;

export type CourseFilter = (typeof COURSE_FILTERS)[number];

/** Legacy home hash → current section id (acceptance §3b). */
export const LEGACY_HOME_ANCHORS: Record<string, string> = {
  classes: "classes",
  courses: "classes",
  foundations: "foundations",
  library: "resources",
  newsletter: "newsletter",
  testimonials: "stories",
  membership: "membership-section",
  "membership-section": "membership-section",
  impact: "impact",
  affiliation: "affiliation",
  about: "about",
  network: "network",
  stories: "stories",
  faq: "faq",
  experts: "experts",
};
