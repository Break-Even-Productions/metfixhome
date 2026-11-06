/**
 * BSI account REST path builders. Keep `/wp-json` here (shared), never in worker/
 * (AU26.8). Paths match acceptance §2 DP1–DP31 upstream mapping.
 */

const BSI = "/wp-json/bsi/v1";
const METFIX = "/wp-json/metfix/v1";

export function accountMePath(): string {
  return `${BSI}/me/account`;
}

export function accountSubscriptionsPath(): string {
  return `${BSI}/me/subscriptions`;
}

export function accountPortalLinkPath(): string {
  return `${BSI}/me/subscriptions/portal-link`;
}

export function accountConvertToWhopPath(): string {
  return `${BSI}/me/subscriptions/convert-to-whop`;
}

/** Mint Whop subscription checkout. Browser still sends plan aliases; BSI takes plan_key. */
export function accountSubscriptionsCheckoutPath(): string {
  return `${BSI}/me/subscriptions/checkout`;
}

export function accountCancelDuplicatePath(subRef: string): string {
  return `${BSI}/me/subscriptions/${encodeURIComponent(subRef)}/cancel-duplicate`;
}

export function accountPaymentsPath(): string {
  return `${BSI}/me/payments`;
}

export function accountSpendPath(): string {
  return `${BSI}/me/spend`;
}

export function accountClaimCertificatePath(courseId: string): string {
  return `${BSI}/courses/${encodeURIComponent(courseId)}/claim-certificate`;
}

export function accountPurchaseCheckoutPath(courseId: string): string {
  return `${BSI}/courses/${encodeURIComponent(courseId)}/purchase-checkout`;
}

/** PR D CR3 / CL2 buy_outright — upstream checkout path (rev1.7 §PD-2 (A)). */
export function accountCourseCheckoutPath(courseId: string): string {
  return `${BSI}/courses/${encodeURIComponent(courseId)}/checkout`;
}

/** CL1 — three-path claim options (BSI §DTO). */
export function certificateClaimOptionsPath(): string {
  return `${BSI}/me/certificate-claim-options`;
}

/** CL2 prepay_credit — Whop credit prepay checkout. */
export function certificatePrepayCheckoutPath(courseId: string): string {
  return `${BSI}/courses/${encodeURIComponent(courseId)}/certificate-prepay-checkout`;
}

export function accountReferralsPath(): string {
  return `${BSI}/me/referrals`;
}

export function accountProfilesMePath(): string {
  return `${BSI}/profiles/me`;
}

export function accountMeProfilePath(): string {
  return `${BSI}/me/profile`;
}

/** Opt-in onboarding audience attributes (not entitlement / WP paid roles). */
export function accountMeCommunityChoicesPath(): string {
  return `${BSI}/me/community-choices`;
}

export function accountProfilesMeAttributesPath(): string {
  return `${BSI}/profiles/me/attributes`;
}

export function accountProfilesMePicturePath(): string {
  return `${BSI}/profiles/me/profile-picture`;
}

export function accountMyCoursesPath(): string {
  return `${BSI}/courses/my-courses`;
}

export function accountFavoritesPath(): string {
  return `${METFIX}/favorites`;
}

export function accountFavoriteItemPath(sourceType: string, sourceId: string): string {
  return `${METFIX}/favorites/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`;
}

export function accountReferralEarningsPath(): string {
  return `${BSI}/me/referral-earnings`;
}

export function accountReferralCodePath(): string {
  return `${BSI}/me/referral-code`;
}

export function accountCourseGiftsPath(): string {
  return `${BSI}/me/course-gifts`;
}

export function accountNotificationPreferencesPath(): string {
  return `${BSI}/notification-preferences`;
}

export function accountNewsletterPath(): string {
  return `${BSI}/me/newsletter`;
}

export function accountPrivacySettingsPath(): string {
  return `${BSI}/account/privacy-settings`;
}

export function accountPasswordResetPath(): string {
  return `${BSI}/me/password-reset`;
}

export function accountEmailPath(): string {
  return `${BSI}/me/email`;
}

export function accountEmailConfirmPath(): string {
  return `${BSI}/me/email/confirm`;
}

export function accountMemberSummaryPath(memberId: string): string {
  return `${BSI}/profiles/summary/${encodeURIComponent(memberId)}`;
}

/** Planned meals for a date range — mobile meal-plan calendar. */
export function accountCalendarMealsPath(): string {
  return `${METFIX}/calendar/meals`;
}

/** Paginated upcoming planned meals. */
export function accountCalendarMealsUpcomingPath(): string {
  return `${METFIX}/calendar/meals/upcoming`;
}

/** Daily macro totals (protein/fat/carbs) for a YYYY-MM-DD day. */
export function accountMacrosDailyPath(date: string): string {
  return `${METFIX}/macros/daily/${encodeURIComponent(date)}`;
}

/** PR / benchmark overview (Movement Library + measurements). */
export function accountPrOverviewPath(): string {
  return `${METFIX}/spark/pr-overview`;
}

/** Combined belly/body/brain/event day counts for the overview calendar. */
export function accountCalendarSurfacePath(): string {
  return `${METFIX}/calendar/surface`;
}

/** Plan or replace a meal on a calendar day (YYYY-MM-DD). */
export function accountPlanMealPath(date: string): string {
  return `${METFIX}/calendar/days/${encodeURIComponent(date)}/meals`;
}

export function accountShoppingListsPath(): string {
  return `${METFIX}/shopping-lists`;
}

export function accountShoppingListPath(id: string): string {
  return `${METFIX}/shopping-lists/${encodeURIComponent(id)}`;
}

export function accountShoppingListGeneratePath(id: string): string {
  return `${METFIX}/shopping-lists/${encodeURIComponent(id)}/generate`;
}

export function accountShoppingListEmailPath(id: string): string {
  return `${METFIX}/shopping-lists/${encodeURIComponent(id)}/email`;
}

/** Spark measurement history + log PR write path (same as mobile). */
export function accountSparkEntriesPath(): string {
  return `${METFIX}/spark/entries`;
}

export function accountMessagesConversationsPath(): string {
  return `${BSI}/messages/conversations`;
}

export function accountInAppNotificationsPath(): string {
  return `${BSI}/in-app-notifications`;
}

/** Hybrid meal/workout plan library (active / inactive buckets). */
export function accountPlansLibraryPath(): string {
  return `${METFIX}/plans/library`;
}

export function accountPlanPath(id: string): string {
  return `${METFIX}/plans/${encodeURIComponent(id)}`;
}

export function accountPlanActivePath(id: string): string {
  return `${METFIX}/plans/${encodeURIComponent(id)}/active`;
}

export function accountPlanSchedulePath(id: string): string {
  return `${METFIX}/plans/${encodeURIComponent(id)}/schedule`;
}

export function accountPlanPublishPath(id: string): string {
  return `${METFIX}/plans/${encodeURIComponent(id)}/publish`;
}

export function accountCustomRecipesPath(): string {
  return `${METFIX}/custom-recipes`;
}

export function accountCustomRecipePath(id: string): string {
  return `${METFIX}/custom-recipes/${encodeURIComponent(id)}`;
}

export function accountMacrosRangePath(): string {
  return `${METFIX}/macros/range`;
}

export function accountCalendarMealPath(id: string): string {
  return `${METFIX}/calendar/meals/${encodeURIComponent(id)}`;
}

export function accountShoppingListGeneratedDatesPath(): string {
  return `${METFIX}/shopping-lists/generated-dates`;
}
