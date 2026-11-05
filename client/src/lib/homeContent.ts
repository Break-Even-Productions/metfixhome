import {
  FALLBACK_FAQS,
  FALLBACK_HOME,
  FALLBACK_HOME_COURSES,
  FALLBACK_TESTIMONIALS,
} from "@/data/fallbackHome";
import { experts as FALLBACK_EXPERTS, type Expert } from "@/data/home/experts";
import type { HomeCourseCard, HomeFaq, HomePageContent, HomeTestimonial } from "@/lib/homeTypes";

export type { Expert };

export function fetchHomePage(): Promise<HomePageContent> {
  return Promise.resolve(FALLBACK_HOME);
}

export function fetchHomeCourses(): Promise<HomeCourseCard[]> {
  return Promise.resolve(FALLBACK_HOME_COURSES);
}

export function fetchTestimonials(): Promise<HomeTestimonial[]> {
  return Promise.resolve(FALLBACK_TESTIMONIALS);
}

export function fetchExperts(): Promise<Expert[]> {
  return Promise.resolve([...FALLBACK_EXPERTS]);
}

export function fetchFaqs(): Promise<HomeFaq[]> {
  return Promise.resolve(FALLBACK_FAQS);
}
