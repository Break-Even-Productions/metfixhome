import type { AccountProfile } from "@/lib/account";
import { humanSettingLabel } from "./settingLabels";

/** Worker `EDITABLE_ATTR_IDS` — saves outside this set are rejected. */
const EDITABLE_ATTR_IDS = new Set([1, 2, 3, 4, 5]);

/**
 * Documented member attributes (BSI migrations README).
 * Used only when the profile payload has no attribute list yet.
 */
const FALLBACK_FIELDS: ReadonlyArray<{ attr_id: number; label: string }> = [
  { attr_id: 1, label: "Address" },
  { attr_id: 5, label: "Video" },
];

export type EditableProfileAttribute = {
  attr_id: number;
  label: string;
  value: string;
};

type AttributeRow = {
  attr_id?: number;
  id?: number;
  key?: string;
  name?: string;
  label?: string;
  attr_name?: string;
  value?: string;
};

function rowLabel(row: AttributeRow, attrId: number): string | null {
  const named = row.label ?? row.name ?? row.attr_name ?? row.key;
  if (typeof named === "string") {
    if (/email/i.test(named)) return null;
    const label = humanSettingLabel(named);
    if (label) return label;
  }
  const fallback = FALLBACK_FIELDS.find((field) => field.attr_id === attrId);
  return fallback?.label ?? null;
}

/** Labeled fields the member can edit. Never includes a raw attribute id as the label. */
export function editableProfileAttributes(
  profile: AccountProfile | null,
): EditableProfileAttribute[] {
  const rows = Array.isArray(profile?.attributes) ? profile.attributes : null;
  if (!rows) {
    return FALLBACK_FIELDS.map((field) => ({ ...field, value: "" }));
  }
  const out: EditableProfileAttribute[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as AttributeRow;
    const attrId =
      typeof record.attr_id === "number"
        ? record.attr_id
        : typeof record.id === "number"
          ? record.id
          : null;
    if (attrId == null || !Number.isInteger(attrId) || !EDITABLE_ATTR_IDS.has(attrId)) continue;
    if (seen.has(attrId)) continue;
    const label = rowLabel(record, attrId);
    if (!label) continue;
    seen.add(attrId);
    out.push({
      attr_id: attrId,
      label,
      value: typeof record.value === "string" ? record.value : "",
    });
  }
  return out;
}
