import type { AudienceHref } from "./audience";

export const experts = [
  {
    name: "Dr. Luke Palmisano, MD, FACEP, CCFT",
    role: "Emergency Medicine & Metabolic Health",
    initials: "LP",
    hue: 28,
    bio: "Dr. Luke Palmisano is an emergency medicine physician whose work bridges acute-care medicine with metabolic health and prevention. A graduate of USC's Keck School of Medicine, he has spent more than 15 years in emergency medicine and now focuses on using biomarkers, nutrition, exercise, sleep, and other lifestyle factors to help identify and improve metabolic health.",
  },
  {
    name: "Bob Kaplan, MS, MBA",
    role: "Research Analysis, Bioenergetics & Metabolism",
    initials: "BK",
    hue: 18,
    bio: "Bob Kaplan is an independent research analyst whose work spans chronic disease, nutrition, exercise physiology, bioenergetics, and mitochondrial metabolism. He previously served as Director of Research at Early Medical and has held research roles with the Nutrition Science Initiative and the University of Nevada, Las Vegas. Kaplan is also a coauthor, alongside Dr. Thomas Seyfried and colleagues, of the 2026 paper Hereditary cancer syndromes linked to oxidative phosphorylation insufficiency, examining the relationship between mitochondrial dysfunction, cellular energy metabolism, and hereditary cancer risk.",
  },
  {
    name: "Emily Kaplan",
    role: "CEO, MetFix",
    initials: "EK",
    hue: 32,
    bio: "CEO of MetFix and The Broken Science Initiative. She opened her first gym, built a curriculum after watching fit clients still get sick, and co-founded MetFix with Greg Glassman.",
  },
  {
    name: "Dr. Thomas N. Seyfried, PhD",
    role: "Cancer Metabolism & Mitochondrial Biology",
    initials: "TS",
    hue: 22,
    bio: "Dr. Thomas Seyfried is a Professor of Biology at Boston College whose research examines the role of metabolism and mitochondrial function in chronic disease. His laboratory has studied metabolic approaches including ketogenic diets, fasting, and caloric restriction in cancer, epilepsy, and neurodegenerative disease, and he is the author of Cancer as a Metabolic Disease. His work brings deep expertise in cellular metabolism, bioenergetics, and metabolic therapy to the MetFix advisory board.",
  },
  {
    name: "Dr. Mary Dan Eades, MD",
    role: "Nutritional & Metabolic Medicine",
    initials: "MDE",
    hue: 25,
    bio: "Dr. Mary Dan Eades is a physician, author, and longtime practitioner of nutritional and metabolic medicine. She has treated thousands of patients with obesity, diabetes, hypertension, and lipid disorders and is the coauthor of 14 books on health and nutrition, including the bestselling Protein Power. Her work has focused extensively on low-carbohydrate nutrition, insulin resistance, and metabolic health.",
  },
  {
    name: "Peter Shaw, BScH, CF-L4",
    role: "Metabolic Health Education, Coaching & Human Performance",
    initials: "PS",
    hue: 12,
    bio: "Peter Shaw is a biologist, educator, coach, and two-time CrossFit Games athlete who competed in 2020 and 2022. He holds an Honours Bachelor of Science in Biology from Queen's University, with a background in plant molecular biology, and has spent more than a decade coaching athletes and everyday clients. A longtime CrossFit Seminar Staff member and Certified CrossFit Coach (CF-L4), Pete now leads education through the MetFix Academy and co-founded Petra Health MetFix, where movement, nutrition, and metabolic health are applied to help people improve health and physical capacity.",
  },
  {
    name: "Dr. Jennifer Crichton, MD",
    role: "Family Medicine, Obesity Medicine & Metabolic Health",
    initials: "JC",
    hue: 36,
    bio: "Dr. Jennifer Crichton is a family physician and Diplomate of the American Board of Obesity Medicine whose work focuses on the intersection of clinical medicine, nutrition, movement, and metabolic health. She completed her medical degree at Queen's University and her Family Medicine training at the University of Ottawa, following earlier degrees in science, research, and business. As a co-founder of Petra Health MetFix, she brings a practical clinical perspective to helping people address obesity, metabolic dysfunction, and lifestyle-associated chronic disease.",
  },
  {
    name: "T.J. Cooper",
    role: "Law Enforcement, Tactical Training & Functional Fitness",
    initials: "TC",
    hue: 8,
    bio: "T.J. Cooper brings more than three decades of law-enforcement and tactical-training experience to the MetFix advisory community. He spent 34 years in continuous public-safety service, including 17 years on a SWAT unit, and has trained law-enforcement, military, and civilian audiences in high-liability tactical topics. Cooper also founded CrossFit East, the second CrossFit affiliate, and was among the earliest practitioners to bring functional fitness into law-enforcement training. His experience provides a valuable perspective on physical preparedness, resilience, and maintaining health and capability in demanding public-safety careers.",
  },
] as const;

export type Expert = {
  name: string;
  role: string;
  initials: string;
  hue: number;
  bio: string;
};

const expertOrder: Partial<Record<AudienceHref, readonly string[]>> = {
  "#for-individuals": ["Dr. Luke Palmisano, MD, FACEP, CCFT", "Dr. Thomas N. Seyfried, PhD"],
  "#for-athletes": ["Peter Shaw, BScH, CF-L4", "Dr. Luke Palmisano, MD, FACEP, CCFT"],
  "#for-coaches": ["Peter Shaw, BScH, CF-L4", "Dr. Luke Palmisano, MD, FACEP, CCFT"],
  "#for-first-responders": [
    "T.J. Cooper",
    "Dr. Luke Palmisano, MD, FACEP, CCFT",
    "Peter Shaw, BScH, CF-L4",
    "Dr. Mary Dan Eades, MD",
  ],
  "#for-clinicians": [
    "Dr. Luke Palmisano, MD, FACEP, CCFT",
    "Dr. Jennifer Crichton, MD",
    "Dr. Thomas N. Seyfried, PhD",
    "Bob Kaplan, MS, MBA",
  ],
}


function orderExperts(first: readonly string[]): readonly Expert[] {
  const lead = new Set<string>(first);
  const byName = new Map<string, Expert>(experts.map((expert) => [expert.name, expert]));
  return [
    ...first.flatMap((name) => {
      const expert = byName.get(name);
      return expert ? [expert] : [];
    }),
    ...experts.filter((expert) => !lead.has(expert.name)),
  ];
}

export function expertsFor(audience: AudienceHref): readonly Expert[] {
  const first = expertOrder[audience];
  return first ? orderExperts(first) : experts;
}
