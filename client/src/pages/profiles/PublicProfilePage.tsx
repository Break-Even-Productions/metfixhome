import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import NotFound from "@/pages/NotFound";
import "./profile-skin.css";

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;

const ELIGIBILITY_LABEL: Record<string, string> = {
  foundations_coach: "Foundations Coach",
  primary_owner: "Primary Owner",
  metfix_pro: "MetFix Pro",
};

type Social = { name: string; url: string };
type Person = {
  member_id: number;
  name: string;
  profile_url: string;
  profile_picture_url: string | null;
};
type Service = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  note: string | null;
};
type Team = { owners: Person[]; delegates?: Person[]; coaches?: Person[] };

export type PublicProfile =
  | {
      profile_kind: "metfix";
      member_id: number;
      display_name: string;
      secondary: string | null;
      bio: string | null;
      location: string | null;
      website: string | null;
      contact_email: string | null;
      profile_picture_url: string | null;
      tags: string[];
      socials: Social[];
      eligibility: string[];
      profile_url: string;
    }
  | {
      profile_kind: "affiliate" | "clinic";
      id: number;
      name: string;
      slug: string;
      bio: string | null;
      location: string | null;
      website: string | null;
      logo_url: string | null;
      video_url: string | null;
      tags: string[];
      socials: Social[];
      is_first_100: boolean;
      is_international: boolean;
      team: Team;
      url: string;
      services?: Service[];
    };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: PublicProfile }
  | { status: "not_found" }
  | { status: "error" };

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function kicker(profile: PublicProfile): string {
  if (profile.profile_kind === "clinic") return "Clinic";
  if (profile.profile_kind === "affiliate") return "Affiliate";
  return "MetFix Profile";
}

function titleOf(profile: PublicProfile): string {
  return profile.profile_kind === "metfix" ? profile.display_name : profile.name;
}

function portraitOf(profile: PublicProfile): string | null {
  return profile.profile_kind === "metfix" ? profile.profile_picture_url : profile.logo_url;
}

function linksPath(profile: PublicProfile): string {
  return `${profile.profile_kind === "metfix" ? profile.profile_url : profile.url}/links`;
}

