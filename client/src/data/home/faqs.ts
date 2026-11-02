import type { AudienceHref } from "./audience";

export const faqs = [
  {
    q: "What is MetFix?",
    a: "MetFix is a membership platform for evidence-informed metabolic health education. Classes are built for clinicians, first responders, coaches, and anyone translating research into real-world practice.",
  },
  {
    q: "Who are the classes for?",
    a: "Women's health practitioners, physicians, first responders, health coaches, and allied professionals who want practical metabolic protocols they can use with patients, teams, and clients.",
  },
  {
    q: "Do I get CE credits?",
    a: "Select courses offer CME / CE credit. Eligible classes are labeled in the catalog, and certificates are issued automatically when you complete the required modules.",
  },
  {
    q: "How much does membership cost?",
    a: "Membership unlocks the full class library, community, and clinical tools. Pricing is shown at checkout after you create an account — you can cancel anytime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel from your account settings at any time. You keep access through the end of the billing period.",
  },
] as const;

export const coachFaqs = [
  {
    q: "Is MetFix a certificate?",
    a: "MetFix is an education platform, not a certification body. Our curriculum gives you the metabolic health knowledge and practical tools to transform your coaching practice. The Foundations Seminar and affiliate pathway represent the highest level of MetFix education, recognized by the MetFix community worldwide.",
  },
  {
    q: "How long does it take to complete the curriculum?",
    a: "The free What Is MetFix? class takes about an hour to complete. Specialty tracks range from 6 to 40 hours depending on the course. Foundations is a two-day in-person weekend seminar. You can move at your own pace with no deadlines.",
  },
  {
    q: "What is the difference between Essentials and Foundations?",
    a: "MetFix Essentials is the online curriculum and is required to apply for affiliation. It covers every mechanism, protocol, and coaching conversation you need to deliver metabolic health programming at a professional level. Foundations is the in-person, hands-on seminar and is strongly recommended for coaches and owners, but it can be completed after you become an affiliate. Most coaches complete Essentials first, then attend a Foundations Seminar to apply the knowledge alongside other coaches.",
  },
  {
    q: "Do I need a medical background to take these courses?",
    a: "No medical background required. MetFix is designed for coaches, trainers, gym owners and doctors and healthcare workers who want to deliver clinical-level metabolic health knowledge in a coaching setting. Physicians and medical professionals are absolutely welcome and regularly attend Foundations. We have several medical professionals who run MetFix programs through their medical practices. For our medical professionals we also offer a dedicated Medical Nutrition Training track built for them.",
  },
  {
    q: "What is a MetFix Affiliate?",
    a: "A MetFix Affiliate is a gym, box, or training facility that has been accepted into the MetFix affiliate program and committed to implementing MetFix programming in their community. Affiliates are part of a global network of coaches fighting chronic disease, with access to exclusive programming, community support, and ongoing education.",
  },
  {
    q: "What is the Broken Science Initiative?",
    a: "The Broken Science Initiative (BSI) is the research and intellectual foundation behind MetFix. BSI identifies where the science on chronic disease has gone wrong, and builds the evidence base for what actually works. BSI points to the problems. MetFix is how those solutions get applied in the real world, in your gym, with your community.",
  },
] as const;

export const athleteFaqs = [
  {
    q: "What is MetFix for athletes?",
    a: "MetFix gives athletes evidence-informed metabolic education they can apply to fueling, training, and recovery — so performance gains come from clearer physiology, not guesswork.",
  },
  {
    q: "Who are these classes for?",
    a: "Competitive and recreational athletes, strength and endurance athletes, and serious trainees who want practical protocols for fueling, recovery, and staying metabolically healthy across a training season.",
  },
  {
    q: "Will this help with fueling and recovery?",
    a: "Yes. Classes cover how to fuel training and competition, support recovery between sessions, and build metabolic resilience that holds up when volume and intensity increase.",
  },
  {
    q: "Do I need a coach or sports nutritionist to join?",
    a: "No. The material is designed for athletes to learn and apply on their own. Coaches and performance staff are welcome too if they want the same metabolic foundation for the athletes they work with.",
  },
  {
    q: "How much does membership cost?",
    a: "Membership unlocks the full class library, community, and tools. Pricing is shown at checkout after you create an account — you can cancel anytime.",
  },
] as const;

export const firstResponderFaqs = [
  {
    q: "What is MetFix for first responders?",
    a: "MetFix is practical metabolic health education built for the realities of fire, EMS, and law enforcement — shift work, disrupted sleep, high stress, and the need to stay physically ready between calls.",
  },
  {
    q: "Who are these classes for?",
    a: "Firefighters, police officers, EMTs, paramedics, and other first responders who want clear protocols for energy, recovery, and long-term health on the job — not generic wellness tips.",
  },
  {
    q: "How does this help with shift work and sleep?",
    a: "Classes address how shift schedules, sleep debt, and stress affect metabolism, and what you can do between shifts and after tough calls to recover and stay ready for the next one.",
  },
  {
    q: "Is this relevant if I am already training for fitness tests?",
    a: "Yes. Physical readiness matters, but so does the metabolic foundation underneath it. MetFix helps you train, fuel, and recover in ways that support duty fitness without burning out your system over a career.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel from your account settings at any time. You keep access through the end of the billing period.",
  },
] as const;

export type Faq = { q: string; a: string };

export function faqsFor(audience: AudienceHref): readonly Faq[] {
  if (audience === "#for-coaches") return coachFaqs;
  if (audience === "#for-athletes") return athleteFaqs;
  if (audience === "#for-first-responders") return firstResponderFaqs;
  return faqs;
}
