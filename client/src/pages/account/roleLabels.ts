/** Staff roles shown on the account dashboard. Other slugs stay hidden. */
const STAFF_ROLES = [
  { slug: "administrator", label: "Admin" },
  { slug: "metfix_admin", label: "MetFix Admin" },
] as const;

function staffSlug(raw: string): "administrator" | "metfix_admin" | null {
  const slug = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (slug === "administrator" || slug === "admin" || slug === "site_admin") {
    return "administrator";
  }
  if (slug === "metfix_admin" || slug === "metfixadmin") {
    return "metfix_admin";
  }
  return null;
}

/** Admin, then MetFix Admin, only when the account payload includes them. */
export function staffRoleLabels(roles: readonly unknown[] | undefined): string[] {
  if (!roles || roles.length === 0) return [];
  const have = new Set<string>();
  for (const role of roles) {
    if (typeof role !== "string") continue;
    const slug = staffSlug(role);
    if (slug) have.add(slug);
  }
  return STAFF_ROLES.filter((role) => have.has(role.slug)).map((role) => role.label);
}
