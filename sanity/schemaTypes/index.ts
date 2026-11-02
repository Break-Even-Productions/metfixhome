import { affiliatePage } from "./affiliatePage";
import { course } from "./course";
import { faqItem } from "./faqItem";
import { homePage } from "./homePage";
import {
  ctaLink,
  highlightedHeadline,
  libraryCategoryTag,
  libraryResource,
  membershipComparisonCell,
} from "./objects";
import { siteSettings } from "./siteSettings";
import { testimonial } from "./testimonial";

export const schemaTypes = [
  // documents
  siteSettings,
  homePage,
  affiliatePage,
  course,
  testimonial,
  faqItem,
  // objects
  ctaLink,
  highlightedHeadline,
  libraryCategoryTag,
  libraryResource,
  membershipComparisonCell,
];
