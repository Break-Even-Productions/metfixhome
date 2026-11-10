/** BSI public profile REST paths. Keep `/wp-json` here, never in worker/ (AU26.8). */

const BSI = "/wp-json/bsi/v1";

export function publicMetfixProfilePath(id: string): string {
  return `${BSI}/profiles/public/metfix/${id}`;
}

export function publicAffiliateProfilePath(id: string): string {
  return `${BSI}/profiles/public/affiliates/${id}`;
}

export function publicClinicProfilePath(id: string): string {
  return `${BSI}/profiles/public/clinics/${id}`;
}
