import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  loadOverview,
  loadProfile,
  updateOnboardingRoles,
  updateProfile,
  updateProfileAttributes,
  uploadProfilePicture,
  type AccountOverview,
  type AccountProfile as ProfileDto,
  type ProfileAttrSection,
  type RoleId,
} from "@/lib/account";
import { needsConditionalStep } from "@shared/join/membership-domain";
import DashboardLayout from "./DashboardLayout";
import {
  editableProfileAttributesForSection,
  type EditableProfileAttribute,
} from "./profileAttributes";
import { AttributeFields, type AttributeWrite } from "./AttributeFields";
import { onboardingRoleOptions } from "./onboardingRoles";

const EMAIL_RE = /@/;

const SECTION_META: Record<
  ProfileAttrSection,
  { title: string; blurb: string }
> = {
  personal: {
    title: "Personal attributes",
    blurb: "General profile fields visible on your MetFix member record.",
  },
  affiliate: {
    title: "Affiliate attributes",
    blurb: "Gym / MetFix affiliate listing fields. Separate from personal details.",
  },
  clinic: {
    title: "Clinic attributes",
    blurb: "Medical Society / clinic practice fields. Separate from personal details.",
  },
};

function formatMemberSince(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function mutateErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const body = (err as { body?: unknown }).body;
  if (!body || typeof body !== "object") return fallback;
  const rec = body as { error?: unknown; param?: unknown };
  if (rec.error === "invalid_field") {
    const param = typeof rec.param === "string" ? rec.param : null;
    return param
      ? `Invalid ${param.replace(/_/g, " ")}. Use 1–60 characters with no @.`
      : "Invalid profile field. Names must be 1–60 characters with no @.";
  }
  if (rec.error === "invalid_request") return "Request was rejected. Check the highlighted fields.";
  return fallback;
}

