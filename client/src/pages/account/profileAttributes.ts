import type { AccountProfile, ProfileAttrSection, ProfileAttributeField } from "@/lib/account";
import { humanSettingLabel } from "./settingLabels";

export type EditableProfileAttribute = {
  attr_id: number;
  label: string;
  value: string;
  section: ProfileAttrSection;
  form_type: string;
};

type AttributeRow = ProfileAttributeField & {
  id?: number;
  attr_name?: string;
};

function rowLabel(row: AttributeRow): string | null {
  const named = row.label ?? row.name ?? row.attr_name ?? row.key;
  if (typeof named !== "string" || !named.trim()) return null;
  if (/email/i.test(named)) return null;
  return humanSettingLabel(named) ?? named;
}

function normalizeSectionRows(
  rows: unknown,
  section: ProfileAttrSection,
): EditableProfileAttribute[] {
  if (!Array.isArray(rows)) return [];
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
    if (attrId == null || !Number.isInteger(attrId) || attrId <= 0) continue;
    if (seen.has(attrId)) continue;
    const formType = typeof record.form_type === "string" ? record.form_type : "text";
    if (formType === "email" || formType === "file") continue;
    const label = rowLabel(record);
    if (!label) continue;
    seen.add(attrId);
    out.push({
      attr_id: attrId,
      label,
      value: typeof record.value === "string" ? record.value : "",
      section,
      form_type: formType,
    });
  }
  return out;
}

/** Labeled fields for one Profile section (Personal / Affiliate / Clinic). */
export function editableProfileAttributesForSection(
  profile: AccountProfile | null,
  section: ProfileAttrSection,
): EditableProfileAttribute[] {
  const attrs = profile?.attributes;
  if (!attrs || typeof attrs !== "object") return [];
  return normalizeSectionRows(attrs[section], section);
}

/** All editable fields across sections (tests / diagnostics). */
export function editableProfileAttributes(
  profile: AccountProfile | null,
): EditableProfileAttribute[] {
  return ([
    "personal",
    "affiliate",
    "clinic",
  ] as const).flatMap((section) => editableProfileAttributesForSection(profile, section));
}
