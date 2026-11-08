import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import NotFound from "@/pages/NotFound";
import LogoMorph from "./LogoMorph";
import type { PublicProfile } from "./PublicProfilePage";
import "./profile-skin.css";

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: PublicProfile }
  | { status: "not_found" }
  | { status: "error" };

type OutLink = { key: string; label: string; href: string; external: boolean };

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function titleOf(profile: PublicProfile): string {
  return profile.profile_kind === "metfix" ? profile.display_name : profile.name;
}

function portraitOf(profile: PublicProfile): string | null {
  return profile.profile_kind === "metfix" ? profile.profile_picture_url : profile.logo_url;
}

function kicker(profile: PublicProfile): string {
  if (profile.profile_kind === "clinic") return "Clinic";
  if (profile.profile_kind === "affiliate") return "Affiliate";
  return "MetFix";
}

function profilePath(profile: PublicProfile): string {
  return profile.profile_kind === "metfix" ? profile.profile_url : profile.url;
}

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function outLinks(profile: PublicProfile): OutLink[] {
  const links: OutLink[] = [];
  const website = httpUrl(profile.website);
  if (website) links.push({ key: "website", label: "Website", href: website, external: true });
  if (profile.profile_kind === "metfix" && profile.contact_email && EMAIL.test(profile.contact_email)) {
    links.push({ key: "email", label: "Email", href: `mailto:${profile.contact_email}`, external: true });
  }
  if (profile.profile_kind !== "metfix") {
    const video = httpUrl(profile.video_url);
    if (video) links.push({ key: "video", label: "Watch", href: video, external: true });
  }
  for (const social of profile.socials) {
    const href = httpUrl(social.url);
    if (href) links.push({ key: href, label: social.name || "Link", href, external: true });
  }
  if (profile.profile_kind !== "metfix") {
    const people = [
      ...profile.team.owners.map((person) => ({ role: "owner", person })),
      ...(profile.team.coaches ?? []).map((person) => ({ role: "coach", person })),
    ];
    for (const { role, person } of people) {
      if (!person.profile_url || !person.name) continue;
      links.push({
        key: `${role}-${person.member_id}`,
        label: person.name,
        href: person.profile_url,
        external: false,
      });
    }
  }
  return links;
}

export default function LinkInBioPage() {
  const [metfixMatch, metfixParams] = useRoute("/metfix-profile/:memberId/links");
  const [affMatch, affParams] = useRoute("/affiliates/:id/:slug/links");
  const [affBareMatch, affBareParams] = useRoute("/affiliates/:id/links");
  const [clinicMatch, clinicParams] = useRoute("/clinics/:id/:slug/links");
  const [clinicBareMatch, clinicBareParams] = useRoute("/clinics/:id/links");
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
  const name = ready ? titleOf(ready) : "";
  usePageMeta({
    title: ready ? `${name} — MetFix` : "Links — MetFix",
    description: ready?.bio?.slice(0, 180) || (ready ? `${name} on MetFix.` : "MetFix link in bio."),
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
          navigate(`${profile.url}/links`, { replace: true });
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

  const services = ready?.profile_kind === "clinic" ? (ready.services ?? []) : [];

  return (
    <main className="link-bio" data-kind={kind}>
      <div className="link-bio__sheet">
        {state.status === "loading" ? <p className="link-bio__status">Loading…</p> : null}
        {state.status === "error" ? <p className="link-bio__status">Unable to load this profile.</p> : null}
        {ready ? (
          <>
            <header className="link-bio__head">
              <div className="link-bio__portrait">
                {portraitOf(ready) ? (
                  <img src={portraitOf(ready) ?? ""} alt="" />
                ) : (
                  <span className="link-bio__mark">{initials(name)}</span>
                )}
              </div>
              <p className="link-bio__kicker">{kicker(ready)}</p>
              <h1>{name}</h1>
              {ready.location ? <p className="link-bio__location">{ready.location}</p> : null}
              {ready.bio ? <p className="link-bio__bio">{ready.bio}</p> : null}
            </header>
            {services.length > 0 ? (
              <ul className="link-bio__services">
                {services.map((service) => (
                  <li key={service.slug}>
                    <strong>{service.name}</strong>
                    {service.note ? <span>{service.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <nav className="link-bio__nav" aria-label="Links">
              <Link className="link-bio__btn link-bio__btn--primary" href={profilePath(ready)}>
                Full profile
              </Link>
              {outLinks(ready).map((item) =>
                item.external ? (
                  <a key={item.key} className="link-bio__btn" href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.key} className="link-bio__btn" href={item.href}>
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          </>
        ) : null}
      </div>
      <footer className="link-bio__foot">
        <LogoMorph />
      </footer>
    </main>
  );
}
