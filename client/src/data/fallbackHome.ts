import { assetUrl } from "@/const";
import type { HomeCourseCard, HomeFaq, HomePageContent, HomeTestimonial } from "@/lib/homeTypes";

const METFIX_MAP_URL = "https://brokenscience.org/metfix/metfix-map/";

export const FALLBACK_HOME: HomePageContent = {
  hero: {
    eyebrow: "The Metabolic Fix",
    headline: {
      text: "This is what happens\nwhen coaches understand\nmetabolic health.",
      goldPhrase: "metabolic health.",
    },
    subtext:
      "MetFix trains coaches, gym owners, and health leaders to prevent and reverse chronic disease using metabolic science that works in the real world.",
    statText: "130+ affiliate gyms. Year one.",
    primaryCta: { label: "Take the Free Class", href: "https://whatis.metfix.org/" },
    secondaryCta: {
      label: "See what you get as a MetFix affiliate",
      href: "/become-an-affiliate",
    },
    tertiaryLink: { label: "Not a coach? Start here", href: "https://whatis.metfix.org/" },
  },
  problem: {
    eyebrow: "The Problem",
    quote:
      '"Three in four American adults have at least one chronic condition,\nand over half have two or more."',
    sourceText: "— Centers for Disease Control and Prevention, May 14, 2026 (",
    sourceUrl: "https://www.cdc.gov/chronic-disease/about/index.html",
    sourceLinkLabel: "cdc.gov",
  },
  playbook: {
    eyebrow: "Start Now. Free Forever.",
    headline: {
      text: "The conventional playbook\nhas not solved the problem.\nOurs actually works.",
      goldPhrase: "Ours actually works.",
    },
    cta: {
      label: "See what you get as a MetFix affiliate",
      href: "/become-an-affiliate",
    },
  },
  specialtyTracks: {
    eyebrow: "Specialty Tracks",
    headline: {
      text: "Go deeper.\nPick your population.",
      goldPhrase: "Pick your population.",
    },
    subtext:
      "Each specialty track applies the MetFix framework to a specific population. Built by practitioners who work with that population every day.",
  },
  affiliation: {
    eyebrow: "MetFix Affiliation",
    headline: {
      text: "Join the gyms\nalready doing this.",
      goldPhrase: "already doing this.",
    },
    body: "We work alongside you providing education, tools, and direct revenue opportunities designed to increase your ROI from day one. Affiliates access all MetFix courses at no cost and earn revenue share when their clients purchase through them.",
    supportingText:
      "130+ gyms affiliated in year one. Police departments. Fire stations. CrossFit boxes. Independent studios. All of them saw the same thing: clients who finally got results.",
    monthlyPrice: "$167",
    priceNote: "/ month  ·  annual commitment",
    benefits: [
      "Access to all MetFix online courses at no cost.",
      "Complete Resource Library: live streams, journal clubs, articles, whiteboards, book reports.",
      "Special meal planning features and client tracking on the MetFix app.",
      "Revenue share when your clients purchase MetFix courses through your gym.",
      "MetFix brand license, affiliate dashboard, and gym finder listing.",
    ],
    primaryCta: {
      label: "See what you get as a MetFix affiliate",
      href: "/become-an-affiliate",
    },
    secondaryCta: { label: "Find a Gym Near You", href: METFIX_MAP_URL },
  },
  foundations: {
    eyebrow: "Live Education",
    headline: {
      text: "MetFix Foundations\nSeminar",
      goldPhrase: "Seminar",
    },
    body: "Two days. In person. The hands-on practical capstone of the MetFix curriculum. You leave with the metabolic health coaching framework fully integrated, practiced, and ready to deploy with your clients on Monday.",
    supportingText:
      "Foundations is where the community comes together. Coaches and practitioners from around the world. Shared knowledge, workouts and practical implementation. The MetFix culture, in-person.",
    cta: {
      label: "View Upcoming Seminars",
      href: "https://brokenscience.org/events/",
    },
    videosLabel: "Hear From Coaches Who Attended",
    videoEmbedUrls: [
      "https://player.vimeo.com/video/1193427610?h=f9a70db6c8&title=0&byline=0&portrait=0",
      "https://player.vimeo.com/video/1193430051?h=0d46185ed6&title=0&byline=0&portrait=0",
      "https://player.vimeo.com/video/1193432090?h=db017c46d7&title=0&byline=0&portrait=0",
      "https://player.vimeo.com/video/1193432959?h=80466c75eb&title=0&byline=0&portrait=0",
    ],
  },
  whyDifferent: {
    eyebrow: "Why MetFix Is Different",
    names: "Emily Kaplan & Greg Glassman",
    roles: "Co-Founders of MetFix\nand The Broken Science Initiative",
    photoUrl: assetUrl("/founders.png"),
    photoCaptionLeft: "Founders",
    photoCaptionRight: "Emily Kaplan & Greg Glassman",
    quote:
      "The healthcare system is not broken. It is working exactly as it was designed — generating more than $4 trillion annually from treatments that manage symptoms and never address the root cause. At MetFix, for the cost of a gym membership, your clients can work on the root cause. Education is the antidote.",
    quoteAttribution: "Emily Kaplan",
    quoteRole: "CEO, MetFix & The Broken Science Initiative",
    body: [
      "Emily Kaplan opened her first gym and watched fit, motivated clients still get sick. She hired coaches, worked with clients, and built a curriculum. She had spent decades looking at why the science wasn't working. She knew there was a better way to help people. That work became MetFix and The Broken Science Initiative.",
      "MetFix was co-founded with Greg Glassman, founder of CrossFit, and built on the research infrastructure of The Broken Science Initiative. It is not an opinion platform. It is the product of decades of investigations, hands-on coaching, and building businesses that work.",
    ],
    link: { label: "The Broken Science Initiative", href: "https://brokenscience.org/" },
  },
  resourceLibrary: {
    eyebrow: "Resource Library",
    headline: {
      text: "Full Resource Library. Cutting Edge Classes.\nA Community Raising the Standard.",
      goldPhrase: "A Community Raising the Standard.",
    },
    subtext:
      "Journal clubs, live streams, whiteboards, book reports, and original articles from Dr. Ben Bikman, Nina Teicholz, Dr. Malcolm Kendrick, and more. The research your clients need, organized for coaches.",
    categoryTags: [
      { label: "Videos", href: "/library?content_type_terms[]=videos" },
      { label: "Articles", href: "/library?content_type_terms[]=articles" },
      { label: "Live Streams", href: "/library?content_type_terms[]=webinars" },
      { label: "Journal Club", href: "/library?content_type_terms[]=journal-clubs" },
      { label: "Coach Briefings", href: "/library?content_type_terms[]=whiteboards" },
    ],
    fullLibraryCta: {
      label: "Full Library",
      href: "/library",
    },
    featured: {
      category: "Unbreakable Keynote",
      title: "A Body of Lies – Emily Kaplan",
      description:
        "At the 2026 Unbreakable Health Retreat in Miami, Emily Kaplan presents the chronic disease epidemic not as bad luck or failed willpower, but as the product of decades of flawed science, institutional corruption, and incentives that reward disease management over health.",
      author: "Emily Kaplan",
      tag: "42 min",
      badge: "Free",
      href: "/library",
      mediaType: "photo",
      imageUrl: assetUrl("/emily-kaplan-keynote.png"),
      showPlayButton: true,
    },
    items: [
      {
        category: "Journal Club",
        title: "Insulin Resistance Precedes Type 2 Diabetes by a Decade",
        description:
          "Critical analysis of landmark research showing insulin resistance begins 10+ years before diagnosis and what that means for your coaching practice.",
        author: "Bob Kaplan",
        tag: "22 min",
        badge: "Pro",
        href: "/library",
        mediaType: "none",
        showPlayButton: false,
      },
      {
        category: "Whiteboard",
        title: "The Mitochondria: Powerhouse of the Cell and Metabolic Flexibility",
        description:
          "Pete Shaw breaks down how mitochondria power your cells and drive metabolic flexibility. The visual that makes it click for coaches.",
        author: "Pete Shaw",
        tag: "14 min",
        badge: "Free",
        href: "/library",
        mediaType: "none",
        showPlayButton: false,
      },
      {
        category: "Speaking Event",
        title: "An Introduction to the Disease Economy",
        description:
          "Emily Kaplan addresses the systemic failures in modern science and healthcare. Why the system is designed to manage disease, not reverse it.",
        author: "Emily Kaplan",
        tag: "Read",
        badge: "Free",
        href: "/library",
        mediaType: "none",
        showPlayButton: false,
      },
    ],
    bottomCta: {
      label: "Access the Full Library",
      href: "/library",
    },
  },
  gap: {
    eyebrow: "The Gap",
    headline: {
      text: "Most training programs don't address metabolic health in a meaningful way.",
      goldPhrase: "in a meaningful way.",
    },
    body: "Coaches and practitioners deserve better. That disconnect is the issue. We were all fed faulty promises. It is time to sound the alarm and do what actually works.",
    cta: { label: "See the MetFix Approach", href: "https://whatis.metfix.org/" },
    listLabel: "The Status Quo is Not Enough",
    statusQuoItems: [
      "Guidelines paid for by industry",
      "Studies that don't replicate",
      "Mantras about moving more and eating less",
      "Blaming clients rather than fixing the knowledge gap",
    ],
    closingQuote:
      "“We followed their advice and it only made us all sicker. It’s time for a revolution in health.” Emily Kaplan",
  },
  testimonialsSection: {
    eyebrow: "What MetFix Coaches Say",
  },
  network: {
    eyebrow: "Global Network",
    headline: {
      text: "130+ affiliate gyms.\nYear one.",
      goldPhrase: "Year one.",
    },
    body: "MetFix affiliates are in every corner of the country. Police departments. Fire stations. Schools. Clinics. CrossFit boxes. Independent studios. Everywhere coaches and practitioners are serious about results.",
    cta: { label: "See what you get as a MetFix affiliate", href: "/become-an-affiliate" },
    featuredLocations: [
      { name: "MetFix Pace", city: "Sacramento, CA" },
      { name: "MetFix Bern", city: "Bern, Switzerland" },
      { name: "MetFix OCS", city: "New Jersey, NJ" },
      { name: "Rogue Europe MetFix", city: "Bornem, Belgium" },
      { name: "MetFix JAX", city: "Jacksonville, FL" },
      { name: "Ellipsis MetFix", city: "Aberdeenshire, UK" },
      { name: "MetFix Wash Park", city: "Denver, CO" },
      { name: "Good Day MetFix", city: "Austin, TX" },
    ],
  },
  weekly: {
    eyebrow: "The MetFix Weekly",
    headline: {
      text: "One email.\nEverything you need.",
      goldPhrase: "Everything you need.",
    },
    body: "Every week, MetFix subscribers get 7 recipes, 7 workouts, and 7 readings from The Daily Fix, plus announcements about upcoming events, seminars, and courses, and an original article written exclusively for the MetFix community.",
  },
  faqSection: {
    eyebrow: "Common Questions",
    headline: {
      text: "Everything you need\nto get started.",
      goldPhrase: "to get started.",
    },
  },
};

