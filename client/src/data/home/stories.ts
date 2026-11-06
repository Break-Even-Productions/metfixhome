import type { AudienceHref } from "./audience";

/** Video story card — quote overlays a YouTube Short. */
export type VideoStory = {
  kind: "video"
  quote: string
  name: string
  role: string
  videoId: string
}

/** Photo story card — image only, no testimonial text. */
export type PhotoStory = {
  kind: "photo"
  photo: string
  position: string
}

export type StoryCard = VideoStory | PhotoStory

/** @deprecated Use StoryCard — kept as an alias for existing imports. */
export type Testimonial = StoryCard

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

const jen: VideoStory = {
  kind: "video",
  quote:
    "The Broken Science Initiative empowers me to be critical and wards off becoming a complacent consumer of the medical literature. This betters the care you provide your patients.",
  name: "Dr. Jen Crichton",
  role: "BSI Medical Society",
  videoId: "XH_cwT9dMcM",
}

const lori: VideoStory = {
  kind: "video",
  quote:
    "There is nothing I want more than to be alive to see the complete revamping of our health care system.",
  name: "Lori Hill",
  role: "Medical Society & MetFix Affiliate",
  videoId: "HrBoNFIehiU",
}

function photo(src: string, position: string): PhotoStory {
  return { kind: "photo", photo: src, position }
}

/** Two video quotes interleaved with the original stills (photos have no text). */
function stories([a, b, c, d]: readonly [PhotoStory, PhotoStory, PhotoStory, PhotoStory]): readonly StoryCard[] {
  return [jen, a, lori, b, c, d]
}

const storiesByAudience: Record<
  AudienceHref,
  { testimonials: readonly StoryCard[]; featuredAt: readonly FeaturePlacement[] }
> = {
  "#for-individuals": {
    featuredAt: [ahead, hlth, pepmed, principled],
    testimonials: stories([
      photo("/Stills/athlete-bodyweight-sit-gym-cadi-rudd.jpg", "center 25%"),
      photo("/Stills/athlete-bodyweight-stand-gym-mckenna.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-sit-park.jpg", "center 35%"),
      photo("/Stills/athlete-bodyweight-stand-gym-janice.jpg", "center 28%"),
    ]),
  },
  "#for-athletes": {
    featuredAt: [hlth, ahead, principled, pepmed],
    testimonials: stories([
      photo("/Stills/athlete-bodyweight-squat-gym.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-action-gym-2.jpg", "center 20%"),
      photo("/Stills/athlete-bodyweight-deadlift-indoors-sunt-tropics-hydration.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-action-gym-5.jpg", "center 25%"),
    ]),
  },
  "#for-coaches": {
    featuredAt: [principled, hlth, pepmed, ahead],
    testimonials: stories([
      photo("/Stills/athlete-bodyweight-stand-gym-caleb.jpg", "center 22%"),
      photo("/Stills/athlete-bodyweight-stand-gym-chris.jpg", "center 28%"),
      photo("/Stills/group-bodyweight-stand-gym.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-stand-gym-alex.jpg", "center 25%"),
    ]),
  },
  "#for-gym-owners": {
    featuredAt: [principled, hlth, ahead, pepmed],
    testimonials: stories([
      photo("/Stills/group-bodyweight-squat-gym.jpg", "center 30%"),
      photo("/Stills/group-bodyweight-stand-gym-2.jpg", "center 28%"),
      photo("/Stills/group-bodyweight-action-gym.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-stand-gym-bon.jpg", "center 25%"),
    ]),
  },
  "#for-first-responders": {
    featuredAt: [ahead, pepmed, hlth, principled],
    testimonials: stories([
      photo("/Stills/athlete-bodyweight-stand-gym.jpg", "center 30%"),
      photo("/Stills/group-bodyweight-stand-gym-3.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-action-gym.jpg", "center 25%"),
      photo("/Stills/athlete-bodyweight-stand-gym-chris-2.jpg", "center 28%"),
    ]),
  },
  "#for-clinicians": {
    featuredAt: [pepmed, hlth, ahead, principled],
    testimonials: stories([
      photo("/Stills/athlete-bodyweight-stand-gym-brandi.jpg", "center 25%"),
      photo("/Stills/athlete-bodyweight-sit-gym.jpg", "center 30%"),
      photo("/Stills/athlete-bodyweight-stand-gym-monique-metfix-pace.jpg", "center 25%"),
      photo("/Stills/group-bodyweight-sit-gym.jpg", "center 30%"),
    ]),
  },
  "#for-organizations": {
    featuredAt: [principled, hlth, pepmed, ahead],
    testimonials: stories([
      photo("/Stills/group-bodyweight-stand-gym-4.jpg", "center 30%"),
      photo("/Stills/group-bodyweight-sit-gym-2.jpg", "center 30%"),
      photo("/Stills/group-bodyweight-squat-gym-2.jpg", "center 28%"),
      photo("/Stills/group-bodyweight-stand-gym-6.jpg", "center 30%"),
    ]),
  },
}

export function storiesFor(audience: AudienceHref) {
  return storiesByAudience[audience]
}
