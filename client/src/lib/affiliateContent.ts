import {
  FALLBACK_AFFILIATE_PAGE,
  type AffiliatePageContent,
} from "@/data/fallbackAffiliate";

export function fetchAffiliatePage(): Promise<AffiliatePageContent> {
  return Promise.resolve(FALLBACK_AFFILIATE_PAGE);
}
