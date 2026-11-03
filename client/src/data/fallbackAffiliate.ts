import type { CtaLink, HighlightedHeadline } from "@/lib/homeTypes";

export type AffiliateBenefitIcon =
  | "book"
  | "users"
  | "award"
  | "dumbbell"
  | "globe"
  | "map-pin"
  | "check"
  | "shield"
  | "star"
  | "heart";

export type AffiliateBenefitItem = {
  icon: AffiliateBenefitIcon;
  title: string;
  description: string;
};

export type AffiliateRequirement = {
  title: string;
  description: string;
};

export type AffiliateProcessStep = {
  title: string;
  description: string;
};

export type AffiliatePageContent = {
  hero: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
    stats: { value: string; label: string }[];
  };
  whatItMeans: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string[];
    price: string;
    pricePeriod: string;
    priceNote: string;
    priceDescription: string;
    includesLabel: string;
    includes: string[];
  };
  benefits: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    items: AffiliateBenefitItem[];
  };
  whoQualifies: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string[];
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
    requirements: AffiliateRequirement[];
  };
  process: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    steps: AffiliateProcessStep[];
  };
  networkQuote: {
    eyebrow: string;
    quote: string;
    attribution: string;
  };
  application: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    buttonLabel: string;
    url: string;
    stickyButtonLabel: string;
  };
};

const APPLICATION_URL = "https://metfix.fillout.com/affiliate-application";