export default function AccountProfile() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [onboardingRoles, setOnboardingRoles] = useState<RoleId[]>([]);
  const [hasPhysicalGym, setHasPhysicalGym] = useState<boolean | null>(null);
  const [hasPhysicalClinic, setHasPhysicalClinic] = useState<boolean | null>(null);
  const writesRef = useRef<Record<ProfileAttrSection, AttributeWrite[]>>({
    personal: [],
    affiliate: [],
    clinic: [],
  });
  const onAttributeChange = useCallback((section: ProfileAttrSection, writes: AttributeWrite[]) => {
    writesRef.current[section] = writes;
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [p, ov] = await Promise.all([
          loadProfile({ signal: ac.signal }),
          loadOverview({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setProfile(p);
        setOverview(ov);
        setFirstName(String(p.first_name ?? ""));
        setLastName(String(p.last_name ?? ""));
        setOnboardingRoles([...(ov.onboarding_roles ?? [])]);
        setHasPhysicalGym(
          typeof ov.has_physical_gym === "boolean" ? ov.has_physical_gym : null,
        );
        setHasPhysicalClinic(
          typeof ov.has_physical_clinic === "boolean" ? ov.has_physical_clinic : null,
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load profile.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  function toggleRole(id: RoleId) {
    setSaved(null);
    setOnboardingRoles((current) => {
      if (current.includes(id)) {
        if (current.length <= 1) return current;
        return current.filter((r) => r !== id);
      }
      return [...current, id];
    });
  }

  async function onSavePersonal(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
      setProfile((prev) => ({ ...(prev ?? {}), ...next }));

      if (onboardingRoles.length >= 1) {
        const rolesBody: {
          onboarding_roles: RoleId[];
          has_physical_gym?: boolean;
          has_physical_clinic?: boolean;
        } = { onboarding_roles: onboardingRoles };
        if (needsConditionalStep(onboardingRoles)) {
          if (onboardingRoles.includes("gym_owner")) {
            rolesBody.has_physical_gym = hasPhysicalGym === true;
          }
          if (onboardingRoles.includes("clinician")) {
            rolesBody.has_physical_clinic = hasPhysicalClinic === true;
          }
        }
        const rolesNext = await updateOnboardingRoles(rolesBody);
        setOnboardingRoles(rolesNext.onboarding_roles);
        setHasPhysicalGym(rolesNext.has_physical_gym);
        setHasPhysicalClinic(rolesNext.has_physical_clinic);
        const refreshed = await loadOverview({ force: true });
        setOverview(refreshed);
      }

      setSaved("Personal profile saved.");
    } catch (err) {
      setError(mutateErrorMessage(err, "Save failed."));
    } finally {
      setBusy(false);
    }
  }

  const sectionFields = useMemo(() => {
    const map: Record<ProfileAttrSection, EditableProfileAttribute[]> = {
      personal: editableProfileAttributesForSection(profile, "personal"),
      affiliate: editableProfileAttributesForSection(profile, "affiliate"),
      clinic: editableProfileAttributesForSection(profile, "clinic"),
    };
    return map;
  }, [profile]);

  async function onSaveSection(section: ProfileAttrSection, e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    const fields = sectionFields[section];
    const writes = writesRef.current[section];
    for (const row of writes) {
      const blob = `${row.value} ${Object.values(row.address ?? {}).join(" ")}`;
      if (EMAIL_RE.test(blob)) {
        setError("Email-like attributes are not allowed.");
        return;
      }
    }
    const original = new Map(fields.map((field) => [field.attr_id, field.value]));
    const changed = writes.filter((row) => {
      if (row.form_type === "address" || row.form_type === "tag") return true;
      return (original.get(row.attr_id) ?? "") !== row.value;
    });

    // Facility flags live with Affiliate / Clinic sections.
    const rolesTouched =
      (section === "affiliate" && onboardingRoles.includes("gym_owner")) ||
      (section === "clinic" && onboardingRoles.includes("clinician"));

    if (changed.length === 0 && !rolesTouched) {
      setSaved(`${SECTION_META[section].title} — nothing to update.`);
      return;
    }
    setBusy(true);
    try {
      if (changed.length > 0) {
        await updateProfileAttributes(
          changed.map((field) => ({
            attr_id: field.attr_id,
            value: field.value,
            section,
            ...(field.address ? { address: field.address } : {}),
          })),
        );
        const refreshedProfile = await loadProfile({ force: true });
        setProfile(refreshedProfile);
      }
      if (rolesTouched && onboardingRoles.length >= 1) {
        const rolesBody: {
          onboarding_roles: RoleId[];
          has_physical_gym?: boolean;
          has_physical_clinic?: boolean;
        } = { onboarding_roles: onboardingRoles };
        if (section === "affiliate" && onboardingRoles.includes("gym_owner")) {
          rolesBody.has_physical_gym = hasPhysicalGym === true;
        }
        if (section === "clinic" && onboardingRoles.includes("clinician")) {
          rolesBody.has_physical_clinic = hasPhysicalClinic === true;
        }
        const rolesNext = await updateOnboardingRoles(rolesBody);
        setOnboardingRoles(rolesNext.onboarding_roles);
        setHasPhysicalGym(rolesNext.has_physical_gym);
        setHasPhysicalClinic(rolesNext.has_physical_clinic);
        setOverview(await loadOverview({ force: true }));
      }
      setSaved(`${SECTION_META[section].title} saved.`);
    } catch (err) {
      setError(mutateErrorMessage(err, "Attribute update failed."));
    } finally {
      setBusy(false);
    }
  }

  async function onPicture(file: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > 5_242_880) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPEG, PNG, or WebP.");
      return;
    }
    setBusy(true);
    try {
      await uploadProfilePicture(file);
      const p = await loadProfile({ force: true });
      setProfile(p);
      const ov = await loadOverview({ force: true });
      setOverview(ov);
      setSaved("Profile picture updated.");
    } catch {
      setError("Picture upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const avatarSrc = overview?.avatar_url || profile?.avatar_url || null;
  const roleOptions = onboardingRoleOptions();
  const email = overview?.email || profile?.email || null;
  const displayName =
    overview?.display_name ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    profile?.display_name ||
    "—";
  const roleLabels = onboardingRoles
    .map((id) => roleOptions.find((r) => r.id === id)?.title ?? id)
    .join(", ");
  const memberSince = formatMemberSince(
    overview?.member_since ?? profile?.member_since ?? null,
  );

  return (
    <DashboardLayout title="Profile" description="Edit your public profile and picture.">
      {error ? <p className="account-error">{error}</p> : null}
      {saved ? (
        <p role="status" className="account-profile-saved">
          {saved}
        </p>
      ) : null}

      <dl className="account-profile-summary">
        <div>
          <dt>Name</dt>
          <dd>{displayName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{email ?? "—"}</dd>
        </div>
        <div>
          <dt>Roles</dt>
          <dd className="account-profile-summary__roles">{roleLabels || "—"}</dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{memberSince}</dd>
        </div>
      </dl>

      <section className="account-card account-profile-card">
        <h2>Profile picture</h2>
        {avatarSrc ? (
          <img
            className="account-avatar"
            src={String(avatarSrc)}
            alt=""
            width={80}
            height={80}
          />
        ) : (
          <p className="account-muted">
            No picture yet — initials show in the dashboard until you upload one.
          </p>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onPicture(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </section>

      <section className="account-card account-profile-card">
        <div className="account-profile-card__head">
          <h2>Edit profile</h2>
        </div>
        <form className="account-form" onSubmit={onSavePersonal}>
          <div className="account-form-row">
            <label>
              First name
              <input
                name="firstName"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => {
                  setSaved(null);
                  setFirstName(e.target.value);
                }}
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => {
                  setSaved(null);
                  setLastName(e.target.value);
                }}
              />
            </label>
          </div>
          <label>
            Email
            <input type="email" value={email ?? ""} readOnly disabled />
          </label>
          <fieldset className="account-role-fieldset">
            <legend>Roles</legend>
            <p className="account-muted">
              Select how you use MetFix so your classes and tools match your path.
            </p>
            <div className="account-role-chips">
              {roleOptions.map((role) => {
                const pressed = onboardingRoles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={pressed}
                    className={
                      pressed
                        ? "account-role-chip account-role-chip--on"
                        : "account-role-chip"
                    }
                    onClick={() => toggleRole(role.id)}
                  >
                    {role.title}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button type="submit" className="account-btn" disabled={busy}>
            Save changes
          </button>
        </form>
      </section>

      {(["personal", "affiliate", "clinic"] as const).map((section) => {
        const fields = sectionFields[section];
        const meta = SECTION_META[section];
        return (
          <section key={section} className="account-card account-profile-card">
            <div className="account-profile-card__head">
              <h2>{meta.title}</h2>
            </div>
            <p className="account-muted">{meta.blurb}</p>
            <form className="account-form" onSubmit={(e) => void onSaveSection(section, e)}>
              {section === "affiliate" && onboardingRoles.includes("gym_owner") ? (
                <label className="account-inline-check">
                  <input
                    type="checkbox"
                    checked={hasPhysicalGym === true}
                    onChange={(e) => {
                      setSaved(null);
                      setHasPhysicalGym(e.target.checked);
                    }}
                  />
                  I have a physical gym / facility
                </label>
              ) : null}
              {section === "clinic" && onboardingRoles.includes("clinician") ? (
                <label className="account-inline-check">
                  <input
                    type="checkbox"
                    checked={hasPhysicalClinic === true}
                    onChange={(e) => {
                      setSaved(null);
                      setHasPhysicalClinic(e.target.checked);
                    }}
                  />
                  I have a physical clinic / practice
                </label>
              ) : null}
              {fields.length === 0 ? (
                <p className="account-muted">No editable {section} fields on this account.</p>
              ) : (
                <AttributeFields
                  fields={fields}
                  idPrefix={section}
                  onChange={(writes) => onAttributeChange(section, writes)}
                />
              )}
              <button type="submit" className="account-btn" disabled={busy}>
                Save {meta.title.toLowerCase()}
              </button>
            </form>
          </section>
        );
      })}
    </DashboardLayout>
  );
}
