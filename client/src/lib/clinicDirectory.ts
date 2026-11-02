/** BSI clinic directory meta for Find a Doctor empty-state gating. */

const CLINIC_META_URL =
  "https://brokenscience.org/wp-json/bsi/v1/directory/clinic-meta";

export type ClinicDirectoryMeta = {
  clinic_count: number;
  find_a_doctor_enabled: boolean;
  fallback: "gym" | "clinic" | string;
};

export async function fetchClinicDirectoryMeta(
  signal?: AbortSignal,
): Promise<ClinicDirectoryMeta | null> {
  try {
    const res = await fetch(CLINIC_META_URL, {
      method: "GET",
      credentials: "omit",
      signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Partial<ClinicDirectoryMeta>;
    const clinic_count = Number(data.clinic_count ?? 0);
    return {
      clinic_count,
      find_a_doctor_enabled: Boolean(data.find_a_doctor_enabled) && clinic_count >= 1,
      fallback: (data.fallback as ClinicDirectoryMeta["fallback"]) || "gym",
    };
  } catch {
    return null;
  }
}

/** Public clinics list (when Find a Doctor is enabled). */
export const CLINICS_API_URL = "https://brokenscience.org/wp-json/bsi/v1/clinics";

/** Directory page that hosts the gym map (and Find a Doctor when enabled). */
export const METFIX_DIRECTORY_MAP_URL = "https://brokenscience.org/metfix/metfix-map/";
