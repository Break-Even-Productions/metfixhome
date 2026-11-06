/** BSI directory REST paths. Keep `/wp-json` here, never in worker/. */

const BSI = "/wp-json/bsi/v1";

export function affiliatesMapPath(): string {
  return `${BSI}/affiliates`;
}

export function clinicsPath(): string {
  return `${BSI}/clinics`;
}

export function coachesMapPath(): string {
  return `${BSI}/coaches`;
}
