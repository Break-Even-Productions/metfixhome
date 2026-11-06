import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  loadOverview,
  loadProfile,
  updateOnboardingRoles,
  updateProfile,
  updateProfileAttributes,
  uploadProfilePicture,
  type AccountOverview,
  type AccountProfile as ProfileDto,
  type RoleId,
} from "@/lib/account";
import { needsConditionalStep } from "@shared/join/membership-domain";
import DashboardLayout from "./DashboardLayout";
import { editableProfileAttributes } from "./profileAttributes";
import { onboardingRoleOptions } from "./onboardingRoles";

const EMAIL_RE = /@/;

export default function AccountProfile() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [credentials, setCredentials] = useState("");
  const [communityOptIn, setCommunityOptIn] = useState(false);
  const [onboardingRoles, setOnboardingRoles] = useState<RoleId[]>([]);
  const [hasPhysicalGym, setHasPhysicalGym] = useState<boolean | null>(null);
  const [hasPhysicalClinic, setHasPhysicalClinic] = useState<boolean | null>(null);
  const [attrValues, setAttrValues] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
        setDisplayName(String(p.display_name ?? ""));
        setBio(String(p.bio ?? ""));
        setLocation(String(p.location ?? ""));
        setCredentials(String(p.credentials ?? ""));
        setCommunityOptIn(p.community_opt_in === true);
        setOnboardingRoles([...(ov.onboarding_roles ?? [])]);
        setHasPhysicalGym(
          typeof ov.has_physical_gym === "boolean" ? ov.has_physical_gym : null,
        );
        setHasPhysicalClinic(
          typeof ov.has_physical_clinic === "boolean" ? ov.has_physical_clinic : null,
        );
        const fields = editableProfileAttributes(p);
        setAttrValues(Object.fromEntries(fields.map((field) => [field.attr_id, field.value])));
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
    setSaved(false);
    setOnboardingRoles((current) => {
      if (current.includes(id)) {
        if (current.length <= 1) return current;
        return current.filter((r) => r !== id);
      }
      return [...current, id];
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        bio,
        location,
        credentials,
        community_opt_in: communityOptIn,
      });
      setProfile(next);

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

      setSaved(true);
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const attributeFields = useMemo(
    () => (profile ? editableProfileAttributes(profile) : []),
    [profile],
  );

  async function onAttr(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    for (const field of attributeFields) {
      const value = attrValues[field.attr_id] ?? "";
      if (EMAIL_RE.test(value) || /email/i.test(value)) {
        setError("Email-like attributes are not allowed.");
        return;
      }
    }
    const changed = attributeFields.filter(
      (field) => (attrValues[field.attr_id] ?? "") !== field.value,
    );
    if (changed.length === 0) {
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      await updateProfileAttributes(
        changed.map((field) => ({
          attr_id: field.attr_id,
          value: attrValues[field.attr_id] ?? "",
        })),
      );
      setSaved(true);
    } catch {
      setError("Attribute update failed.");
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
      setSaved(true);
    } catch {
      setError("Picture upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const avatarSrc = overview?.avatar_url || profile?.avatar_url || null;
  const roleOptions = onboardingRoleOptions();

  return (
    <DashboardLayout title="Profile" description="Edit your public profile and picture.">
      {error ? <p className="account-error">{error}</p> : null}
      {saved ? <p role="status">Saved.</p> : null}

      <section className="account-card">
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
          <p className="account-muted">No picture yet — initials show in the dashboard until you upload one.</p>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onPicture(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </section>

      <section className="account-card">
        <h2>Details</h2>
        <form className="account-form" onSubmit={onSave}>
          <label>
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label>
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label>
            Credentials
            <input value={credentials} onChange={(e) => setCredentials(e.target.value)} />
          </label>
          <fieldset className="account-role-fieldset">
            <legend>How you use MetFix</legend>
            <p className="account-muted">
              Opt-in audience attributes for classes and tools. These are not membership
              entitlements, Whop products, or affiliate CRM roles.
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
            {onboardingRoles.includes("gym_owner") ? (
              <label className="account-inline-check">
                <input
                  type="checkbox"
                  checked={hasPhysicalGym === true}
                  onChange={(e) => setHasPhysicalGym(e.target.checked)}
                />
                I have a physical gym / facility
              </label>
            ) : null}
            {onboardingRoles.includes("clinician") ? (
              <label className="account-inline-check">
                <input
                  type="checkbox"
                  checked={hasPhysicalClinic === true}
                  onChange={(e) => setHasPhysicalClinic(e.target.checked)}
                />
                I have a physical clinic / practice
              </label>
            ) : null}
          </fieldset>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={communityOptIn}
              onChange={(e) => setCommunityOptIn(e.target.checked)}
            />
            Community opt-in
          </label>
          <button type="submit" className="account-btn" disabled={busy}>
            Save profile
          </button>
        </form>
      </section>

      <section className="account-card">
        <h2>Attributes</h2>
        {attributeFields.length === 0 ? (
          <p className="account-muted">No editable profile fields on this account.</p>
        ) : (
          <form className="account-form" onSubmit={onAttr}>
            {attributeFields.map((field) => (
              <label key={field.attr_id}>
                {field.label}
                <input
                  value={attrValues[field.attr_id] ?? ""}
                  onChange={(e) =>
                    setAttrValues((current) => ({ ...current, [field.attr_id]: e.target.value }))
                  }
                />
              </label>
            ))}
            <button type="submit" className="account-btn" disabled={busy}>
              Save attribute
            </button>
          </form>
        )}
      </section>
    </DashboardLayout>
  );
}
