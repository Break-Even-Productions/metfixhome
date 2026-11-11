import type { AccountProfile, ProfileAttrSection, ProfileAttributeField } from "@/lib/account";
import { humanSettingLabel } from "./settingLabels";

export type ProfileAddressValue = {
  address: string;
  address2: string;
  city: string;
  zip: string;
  state: number | null;
  country: number | null;
};

export type ProfileSelectOption = {
  id: number;
  name: string;
};

export type EditableProfileAttribute = {
  attr_id: number;
  label: string;
  value: string;
  section: ProfileAttrSection;
  form_type: string;
  description?: string;
  category?: string;
  address?: ProfileAddressValue | null;
  options?: ProfileSelectOption[];
};

type AttributeRow = ProfileAttributeField & {
  id?: number;
  attr_name?: string;
};

function readAddress(raw: unknown): ProfileAddressValue | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  return {
    address: typeof rec.address === "string" ? rec.address : "",
    address2: typeof rec.address2 === "string" ? rec.address2 : "",
    city: typeof rec.city === "string" ? rec.city : "",
    zip: typeof rec.zip === "string" ? rec.zip : "",
    state: typeof rec.state === "number" ? rec.state : null,
    country: typeof rec.country === "number" ? rec.country : null,
  };
}

function readOptions(raw: unknown): ProfileSelectOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options: ProfileSelectOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: unknown; name?: unknown; label?: unknown };
    const id = typeof rec.id === "number" ? rec.id : null;
    const name = typeof rec.name === "string" ? rec.name : typeof rec.label === "string" ? rec.label : "";
    if (id == null || id <= 0 || !name) continue;
    options.push({ id, name });
  }
  return options;
}

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
    if (formType === "email" || formType === "file" || formType === "video") continue;
    const label = rowLabel(record);
    if (!label) continue;
    seen.add(attrId);
    const extra = record as AttributeRow & {
      description?: unknown;
      category?: unknown;
      address?: unknown;
      options?: unknown;
    };
    out.push({
      attr_id: attrId,
      label,
      value: typeof record.value === "string" ? record.value : "",
      section,
      form_type: formType,
      description: typeof extra.description === "string" ? extra.description : undefined,
      category: typeof extra.category === "string" ? extra.category : undefined,
      address: readAddress(extra.address),
      options: readOptions(extra.options),
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
