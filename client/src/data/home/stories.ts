import type { AudienceHref } from "./audience";

export type Testimonial = {
  quote: string
  name: string
  role: string
  photo: string
  position: string
}

export type FeaturePlacement = {
  name: string
  src: string
  className: string
}

const principled: FeaturePlacement = {
  name: "Principled Business Summit",
  src: "/featured/principled.png",
  className: "max-h-9 max-w-[12.5rem]",
}

const ahead: FeaturePlacement = {
  name: "Ahead of Alzheimer's Documentary",
  src: "/featured/ahead.png",
  className: "max-h-16 max-w-[12rem]",
}

const pepmed: FeaturePlacement = {
  name: "PepMed Conference",
  src: "/featured/pepmed-white.png",
  className: "h-16 max-w-[10.5rem] brightness-0",
}

const hlth: FeaturePlacement = {
  name: "HLTH",
  src: "/featured/hlth.svg",
  className: "h-7 w-auto",
}

const storiesByAudience: Record<
  AudienceHref,
  { testimonials: readonly Testimonial[]; featuredAt: readonly FeaturePlacement[] }
> = {
  "#for-individuals": {
    featuredAt: [ahead, hlth, pepmed, principled],
    testimonials: [
      {
        quote: "I came for the weight. I stayed because my energy came back.",
        name: "Maya R.",
        role: "MetFix Member",
        photo: "/Stills/athlete-bodyweight-sit-gym-cadi-rudd.jpg",
        position: "center 25%",
      },
      {
        quote: "I stopped guessing at my labs and started understanding them.",
        name: "Andre P.",
        role: "MetFix Member",
        photo: "/Stills/athlete-bodyweight-stand-gym-mckenna.jpg",
        position: "center 30%",
      },
      {
        quote: "Down two sizes, and I finally sleep through the night.",
        name: "Lila K.",
        role: "MetFix Member",
        photo: "/Stills/athlete-bodyweight-sit-park.jpg",
        position: "center 35%",
      },
      {
        quote: "Metabolic health became something I could actually do at home.",
        name: "Chris D.",
        role: "MetFix Member",
        photo: "/Stills/athlete-bodyweight-stand-gym-janice.jpg",
        position: "center 28%",
      },
    ],
  },
  "#for-athletes": {
    featuredAt: [hlth, ahead, principled, pepmed],
    testimonials: [
      {
        quote: "Fueling stopped being a guess. Race day feels repeatable now.",
        name: "Jordan M.",
        role: "MetFix Athlete",
        photo: "/Stills/athlete-bodyweight-squat-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "Less bonking, better sleep, and my lifts stopped stalling.",
        name: "Sam V.",
        role: "MetFix Athlete",
        photo: "/Stills/athlete-bodyweight-action-gym-2.jpg",
        position: "center 20%",
      },
      {
        quote: "I train hard and recover like I mean it. It showed up by week three.",
        name: "Alex T.",
        role: "MetFix Athlete",
        photo: "/Stills/athlete-bodyweight-deadlift-indoors-sunt-tropics-hydration.jpg",
        position: "center 30%",
      },
      {
        quote: "The first nutrition education that respected how I actually train.",
        name: "Riley S.",
        role: "MetFix Athlete",
        photo: "/Stills/athlete-bodyweight-action-gym-5.jpg",
        position: "center 25%",
      },
    ],
  },
  "#for-coaches": {
    featuredAt: [principled, hlth, pepmed, ahead],
    testimonials: [
      {
        quote: "I can explain insulin resistance without drowning a client in jargon.",
        name: "Dana L.",
        role: "MetFix Coach",
        photo: "/Stills/athlete-bodyweight-stand-gym-caleb.jpg",
        position: "center 22%",
      },
      {
        quote: "Members get a plan, not a lecture. Retention followed.",
        name: "Marcus H.",
        role: "MetFix Coach",
        photo: "/Stills/athlete-bodyweight-stand-gym-chris.jpg",
        position: "center 28%",
      },
      {
        quote: "A curriculum I trust in front of a room.",
        name: "Priya N.",
        role: "MetFix Coach",
        photo: "/Stills/group-bodyweight-stand-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "I coach the person in front of me, and the science holds up.",
        name: "Evan C.",
        role: "MetFix Coach",
        photo: "/Stills/athlete-bodyweight-stand-gym-alex.jpg",
        position: "center 25%",
      },
    ],
  },
  "#for-gym-owners": {
    featuredAt: [principled, hlth, ahead, pepmed],
    testimonials: [
      {
        quote: "We added metabolic classes and the gym became the place people get well.",
        name: "Nina G.",
        role: "Gym Owner",
        photo: "/Stills/group-bodyweight-squat-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "Members finally had a reason to stay past the new-year rush.",
        name: "Omar S.",
        role: "Gym Owner",
        photo: "/Stills/group-bodyweight-stand-gym-2.jpg",
        position: "center 28%",
      },
      {
        quote: "Coaches on the floor are speaking the same language now.",
        name: "Heather B.",
        role: "Gym Owner",
        photo: "/Stills/group-bodyweight-action-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "A real program, not another challenge that dies in February.",
        name: "Luis R.",
        role: "Gym Owner",
        photo: "/Stills/athlete-bodyweight-stand-gym-bon.jpg",
        position: "center 25%",
      },
    ],
  },
  "#for-first-responders": {
    featuredAt: [ahead, pepmed, hlth, principled],
    testimonials: [
      {
        quote: "Shift work used to wreck my sleep. I have a way through it now.",
        name: "Mike A.",
        role: "Firefighter",
        photo: "/Stills/athlete-bodyweight-stand-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "The crew eats together. The meals are part of the training.",
        name: "Station 12",
        role: "Fire Department",
        photo: "/Stills/group-bodyweight-stand-gym-3.jpg",
        position: "center 30%",
      },
      {
        quote: "I finish a 24 and still have something left for my family.",
        name: "Kara J.",
        role: "Paramedic",
        photo: "/Stills/athlete-bodyweight-action-gym.jpg",
        position: "center 25%",
      },
      {
        quote: "Built for the job, not for someone with a perfect schedule.",
        name: "Dave P.",
        role: "Police Officer",
        photo: "/Stills/athlete-bodyweight-stand-gym-chris-2.jpg",
        position: "center 28%",
      },
    ],
  },
  "#for-clinicians": {
    featuredAt: [pepmed, hlth, ahead, principled],
    testimonials: [
      {
        quote: "I leave visits with a protocol patients can actually follow.",
        name: "Dr. Elena V.",
        role: "Family Medicine",
        photo: "/Stills/athlete-bodyweight-stand-gym-brandi.jpg",
        position: "center 25%",
      },
      {
        quote: "Metabolic medicine finally has a classroom that respects the evidence.",
        name: "Dr. James W.",
        role: "Internal Medicine",
        photo: "/Stills/athlete-bodyweight-sit-gym.jpg",
        position: "center 30%",
      },
      {
        quote: "I work with coaches instead of hoping patients figure it out alone.",
        name: "Dr. Amina S.",
        role: "Obesity Medicine",
        photo: "/Stills/athlete-bodyweight-stand-gym-monique-metfix-pace.jpg",
        position: "center 25%",
      },
      {
        quote: "The CME is the bonus. The clinical clarity is the point.",
        name: "Dr. Robert K.",
        role: "Primary Care",
        photo: "/Stills/group-bodyweight-sit-gym.jpg",
        position: "center 30%",
      },
    ],
  },
  "#for-organizations": {
    featuredAt: [principled, hlth, pepmed, ahead],
    testimonials: [
      {
        quote: "We rolled this out across departments without hiring another wellness vendor.",
        name: "Hannah C.",
        role: "People Team",
        photo: "/Stills/group-bodyweight-stand-gym-4.jpg",
        position: "center 30%",
      },
      {
        quote: "Employees got education they use, not a portal they ignore.",
        name: "Greg T.",
        role: "Benefits Lead",
        photo: "/Stills/group-bodyweight-sit-gym-2.jpg",
        position: "center 30%",
      },
      {
        quote: "One curriculum for clinicians, coaches, and the people they serve.",
        name: "Naomi F.",
        role: "Health System",
        photo: "/Stills/group-bodyweight-squat-gym-2.jpg",
        position: "center 28%",
      },
      {
        quote: "Our outcomes conversations got more specific, and more honest.",
        name: "Northline Health",
        role: "Organization",
        photo: "/Stills/group-bodyweight-stand-gym-6.jpg",
        position: "center 30%",
      },
    ],
  },
}

export function storiesFor(audience: AudienceHref) {
  return storiesByAudience[audience]
}

