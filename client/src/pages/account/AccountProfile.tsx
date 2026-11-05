import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  loadProfile,
  updateProfile,
  updateProfileAttributes,
  uploadProfilePicture,
  type AccountProfile as ProfileDto,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { editableProfileAttributes } from "./profileAttributes";

const EMAIL_RE = /@/;

export default function AccountProfile() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [credentials, setCredentials] = useState("");
  const [communityOptIn, setCommunityOptIn] = useState(false);
  const [attrValues, setAttrValues] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const p = await loadProfile({ signal: ac.signal });
        if (cancelled) return;
        setProfile(p);
        setFirstName(String(p.first_name ?? ""));
        setLastName(String(p.last_name ?? ""));
        setDisplayName(String(p.display_name ?? ""));
        setBio(String(p.bio ?? ""));
        setLocation(String(p.location ?? ""));
        setCredentials(String(p.credentials ?? ""));
        setCommunityOptIn(p.community_opt_in === true);
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
      setSaved(true);
    } catch {
      setError("Picture upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout title="Profile" description="Edit your public profile and picture.">
      {error ? <p className="account-error">{error}</p> : null}
      {saved ? <p role="status">Saved.</p> : null}

      <section className="account-card">
        <h2>Profile picture</h2>
        {profile?.avatar_url ? (
          <img
            className="account-avatar"
            src={String(profile.avatar_url)}
            alt=""
            width={80}
            height={80}
          />
        ) : null}
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