export default function PublicProfilePage() {
  const [metfixMatch, metfixParams] = useRoute("/metfix-profile/:memberId");
  const [affMatch, affParams] = useRoute("/affiliates/:id/:slug");
  const [affBareMatch, affBareParams] = useRoute("/affiliates/:id");
  const [clinicMatch, clinicParams] = useRoute("/clinics/:id/:slug");
  const [clinicBareMatch, clinicBareParams] = useRoute("/clinics/:id");
  const [, navigate] = useLocation();

  let kind: "metfix" | "affiliate" | "clinic" = "metfix";
  let id = "";
  let slug = "";
  if (metfixMatch) {
    kind = "metfix";
    id = metfixParams?.memberId ?? "";
  } else if (affMatch) {
    kind = "affiliate";
    id = affParams?.id ?? "";
    slug = affParams?.slug ?? "";
  } else if (clinicMatch) {
    kind = "clinic";
    id = clinicParams?.id ?? "";
    slug = clinicParams?.slug ?? "";
  } else if (affBareMatch) {
    kind = "affiliate";
    id = affBareParams?.id ?? "";
  } else if (clinicBareMatch) {
    kind = "clinic";
    id = clinicBareParams?.id ?? "";
  }

  const valid = POSITIVE_INT.test(id);
  const [state, setState] = useState<LoadState>(valid ? { status: "loading" } : { status: "not_found" });

  const ready = state.status === "ready" ? state.profile : null;
  usePageMeta({
    title: ready ? `${titleOf(ready)} — MetFix` : "Profile — MetFix",
    description:
      ready?.profile_kind === "clinic"
        ? "MetFix clinic profile."
        : ready?.profile_kind === "affiliate"
          ? "MetFix affiliate profile."
          : "MetFix profile.",
  });

  useEffect(() => {
    if (!valid) return;
    const ac = new AbortController();
    let cancelled = false;
    const path =
      kind === "metfix" ? `/api/profiles/metfix/${id}` : `/api/profiles/${kind === "clinic" ? "clinics" : "affiliates"}/${id}`;
    (async () => {
      try {
        const res = await fetch(path, { signal: ac.signal, headers: { Accept: "application/json" } });
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) {
          setState({ status: "not_found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const profile = (await res.json()) as PublicProfile;
        if (profile.profile_kind !== kind) {
          setState({ status: "not_found" });
          return;
        }
        setState({ status: "ready", profile });
        if (profile.profile_kind !== "metfix" && profile.slug && profile.slug !== slug) {
          navigate(profile.url, { replace: true });
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [id, kind, navigate, slug, valid]);

  if (!valid || state.status === "not_found") return <NotFound />;

  return (
    <div className="profile-skin" data-kind={kind}>
      <div className="profile-skin__wrap">
        {state.status === "loading" ? <p className="profile-skin__muted profile-skin__status">Loading…</p> : null}
        {state.status === "error" ? (
          <p className="profile-skin__muted profile-skin__status">Unable to load this profile.</p>
        ) : null}
        {ready ? <ProfileBody profile={ready} /> : null}
      </div>
    </div>
  );
}

function ProfileBody({ profile }: { profile: PublicProfile }) {
  const name = titleOf(profile);
  const photo = portraitOf(profile);
  const location = profile.location;
  const pills =
    profile.profile_kind === "metfix"
      ? profile.eligibility.map((key) => ELIGIBILITY_LABEL[key] ?? key)
      : [
          ...(profile.is_first_100 ? ["First 100"] : []),
          ...(profile.is_international ? ["International"] : []),
          ...profile.tags,
        ];
  const secondary = profile.profile_kind === "metfix" ? profile.secondary : null;

  return (
    <>
      <header className="profile-skin__hero">
        <div className="profile-skin__portrait">
          {photo ? <img src={photo} alt="" /> : <span className="profile-skin__mark">{initials(name)}</span>}
        </div>
        <div className="profile-skin__intro">
          <p className="profile-skin__kicker">{kicker(profile)}</p>
          <h1>{name}</h1>
          {secondary ? <p className="profile-skin__secondary">{secondary}</p> : null}
          {location ? <p className="profile-skin__secondary">{location}</p> : null}
          {pills.length > 0 ? (
            <ul className="profile-skin__pills">
              {pills.map((pill) => (
                <li key={pill}>{pill}</li>
              ))}
            </ul>
          ) : null}
          <ul className="profile-skin__links">
            {profile.website ? (
              <li>
                <a href={profile.website} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              </li>
            ) : null}
            {profile.profile_kind === "metfix" &&
            profile.contact_email &&
            /^[^\s@]+@[^\s@]+$/.test(profile.contact_email) ? (
              <li>
                <a href={`mailto:${profile.contact_email}`}>Email</a>
              </li>
            ) : null}
            {profile.profile_kind !== "metfix" && profile.video_url ? (
              <li>
                <a href={profile.video_url} target="_blank" rel="noopener noreferrer">
                  Watch
                </a>
              </li>
            ) : null}
            {profile.socials.map((social) => (
              <li key={social.url}>
                <a href={social.url} target="_blank" rel="noopener noreferrer">
                  {social.name}
                </a>
              </li>
            ))}
            <li>
              <Link href={linksPath(profile)}>Link in bio</Link>
            </li>
          </ul>
        </div>
      </header>

      <section className="profile-skin__card" aria-labelledby="profile-about">
        <h2 id="profile-about">About</h2>
        {profile.bio ? <p className="profile-skin__bio">{profile.bio}</p> : <p className="profile-skin__empty">No public bio yet.</p>}
      </section>

      {profile.profile_kind === "clinic" ? (
        <section className="profile-skin__card" aria-labelledby="profile-services">
          <h2 id="profile-services">Services</h2>
          {(profile.services ?? []).length === 0 ? (
            <p className="profile-skin__empty" data-empty="true">
              No services listed yet.
            </p>
          ) : (
            <div className="profile-skin__services">
              {(profile.services ?? []).map((service) => (
                <article key={service.slug} className="profile-skin__service">
                  <h3>{service.name}</h3>
                  {service.summary ? <p>{service.summary}</p> : null}
                  {service.note ? <p className="profile-skin__note">{service.note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {profile.profile_kind !== "metfix" ? <TeamBlock team={profile.team} /> : null}
    </>
  );
}

function TeamBlock({ team }: { team: Team }) {
  const groups: { label: string; people: Person[] }[] = [
    { label: "Owners", people: team.owners },
    { label: "Delegates", people: team.delegates ?? [] },
    { label: "Coaches", people: team.coaches ?? [] },
  ].filter((group) => group.people.length > 0);
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map((group) => (
        <section key={group.label} className="profile-skin__card" aria-labelledby={`team-${group.label}`}>
          <h2 id={`team-${group.label}`}>{group.label}</h2>
          <ul className="profile-skin__people">
            {group.people.map((person) => (
              <li key={person.member_id} className="profile-skin__person">
                {person.profile_picture_url ? (
                  <img src={person.profile_picture_url} alt="" />
                ) : (
                  <span aria-hidden="true">{initials(person.name)}</span>
                )}
                <Link href={person.profile_url}>{person.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
