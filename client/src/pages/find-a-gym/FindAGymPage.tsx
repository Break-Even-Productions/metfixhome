import { LocateFixed, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { DirectoryListing, DirectoryListResponse } from "@shared/directory/types";
import { communityOptions, filterDirectory, type KindFilter, type MapBounds } from "./filter";
import { DETAIL_ZOOM, GymMap, type GymMapHandle } from "./GymMap";
import { ListingCard } from "./ListingCard";
import "./find-a-gym.css";

type CoachAccess = "loading" | "ok" | "signed_out" | "forbidden" | "error";

function sameBounds(a: MapBounds | null, b: MapBounds): boolean {
  if (!a) return false;
  return (
    Math.abs(a.north - b.north) < 1e-4 &&
    Math.abs(a.south - b.south) < 1e-4 &&
    Math.abs(a.east - b.east) < 1e-4 &&
    Math.abs(a.west - b.west) < 1e-4
  );
}

async function loadDirectory(path: string): Promise<DirectoryListResponse> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    const error = new Error("directory_failed") as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as DirectoryListResponse;
}

function chipClass(active: boolean): string {
  return `rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300 ease-out ${
    active ? "bg-ink text-cream" : "border border-line bg-cream text-ink/80 hover:text-ink"
  }`;
}

export default function FindAGymPage() {
  const searchId = useId();
  const locationId = useId();
  const mapRef = useRef<GymMapHandle | null>(null);
  const [gyms, setGyms] = useState<DirectoryListing[]>([]);
  const [doctors, setDoctors] = useState<DirectoryListing[]>([]);
  const [coaches, setCoaches] = useState<DirectoryListing[]>([]);
  const [doctorsEnabled, setDoctorsEnabled] = useState(false);
  const [coachAccess, setCoachAccess] = useState<CoachAccess>("loading");
  const [gymError, setGymError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [communities, setCommunities] = useState<string[]>([]);
  const [place, setPlace] = useState("");
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = "Find a Gym · MetFix";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled([
      loadDirectory("/api/directory/gyms"),
      loadDirectory("/api/directory/clinics"),
      loadDirectory("/api/directory/coaches"),
    ]).then(([gymResult, clinicResult, coachResult]) => {
      if (cancelled) return;
      if (gymResult.status === "fulfilled") {
        setGyms(gymResult.value.listings ?? []);
        setGymError(false);
      } else {
        setGymError(true);
      }
      if (clinicResult.status === "fulfilled") {
        setDoctors(clinicResult.value.listings ?? []);
        setDoctorsEnabled(clinicResult.value.find_a_doctor_enabled === true);
      }
      if (coachResult.status === "fulfilled") {
        setCoaches(coachResult.value.listings ?? []);
        setCoachAccess("ok");
      } else {
        const status = (coachResult.reason as { status?: number } | undefined)?.status;
        setCoachAccess(status === 401 ? "signed_out" : status === 403 ? "forbidden" : "error");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const source = useMemo(() => {
    const rows = [...gyms];
    if (doctorsEnabled) rows.push(...doctors);
    if (coachAccess === "ok") rows.push(...coaches);
    return rows;
  }, [gyms, doctors, doctorsEnabled, coaches, coachAccess]);

  const pins = useMemo(
    () =>
      filterDirectory(source, {
        text,
        kind,
        communities,
        bounds: null,
      }),
    [source, text, kind, communities],
  );

  const visible = useMemo(
    () => filterDirectory(pins, { text: "", kind: "all", communities: [], bounds }),
    [pins, bounds],
  );

  const worksWith = useMemo(() => communityOptions(source).slice(0, 24), [source]);

  const counts = useMemo(() => {
    const base = filterDirectory(source, { text, kind: "all", communities, bounds: null });
    return {
      all: base.length,
      gym: base.filter((item) => item.kind === "gym").length,
      coach: base.filter((item) => item.kind === "coach").length,
      doctor: base.filter((item) => item.kind === "doctor").length,
    };
  }, [source, text, communities]);

  const showDoctorsType = doctorsEnabled && counts.doctor > 0;
  const showCoachesType = coachAccess === "ok" && counts.coach > 0;
  const showTypeRow = showDoctorsType || showCoachesType;

  useEffect(() => {
    if (kind === "coach" && !showCoachesType) setKind("all");
    if (kind === "doctor" && !showDoctorsType) setKind("all");
  }, [kind, showCoachesType, showDoctorsType]);

  const onBounds = useCallback((next: MapBounds) => {
    setBounds((current) => (sameBounds(current, next) ? current : next));
  }, []);

  const onReady = useCallback((handle: GymMapHandle) => {
    mapRef.current = handle;
  }, []);

  const selectListing = useCallback(
    (id: string) => {
      setSelectedId(id);
      const listing = source.find((item) => item.id === id);
      const map = mapRef.current;
      if (!listing || !map) return;
      // OpenFreeMap tiles top out at z14 (street detail). Past that the provider returns empty tiles.
      map.flyTo(listing.lat, listing.lng, Math.max(map.getZoom(), DETAIL_ZOOM));
      document.getElementById(`listing-${id}`)?.scrollIntoView({ block: "nearest" });
    },
    [source],
  );

  const focusMap = useCallback((lat: number, lng: number, zoom: number) => {
    const map = mapRef.current;
    if (!map) {
      setPlaceError("Map is still loading.");
      return;
    }
    map.flyTo(lat, lng, zoom);
    setPlaceError(null);
  }, []);

  const searchPlace = async (event: FormEvent) => {
    event.preventDefault();
    const query = place.trim();
    if (!query) return;
    try {
      const res = await fetch(`/api/directory/geocode?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setPlaceError("Map search is unavailable.");
        return;
      }
      const body = (await res.json()) as {
        found?: boolean;
        lat?: number;
        lng?: number;
        label?: string;
      };
      if (!body.found || typeof body.lat !== "number" || typeof body.lng !== "number") {
        setPlaceError("No match for that city or ZIP.");
        return;
      }
      if (typeof body.label === "string" && body.label) setPlace(body.label);
      focusMap(body.lat, body.lng, 12);
    } catch {
      setPlaceError("Map search is unavailable.");
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setPlaceError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setPlace("Current location");
        focusMap(position.coords.latitude, position.coords.longitude, DETAIL_ZOOM);
      },
      () => {
        setLocating(false);
        setPlaceError("Could not use your location.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const toggleCommunity = (label: string) => {
    setCommunities((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  };

  return (
    <main className="find-gym">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-6">
        <h1 className="font-serif text-4xl text-ink md:text-5xl">Find a Gym</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Search MetFix gyms, coaches, and doctors by who they work with. Move the map to keep the
          list to the pins you can see.
        </p>

        <section className="mt-6 rounded-[1.75rem] border border-line bg-white p-4 shadow-[0_16px_40px_rgba(23,21,18,0.04)] md:p-6">
          <form onSubmit={(event) => event.preventDefault()}>
            <label htmlFor={searchId} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Search
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2.5">
              <Search className="h-4 w-4 text-muted" aria-hidden="true" />
              <input
                id={searchId}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Search by name, city, or who they work with"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
          </form>

          <form className="mt-4" onSubmit={(event) => void searchPlace(event)}>
            <label htmlFor={locationId} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Location
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-cream px-4 py-2.5">
                <MapPin className="h-4 w-4 text-muted" aria-hidden="true" />
                <input
                  id={locationId}
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                  placeholder="City or ZIP"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream"
              >
                Go
              </button>
              <button
                type="button"
                onClick={useMyLocation}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink"
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {locating ? "Locating…" : "Use my location"}
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {placeError ?? "Zoom and pan the map. The list follows the pins in view."}
            </p>
          </form>

          {showTypeRow ? (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={chipClass(kind === "all")} onClick={() => setKind("all")}>
                  All {counts.all}
                </button>
                <button type="button" className={chipClass(kind === "gym")} onClick={() => setKind("gym")}>
                  Gyms {counts.gym}
                </button>
                {showDoctorsType ? (
                  <button
                    type="button"
                    className={chipClass(kind === "doctor")}
                    onClick={() => setKind("doctor")}
                  >
                    Doctors {counts.doctor}
                  </button>
                ) : null}
                {showCoachesType ? (
                  <button type="button" className={chipClass(kind === "coach")} onClick={() => setKind("coach")}>
                    Coaches {counts.coach}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {worksWith.length > 0 ? (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Works with</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {worksWith.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={chipClass(communities.includes(label))}
                    onClick={() => toggleCommunity(label)}
                    aria-pressed={communities.includes(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <GymMap
            listings={pins}
            selectedId={selectedId}
            onSelect={selectListing}
            onBounds={onBounds}
            onReady={onReady}
          />
          <section aria-label="Results" className="min-w-0" aria-busy={loading}>
            {loading ? (
              <p className="gym-results-skel" aria-hidden="true">
                <span className="gym-card-skel__line gym-card-skel__line--short" />
              </p>
            ) : (
              <p className="text-sm text-muted">
                {`${visible.length} ${visible.length === 1 ? "result" : "results"} in view`}
              </p>
            )}
            {gymError ? (
              <p className="mt-3 text-sm text-danger-text">Couldn’t load gyms. Try again later.</p>
            ) : null}
            <div className="find-gym__results mt-3">
              {loading ? (
                <div className="gym-card-skel-list" role="status" aria-label="Loading gyms">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="gym-card gym-card-skel" aria-hidden="true">
                      <div className="gym-card-skel__main">
                        <span className="gym-card-skel__logo" />
                        <span className="gym-card-skel__meta">
                          <span className="gym-card-skel__chip" />
                          <span className="gym-card-skel__title" />
                          <span className="gym-card-skel__line" />
                          <span className="gym-card-skel__line gym-card-skel__line--short" />
                        </span>
                      </div>
                      <span className="gym-card-skel__line" />
                      <span className="gym-card-skel__line gym-card-skel__line--short" />
                    </div>
                  ))}
                </div>
              ) : null}
              {!loading
                ? visible.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      selected={listing.id === selectedId}
                      activeCommunities={communities}
                      onSelect={selectListing}
                    />
                  ))
                : null}
              {!loading && visible.length === 0 ? (
                <p className="rounded-[1.5rem] border border-line bg-white p-5 text-sm text-muted">
                  Nothing in this view. Zoom out or clear a filter.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