export const FALLBACK_AFFILIATE_PAGE: AffiliatePageContent = {
  hero: {
    eyebrow: "MetFix Affiliate Program",
    headline: {
      text: "Become a MetFix Affiliate.",
      goldPhrase: "MetFix Affiliate.",
    },
    subtext:
      "Join a global network of gyms and coaches who have committed to fighting chronic disease in their communities. MetFix affiliates are the highest-trained metabolic health coaches in the world.",
    primaryCta: { label: "Apply Now", href: APPLICATION_URL },
    secondaryCta: { label: "See the Benefits", href: "#what-you-get" },
    stats: [
      { value: "Global", label: "Network" },
      { value: "Expert", label: "Education" },
      { value: "Proven", label: "Programming" },
    ],
  },
  whatItMeans: {
    eyebrow: "What It Means",
    headline: {
      text: "Not just a gym. A movement.",
      goldPhrase: "A movement.",
    },
    body: [
      "A MetFix Affiliate is a gym, box, or training facility that has been accepted into the MetFix program and committed to implementing MetFix programming in their community. It is not a badge you earn automatically. It is a standard you apply for and uphold.",
      "MetFix affiliates are the front line of a global effort to reverse chronic disease. They are the coaches their communities trust with their health, and they have the education to back it up.",
    ],
    price: "$170",
    pricePeriod: "per month",
    priceNote: "annual commitment",
    priceDescription:
      "This is your full affiliate membership fee. It covers your brand license, access to all courses and the complete Resource Library, MetFix app tools, affiliate dashboard, and gym finder listing. There are no additional licensing or access fees.",
    includesLabel: "What Affiliate Membership Includes",
    includes: [
      "Access to all MetFix online courses at no cost",
      "Complete Resource Library: live streams, journal clubs, articles, whiteboards, book reports",
      "All live streams and recordings",
      "Journal clubs, lectures, and events",
      "Research Notes on all content",
      "Comments and community access",
      "MetFix brand license: market as a MetFix location",
      "Affiliate dashboard and back-end tools",
      "Special meal planning features and client tracking on the MetFix app",
      "Revenue sharing when clients purchase courses through your gym",
      "Affiliate listing on the MetFix gym finder map",
      "Priority registration for Foundations Seminars",
    ],
  },
  benefits: {
    eyebrow: "Affiliate Benefits",
    headline: {
      text: "What you get when you join the network.",
      goldPhrase: "join the network.",
    },
    subtext:
      "Affiliate status is ongoing access to the tools, community, and education that make MetFix gyms the most effective metabolic health facilities in the world.",
    items: [
      {
        icon: "book",
        title: "Exclusive Programming Library",
        description:
          "Full access to MetFix programming, including a direct link on your website with The Daily Fix: Brain, Body and Belly. Workouts, nutrition protocols, and metabolic health curricula designed for affiliate gyms and medical facilities.",
      },
      {
        icon: "users",
        title: "Global Affiliate Community",
        description:
          "A private network of MetFix affiliate owners, coaches and medical professionals. Share cases, ask questions, and collaborate with the best metabolic health experts in the world.",
      },
      {
        icon: "award",
        title: "Affiliate Listing & Referrals",
        description:
          "Your gym or health center listed on the MetFix affiliate map, the first place people look when searching for a MetFix gym in their area. Organic referrals from the MetFix platform, media and medical referrals.",
      },
      {
        icon: "dumbbell",
        title: "Ongoing Education Access",
        description:
          "Affiliates receive continued access to MetFix classes and specialty tracks. Keeping you up-to-date on the latest research and tools.",
      },
      {
        icon: "globe",
        title: "Foundations Seminar Priority",
        description:
          "Affiliates receive priority registration for MetFix's 2-day, in-person Foundations Seminars and a $500 discount to extend to your coaches. You also have the opportunity to host a seminar at your facility.",
      },
      {
        icon: "map-pin",
        title: "MetFix Branding Rights",
        description:
          "Licensed use of MetFix affiliate branding for your gym, website, and marketing materials. Signal to your community that you operate at the highest standard.",
      },
    ],
  },
  whoQualifies: {
    eyebrow: "Who Qualifies",
    headline: {
      text: "The standard is intentionally high.",
      goldPhrase: "intentionally high.",
    },
    body: [
      "MetFix affiliates represent the MetFix brand in their communities. We take that seriously. The requirements exist to protect the people who walk through your doors and the integrity of the network.",
      'To apply, you must have completed MetFix Essentials. Start with the free "What Is MetFix?" class if you are new to the curriculum, then enroll in Essentials to qualify.',
    ],
    primaryCta: {
      label: "Enroll in MetFix Essentials",
      href: "https://brokenscience.org/our-courses/",
    },
    secondaryCta: {
      label: "Take the Free Class First",
      href: "https://whatis.metfix.org/",
    },
    requirements: [
      {
        title: "Operating Gym or Facility",
        description:
          "You must own or operate a gym, box, or medical practice or have permission to open an affiliate inside an existing facility with active members.",
      },
      {
        title: "MetFix Essentials Required",
        description:
          "You must complete MetFix Essentials before applying. It is the foundational curriculum that qualifies you to implement MetFix programming. The Foundations Seminar is strongly recommended for coaches and owners and can be completed after affiliation. Because Foundations offers tactical and practical applications of the material it is helpful to plan to complete this in-person course within a year of affiliation.",
      },
      {
        title: "Commitment to MetFix Programming",
        description:
          "You agree to implement MetFix programming standards and metabolic health education within your facility.",
      },
      {
        title: "Application & Approval",
        description:
          "Affiliate status is granted through a review process. Not all applicants are accepted. We review your facility, your team, and your commitment to the mission.",
      },
      {
        title: "Annual Affiliate Agreement",
        description:
          "Affiliate membership is $170/month with an annual commitment ($2,000/year). Affiliate status is renewed annually. Affiliates who do not maintain programming standards may have their status reviewed.",
      },
    ],
  },
  process: {
    eyebrow: "The Process",
    headline: {
      text: "How to become an affiliate.",
      goldPhrase: "become an affiliate.",
    },
    subtext:
      "The path to affiliate status is straightforward. Most applicants complete the process within a week of submitting their application.",
    steps: [
      {
        title: "Complete MetFix Essentials",
        description:
          "MetFix Essentials is required to apply. Start with the free 'What Is MetFix?' class if you are new, then complete Essentials to qualify. Foundations Seminar is strongly recommended for coaches and owners and can be completed after affiliation.",
      },
      {
        title: "Submit Your Application",
        description:
          "Fill out the affiliate application form. Tell us about your facility, your team, and why you want to bring MetFix to your community.",
      },
      {
        title: "Application Review",
        description:
          "Our team reviews every application. We will review your coaching background, and your commitment to the MetFix mission. This typically takes 5–10 business days.",
      },
      {
        title: "Affiliate Agreement",
        description:
          "Accepted applicants sign the MetFix Affiliate Agreement, which outlines programming standards, branding guidelines, and renewal terms.",
      },
      {
        title: "Welcome to the Network",
        description:
          "You are listed on the MetFix affiliate map, added to the private affiliate community, and given access to the full programming library, ongoing education and tools.",
      },
    ],
  },
  networkQuote: {
    eyebrow: "From the Network",
    quote:
      '"Before MetFix, I was a good coach. After MetFix, I became the person in my community who could actually explain why people were getting sick and what to do about it. That changed everything about how my gym operates."',
    attribution: "MetFix Affiliate, CrossFit Gym Owner",
  },
  application: {
    eyebrow: "Affiliate Application",
    headline: {
      text: "Ready to apply?",
      goldPhrase: "apply?",
    },
    subtext: "Applications are reviewed by the MetFix team within 5 business days.",
    buttonLabel: "Application",
    url: APPLICATION_URL,
    stickyButtonLabel: "Apply Now",
  },
};
