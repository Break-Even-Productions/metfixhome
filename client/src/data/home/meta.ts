import type { AudienceHref } from "./audience";

/** Acceptance §3d audience meta pairs (LR-15). Canonical always https://metfix.org/. */
export type AudienceMeta = { title: string; description: string };

export const AUDIENCE_META: Record<AudienceHref, AudienceMeta> = {
  "#for-individuals": {
    title: "MetFix — Metabolic Health Classes for Real Life",
    description:
      "Evidence-informed metabolic health education for women's health, first responders, physicians, and coaches.",
  },
  "#for-athletes": {
    title: "MetFix for Athletes — Fuel for Optimal Performance",
    description:
      "Evidence-informed education for athletes: sharper fueling, stronger recovery, and metabolic resilience for training and competition.",
  },
  "#for-coaches": {
    title: "MetFix for Coaches — Become a Certified MetFix Coach",
    description:
      "We train coaches and health leaders to prevent and reverse chronic disease using metabolic science that works in the real world.",
  },
  "#for-first-responders": {
    title: "MetFix for First Responders — Built for the Long Career",
    description:
      "Practical metabolic education for firefighters, police, and EMTs facing shift work, sleep debt, stress, and the physical demands of the job.",
  },
  "#for-clinicians": {
    title: "MetFix for Clinicians — Metabolic Medicine, Deeper",
    description:
      "Education, evidence, and collaboration for clinicians who want a more useful path from metabolic research to patient outcomes.",
  },
  "#for-gym-owners": {
    title: "MetFix for Gym Owners — Metabolic Health Classes",
    description:
      "Bring evidence-informed metabolic health classes to your gym, for members in women's health, first responders, physicians, and coaches.",
  },
  "#for-organizations": {
    title: "MetFix for Organizations — Metabolic Health Classes",
    description:
      "Evidence-informed metabolic health classes for organizations: women's health, first responders, physicians, and coaches.",
  },
};

export const HOME_CANONICAL = "https://metfix.org/";

export function metaForAudience(audience: AudienceHref): AudienceMeta {
  return AUDIENCE_META[audience];
}