export const FALLBACK_HOME_COURSES: HomeCourseCard[] = [
  {
    id: "essentials-advanced",
    label: "Professional",
    name: "MetFix Essentials Advanced",
    desc: "The complete professional curriculum. Every mechanism, every protocol, every conversation you need to coach metabolic health at the highest level.",
    href: "https://brokenscience.org/our-courses/",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
  {
    id: "fit-for-duty",
    label: "Specialty",
    name: "Fit for Duty",
    desc: "Metabolic health programming built for law enforcement, fire service, and military. The health crisis hiding in every department.",
    href: "https://brokenscience.org/fit-for-life-mailing-list/",
    tag: "Coming Soon",
    live: false,
    notify: true,
  },
  {
    id: "missing-manual",
    label: "Specialty",
    name: "The Missing Manual",
    desc: "The course on puberty, perimenopause, and women's metabolic health that every coach working with women needs.",
    href: "https://brokenscience.org/the-missing-manual-mailing-list/",
    tag: "Coming Soon",
    live: false,
    notify: true,
  },
  {
    id: "medical-nutrition",
    label: "Specialty",
    name: "Medical Nutrition Training",
    desc: "For physicians, PAs, and medical professionals who want to prescribe nutrition with clinical precision.",
    href: "#",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
  {
    id: "prepared-patient",
    label: "Specialty",
    name: "The Prepared Patient",
    desc: "For people who are tired of being managed. The metabolic science your doctor never had time to explain, and what you can actually do about it.",
    href: "#",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
  {
    id: "atp",
    label: "Specialty",
    name: "ATP, Athletic Teen Performance",
    desc: "Teenage athletes are not small adults. Their metabolic needs are different. This is the course that treats them that way.",
    href: "#",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
  {
    id: "coaching-glps",
    label: "Coming Soon",
    name: "Coaching GLPs",
    desc: "How to coach clients on GLP-1 medications without losing muscle, metabolic function, or long-term results.",
    href: "#",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
  {
    id: "optimal-athletic-fueling",
    label: "Coming Soon",
    name: "Optimal Athletic Fueling",
    desc: "Periodized nutrition for performance. The metabolic science behind fueling athletes who want to win and stay healthy.",
    href: "#",
    tag: "Coming Soon",
    live: false,
    notify: false,
  },
];

export const FALLBACK_TESTIMONIALS: HomeTestimonial[] = [
  {
    id: "t1",
    quote:
      "It's great to be going back to the original message that got me into functional training in the first place, which is using fitness, exercise, and food to improve people's health. I'm really excited to take some of the things I've learned today and apply them to helping improve the lives of the members in my community.",
    name: "Matty H.",
    role: "MetFix Foundations Participant",
    gym: "",
  },
  {
    id: "t2",
    quote:
      "What stood out most was how the seminar brought everything together. Concepts I'd heard for years finally made sense in a practical way, and I left motivated to make meaningful changes in how I coach and support my members.",
    name: "Pierre",
    role: "MetFix Foundations Participant",
    gym: "Lyon, France",
  },
  {
    id: "t3",
    quote:
      "The science helped me understand struggles I thought were personal failures and gave me a new level of compassion for myself.",
    name: "Meghan Russell",
    role: "MetFix Academy Staff and Affiliate Owner",
    gym: "",
  },
  {
    id: "t4",
    quote:
      "My background is in biology and exercise, not nutrition. Seeing those pieces connected together in a way that was intuitive and logical was incredibly valuable.",
    name: "MFx SC Coach",
    role: "MetFix Coach",
    gym: "",
  },
  {
    id: "t5",
    quote:
      "We're taking it to the next level, bringing together a lot of like-minded people to continue Greg's message and change people's lives.",
    name: "Clint Wiegal",
    role: "MetFix Affiliate",
    gym: "",
  },
  {
    id: "t6",
    quote:
      "I came to gain knowledge that would help my members live healthier lives, and what stood out most was that we didn't just learn information, we learned how to apply it.",
    name: "Clint Wiegal",
    role: "MetFix Affiliate",
    gym: "",
  },
];

export const FALLBACK_FAQS: HomeFaq[] = [
  {
    id: "f1",
    question: "Is MetFix a certificate?",
    answer:
      "MetFix is an education platform, not a certification body. Our curriculum gives you the metabolic health knowledge and practical tools to transform your coaching practice. The Foundations Seminar and affiliate pathway represent the highest level of MetFix education, recognized by the MetFix community worldwide.",
  },
  {
    id: "f2",
    question: "How long does it take to complete the curriculum?",
    answer:
      "The free What Is MetFix? class takes about an hour to complete. Specialty tracks range from 6 to 40 hours depending on the course. Foundations is a two-day in-person weekend seminar. You can move at your own pace with no deadlines.",
  },
  {
    id: "f3",
    question: "What is the difference between Essentials and Foundations?",
    answer:
      "MetFix Essentials Advanced is the online curriculum and is required to apply for affiliation. It covers every mechanism, protocol, and coaching conversation you need to deliver metabolic health programming at a professional level. Foundations is the in-person, hands-on seminar and is strongly recommended for coaches and owners, but it can be completed after you become an affiliate. Most coaches complete Essentials first, then attend a Foundations Seminar to apply the knowledge alongside other coaches.",
  },
  {
    id: "f4",
    question: "Do I need a medical background to take these courses?",
    answer:
      "No medical background required. MetFix is designed for coaches, trainers, gym owners and doctors and healthcare workers who want to deliver clinical-level metabolic health knowledge in a coaching setting. Physicians and medical professionals are absolutely welcome and regularly attend Foundations. We have several medical professionals who run MetFix programs through their medical practices. For our medical professionals we also offer a dedicated Medical Nutrition Training track built for them.",
  },
  {
    id: "f5",
    question: "What is a MetFix Affiliate?",
    answer:
      "A MetFix Affiliate is a gym, box, or training facility that has been accepted into the MetFix affiliate program and committed to implementing MetFix programming in their community. Affiliates are part of a global network of coaches fighting chronic disease, with access to exclusive programming, community support, and ongoing education.",
  },
  {
    id: "f6",
    question: "What is the Broken Science Initiative?",
    answer:
      "The Broken Science Initiative (BSI) is the research and intellectual foundation behind MetFix. BSI identifies where the science on chronic disease has gone wrong, and builds the evidence base for what actually works. BSI points to the problems. MetFix is how those solutions get applied in the real world, in your gym, with your community.",
  },
];
