import { useEffect, useState, type FormEvent } from "react";
import {
  loadProfile,
  updateProfile,
  updateProfileAttributes,
  uploadProfilePicture,
  type AccountProfile as ProfileDto,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

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
  const [attrId, setAttrId] = useState("1");
  const [attrValue, setAttrValue] = useState("");
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

  async function onAttr(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (EMAIL_RE.test(attrValue) || /email/i.test(attrValue)) {
      setError("Email-like attributes are not allowed.");
      return;
    }
    const id = Number(attrId);
    if (!Number.isInteger(id) || id < 1) {
      setError("Invalid attribute.");
      return;
    }
    setBusy(true);
    try {
      await updateProfileAttributes([{ attr_id: id, value: attrValue }]);
      setAttrValue("");
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
            src={String(profile.avatar_url)}
            alt=""
            width={80}
            height={80}
            style={{ borderRadius: "999px", objectFit: "cover" }}
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
        <form className="account-form" onSubmit={onAttr}>
          <label>
            Attribute ID
            <input value={attrId} onChange={(e) => setAttrId(e.target.value)} />
          </label>
          <label>
            Value
            <input value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
          </label>
          <button type="submit" className="account-btn" disabled={busy}>
            Save attribute
          </button>
        </form>
      </section>
    </DashboardLayout>
  );
}
