import { useEffect, useState } from "react";
import { fetchCourses, fetchSiteSettings } from "@/lib/content";
import { fetchAffiliatePage } from "@/lib/affiliateContent";
import {
  fetchFaqs,
  fetchHomeCourses,
  fetchHomePage,
  fetchTestimonials,
} from "@/lib/homeContent";
import type { Course, SiteSettings } from "@/lib/contentTypes";
import type { HomeCourseCard, HomeFaq, HomePageContent, HomeTestimonial } from "@/lib/homeTypes";
import { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } from "@/lib/contentTypes";
import { FALLBACK_COURSES } from "@/data/fallbackCourses";
import { FALLBACK_AFFILIATE_PAGE } from "@/data/fallbackAffiliate";
import type { AffiliatePageContent } from "@/data/fallbackAffiliate";
import {
  FALLBACK_FAQS,
  FALLBACK_HOME,
  FALLBACK_HOME_COURSES,
  FALLBACK_TESTIMONIALS,
} from "@/data/fallbackHome";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({
    copyrightText: DEFAULT_COPYRIGHT_TEXT,
    navLinks: DEFAULT_NAV_LINKS,
    searchTopics: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings().then((data) => {
      if (!cancelled) {
        setSettings(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>(FALLBACK_COURSES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCourses().then((data) => {
      if (!cancelled) {
        setCourses(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { courses, loading };
}

export function useAffiliatePage() {
  const [page, setPage] = useState<AffiliatePageContent>(FALLBACK_AFFILIATE_PAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAffiliatePage().then((data) => {
      if (!cancelled) {
        setPage(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { page, loading };
}

export function useHomeContent() {
  const [home, setHome] = useState<HomePageContent>(FALLBACK_HOME);
  const [homeCourses, setHomeCourses] = useState<HomeCourseCard[]>(FALLBACK_HOME_COURSES);
  const [testimonials, setTestimonials] = useState<HomeTestimonial[]>(FALLBACK_TESTIMONIALS);
  const [faqs, setFaqs] = useState<HomeFaq[]>(FALLBACK_FAQS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchHomePage(), fetchHomeCourses(), fetchTestimonials(), fetchFaqs()]).then(
      ([page, courses, quotes, faqItems]) => {
        if (!cancelled) {
          setHome(page);
          setHomeCourses(courses);
          setTestimonials(quotes);
          setFaqs(faqItems);
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { home, homeCourses, testimonials, faqs, loading };
}
