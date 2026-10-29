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

/** PR D CR3 — preferred upstream checkout path (alias of purchase-checkout). */
export function accountCourseCheckoutPath(courseId: string): string {
  return `${BSI}/courses/${encodeURIComponent(courseId)}/checkout`;
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
