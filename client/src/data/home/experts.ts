import type { AudienceHref } from "./audience";

export type Expert = {
  id: string;
  name: string;
  role: string;
  initials: string;
  hue: number;
  bio: string;
  photoUrl?: string;
};

export const experts: readonly Expert[] = [
  {
    id: "luke-palmisano",
    name: "Dr. Luke Palmisano, MD, FACEP, CCFT",
    role: "Emergency Medicine & Metabolic Health",
    initials: "LP",
    hue: 28,
    bio: "Dr. Luke Palmisano is an emergency medicine physician whose work bridges acute-care medicine with metabolic health and prevention. A graduate of USC's Keck School of Medicine, he has spent more than 15 years in emergency medicine and now focuses on using biomarkers, nutrition, exercise, sleep, and other lifestyle factors to help identify and improve metabolic health.",
  },
  {
    id: "bob-kaplan",
    name: "Bob Kaplan, MS, MBA",
    role: "Research Analysis, Bioenergetics & Metabolism",
    initials: "BK",
    hue: 18,
    bio: "Bob Kaplan is an independent research analyst whose work spans chronic disease, nutrition, exercise physiology, bioenergetics, and mitochondrial metabolism. He previously served as Director of Research at Early Medical and has held research roles with the Nutrition Science Initiative and the University of Nevada, Las Vegas. Kaplan is also a coauthor, alongside Dr. Thomas Seyfried and colleagues, of the 2026 paper Hereditary cancer syndromes linked to oxidative phosphorylation insufficiency, examining the relationship between mitochondrial dysfunction, cellular energy metabolism, and hereditary cancer risk.",
  },
  {
    id: "emily-kaplan",
    name: "Emily Kaplan",
    role: "CEO, MetFix",
    initials: "EK",
    hue: 32,
    bio: "CEO of MetFix and The Broken Science Initiative. She opened her first gym, built a curriculum after watching fit clients still get sick, and co-founded MetFix with Greg Glassman.",
  },
  {
    id: "thomas-seyfried",
    name: "Dr. Thomas N. Seyfried, PhD",
    role: "Cancer Metabolism & Mitochondrial Biology",
    initials: "TS",
    hue: 22,
    bio: "Dr. Thomas Seyfried is a Professor of Biology at Boston College whose research examines the role of metabolism and mitochondrial function in chronic disease. His laboratory has studied metabolic approaches including ketogenic diets, fasting, and caloric restriction in cancer, epilepsy, and neurodegenerative disease, and he is the author of Cancer as a Metabolic Disease. His work brings deep expertise in cellular metabolism, bioenergetics, and metabolic therapy to the MetFix advisory board.",
  },
  {
    id: "mary-dan-eades",
    name: "Dr. Mary Dan Eades, MD",
    role: "Nutritional & Metabolic Medicine",
    initials: "MDE",
    hue: 25,
    bio: "Dr. Mary Dan Eades is a physician, author, and longtime practitioner of nutritional and metabolic medicine. She has treated thousands of patients with obesity, diabetes, hypertension, and lipid disorders and is the coauthor of 14 books on health and nutrition, including the bestselling Protein Power. Her work has focused extensively on low-carbohydrate nutrition, insulin resistance, and metabolic health.",
  },
  {
    id: "tj-cooper",
    name: "T.J. Cooper",
    role: "Law Enforcement, Tactical Training & Functional Fitness",
    initials: "TC",
    hue: 8,
    bio: "T.J. Cooper brings more than three decades of law-enforcement and tactical-training experience to the MetFix advisory community. He spent 34 years in continuous public-safety service, including 17 years on a SWAT unit, and has trained law-enforcement, military, and civilian audiences in high-liability tactical topics. Cooper also founded CrossFit East, the second CrossFit affiliate, and was among the earliest practitioners to bring functional fitness into law-enforcement training. His experience provides a valuable perspective on physical preparedness, resilience, and maintaining health and capability in demanding public-safety careers.",
  },
  {
    id: "chris-russell",
    name: "Chris Russell",
    role: "Law Enforcement & MetFix JAX Owner",
    initials: "CR",
    hue: 14,
    bio: "Chris Russell is a law-enforcement professional and owner of MetFix JAX. He brings frontline public-safety experience together with hands-on affiliate leadership, helping coaches and first responders apply metabolic health training in demanding operational and community settings.",
  },
  {
    id: "katina-thornton",
    name: "Katina Thornton, MD",
    role: "Physician & Metabolic Health",
    initials: "KT",
    hue: 34,
    bio: "Katina Thornton, MD, is a physician whose work connects clinical medicine with metabolic health education. She brings a medical perspective to the MetFix community, helping practitioners and patients understand how nutrition, movement, and lifestyle interventions support long-term metabolic health.",
  },
  {
    id: "patrick-larreategui",
    name: "Dr. Patrick Larreategui, DO",
    role: "Physician & Metabolic Health",
    initials: "PL",
    hue: 20,
    bio: "Dr. Patrick Larreategui, DO, is a physician contributing clinical insight to MetFix’s metabolic health education. His osteopathic background informs a whole-person approach to helping coaches and clinicians address metabolic dysfunction through practical, evidence-informed lifestyle care.",
  },
] as const;

const expertOrder: Partial<Record<AudienceHref, readonly string[]>> = {
  "#for-individuals": ["Dr. Luke Palmisano, MD, FACEP, CCFT", "Dr. Thomas N. Seyfried, PhD"],
  "#for-athletes": ["Dr. Luke Palmisano, MD, FACEP, CCFT", "Chris Russell"],
  "#for-coaches": ["Emily Kaplan", "Dr. Luke Palmisano, MD, FACEP, CCFT"],
  "#for-first-responders": [
    "T.J. Cooper",
    "Chris Russell",
    "Dr. Luke Palmisano, MD, FACEP, CCFT",
    "Dr. Mary Dan Eades, MD",
  ],
  "#for-clinicians": [
    "Dr. Luke Palmisano, MD, FACEP, CCFT",
    "Katina Thornton, MD",
    "Dr. Patrick Larreategui, DO",
    "Dr. Thomas N. Seyfried, PhD",
    "Bob Kaplan, MS, MBA",
  ],
};

function orderExperts(
  list: readonly Expert[],
  first: readonly string[],
): readonly Expert[] {
  const lead = new Set<string>(first);
  const byName = new Map<string, Expert>(list.map((expert) => [expert.name, expert]));
  return [
    ...first.flatMap((name) => {
      const expert = byName.get(name);
      return expert ? [expert] : [];
    }),
    ...list.filter((expert) => !lead.has(expert.name)),
  ];
}

export function expertsFor(
  audience: AudienceHref,
  list: readonly Expert[] = experts,
): readonly Expert[] {
  const first = expertOrder[audience];
  return first ? orderExperts(list, first) : list;
}
