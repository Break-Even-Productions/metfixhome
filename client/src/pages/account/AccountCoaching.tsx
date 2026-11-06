import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  cancelProgrammingSubscription,
  coachingRelationshipAction,
  createCoachNote,
  deriveMembershipStatus,
  loadCoachDirectory,
  loadCoachNotes,
  loadCoachProfile,
  loadCoachingClient,
  loadCoachingCoach,
  loadOverview,
  loadCoachingPlanLibrary,
  loadProgrammingDays,
  loadProgrammingSeries,
  loadProgrammingSubscriptions,
  loadSubscriptions,
  requestCoach,
  saveCoachProfile,
  subscribeProgrammingSeries,
  type AccountOverview,
  type AccountSubscriptions,
  type CoachDirectoryEntry,
  type CoachNote,
  type CoachProfile,
  type CoachingAffiliate,
  type CoachingClientOverview,
  type CoachingCoachOverview,
  type CoachingRelationship,
  type PlanLibraryItem,
  type ProgrammingDayItem,
  type ProgrammingSeriesItem,
  type ProgrammingSubscriptionItem,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { addDays, formatDayLabel, formatStamp, todayYmd } from "./bodyDates";

type Tab = "coach" | "clients" | "programming" | "find";

function personName(row: CoachingRelationship): string {
  return row.counterparty.display_name || row.counterparty.name || "Member";
}

function canAccept(row: CoachingRelationship): boolean {
  if (row.status !== "pending") return false;
  if (row.viewer_is_coach) return row.invited_by === "client";
  return row.invited_by === "coach";
}

function mutateMessage(err: unknown, fallback: string): string {
  const body = (err as { body?: { error?: string } })?.body;
  if (body?.error === "payment_required") {
    return "This series is paid. Subscribe from the MetFix app.";
  }
  return fallback;
}

function RelationshipList({
  rows,
  empty,
  onChange,
  onSelect,
  selectedId,
}: {
  rows: CoachingRelationship[];
  empty: string;
  onChange: () => void;
  onSelect: (row: CoachingRelationship) => void;
  selectedId: number | null;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(row: CoachingRelationship, action: "accept" | "decline" | "end") {
    if (action === "end" && !window.confirm("End this coaching relationship?")) return;
    setBusy(row.id);
    setMessage(null);
    try {
      await coachingRelationshipAction(row.id, action);
      onChange();
    } catch (err) {
      setMessage(mutateMessage(err, "Could not update that relationship."));
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return <p className="account-muted">{empty}</p>;

  return (
    <ul className="dash-coach-list">
      {rows.map((row) => (
        <li key={row.id} className={selectedId === row.id ? "dash-coach-list__on" : ""}>
          <button type="button" className="dash-feed-row" onClick={() => onSelect(row)}>
            <span className="dash-feed-row__title">{personName(row)}</span>
            <span className="dash-feed-row__meta">
              {row.status === "pending" ? "Pending approval" : row.status}
              {row.viewer_is_coach ? " · Client" : " · Coach"}
            </span>
          </button>
          <div className="dash-coach-list__actions">
            {canAccept(row) ? (
              <button type="button" className="account-btn" disabled={busy === row.id} onClick={() => act(row, "accept")}>
                Accept
              </button>
            ) : null}
            {row.status === "pending" ? (
              <button
                type="button"
                className="account-btn account-btn--ghost"
                disabled={busy === row.id}
                onClick={() => act(row, "decline")}
              >
                Decline
              </button>
            ) : null}
            {row.status === "active" ? (
              <button
                type="button"
                className="account-btn account-btn--ghost"
                disabled={busy === row.id}
                onClick={() => act(row, "end")}
              >
                {row.viewer_is_coach ? "End relationship" : "End coaching"}
              </button>
            ) : null}
          </div>
        </li>
      ))}
      {message ? <li className="account-error">{message}</li> : null}
    </ul>
  );
}

function GymList({ rows, empty }: { rows: CoachingAffiliate[]; empty: string }) {
  if (rows.length === 0) return <p className="account-muted">{empty}</p>;
  return (
    <ul className="dash-coach-list">
      {rows.map((row) => (
        <li key={row.affiliate_id}>
          <p className="dash-feed-row__title">{row.name}</p>
          <p className="dash-feed-row__meta">
            {row.member_count != null ? `${row.member_count} members · ` : ""}
            Team chat stays in the MetFix app.
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function AccountCoaching() {
  const today = useMemo(() => todayYmd(), []);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [gate, setGate] = useState<"loading" | "locked" | "open" | "error">("loading");
  const [tab, setTab] = useState<Tab>("coach");
  const [clientHub, setClientHub] = useState<CoachingClientOverview | null>(null);
  const [coachHub, setCoachHub] = useState<CoachingCoachOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<CoachingRelationship | null>(null);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [series, setSeries] = useState<ProgrammingSeriesItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<ProgrammingSubscriptionItem[]>([]);
  const [plans, setPlans] = useState<PlanLibraryItem[]>([]);
  const [progLoading, setProgLoading] = useState(false);
  const [progError, setProgError] = useState<string | null>(null);
  const [days, setDays] = useState<ProgrammingDayItem[]>([]);
  const [daysFor, setDaysFor] = useState<number | null>(null);
  const [daysLoading, setDaysLoading] = useState(false);
  const [directory, setDirectory] = useState<CoachDirectoryEntry[]>([]);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        const tier = su?.canonical_tier ?? ov?.canonical_tier ?? "free";
        setGate(metfixToolsUnlocked(tier) ? "open" : "locked");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load coaching.");
        setGate("error");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (gate !== "open") return;
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [asClient, asCoach, coachProfile] = await Promise.all([
          loadCoachingClient({ signal: ac.signal, force: reload > 0 }),
          loadCoachingCoach({ signal: ac.signal, force: reload > 0 }),
          loadCoachProfile({ signal: ac.signal, force: reload > 0 }).catch(() => null),
        ]);
        if (cancelled) return;
        setClientHub(asClient);
        setCoachHub(asCoach);
        setProfile(coachProfile);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setClientHub(null);
        setCoachHub(null);
        setError("Unable to load coaching.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gate, reload]);

  useEffect(() => {
    if (gate !== "open" || tab !== "programming") return;
    const ac = new AbortController();
    let cancelled = false;
    setProgLoading(true);
    setProgError(null);
    (async () => {
      try {
        const [subsPage, seriesPage, planPage] = await Promise.all([
          loadProgrammingSubscriptions({ signal: ac.signal, force: reload > 0 }),
          loadProgrammingSeries({ signal: ac.signal, force: reload > 0 }),
          loadCoachingPlanLibrary({ signal: ac.signal, force: reload > 0 }),
        ]);
        if (cancelled) return;
        setSubscriptions(subsPage.subscriptions ?? []);
        setSeries(seriesPage.series ?? []);
        setPlans([...(planPage.active ?? []), ...(planPage.inactive ?? [])]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setProgError("Unable to load programming.");
      } finally {
        if (!cancelled) setProgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gate, tab, reload]);

  useEffect(() => {
    if (gate !== "open" || tab !== "find") return;
    const ac = new AbortController();
    let cancelled = false;
    setFindLoading(true);
    setFindError(null);
    (async () => {
      try {
        const page = await loadCoachDirectory(
          {
            name: query.trim(),
            sort_by: "completed_courses",
            sort_order: "desc",
          },
          { signal: ac.signal },
        );
        if (!cancelled) setDirectory(page.trainers ?? []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDirectory([]);
        setFindError("Unable to load the coach directory.");
      } finally {
        if (!cancelled) setFindLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gate, tab, query, reload]);

  useEffect(() => {
    if (!selected || selected.status !== "active") {
      setNotes([]);
      setNotesLoading(false);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setNotesLoading(true);
    setNotesError(null);
    (async () => {
      try {
        const page = await loadCoachNotes(selected.id, { signal: ac.signal, force: true });
        if (!cancelled) setNotes(page.notes ?? []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNotes([]);
        setNotesError("Coach notes aren’t available for this relationship.");
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selected, reload]);

  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);
  const coachCount = clientHub?.coaches.length ?? 0;
  const clientCount = coachHub?.clients.length ?? 0;

  async function onDirectory(e: FormEvent) {
    e.preventDefault();
    setQuery(draftQuery.trim());
    setReload((n) => n + 1);
  }

  async function onRequest(entry: CoachDirectoryEntry) {
    try {
      await requestCoach(entry.user_id);
      setRequested((prev) => ({ ...prev, [entry.user_id]: true }));
      setReload((n) => n + 1);
    } catch (err) {
      setFindError(mutateMessage(err, "Could not send that request."));
    }
  }

  async function onNote(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const body = noteBody.trim();
    if (!body) return;
    setNoteBusy(true);
    try {
      await createCoachNote(selected.id, body);
      setNoteBody("");
      setReload((n) => n + 1);
    } catch (err) {
      setNotesError(mutateMessage(err, "Could not save that note."));
    } finally {
      setNoteBusy(false);
    }
  }

  async function onDirectoryToggle(next: boolean) {
    setProfileBusy(true);
    try {
      const saved = await saveCoachProfile({ directory_visible: next });
      setProfile(saved);
    } catch {
      setError("Could not update the coach directory listing.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function openDays(seriesId: number) {
    setDaysFor(seriesId);
    setDaysLoading(true);
    try {
      const page = await loadProgrammingDays(seriesId, addDays(today, -2), addDays(today, 12));
      setDays(page.days ?? []);
    } catch {
      setDays([]);
      setProgError("Unable to load programming days.");
    } finally {
      setDaysLoading(false);
    }
  }

  async function onSubscribe(id: number) {
    try {
      await subscribeProgrammingSeries(id);
      setReload((n) => n + 1);
    } catch (err) {
      setProgError(mutateMessage(err, "Could not subscribe."));
    }
  }

  async function onCancelSub(id: number) {
    if (!window.confirm("Stop this programming subscription?")) return;
    try {
      await cancelProgrammingSubscription(id);
      setReload((n) => n + 1);
    } catch (err) {
      setProgError(mutateMessage(err, "Could not cancel that subscription."));
    }
  }

  const heroStats =
    gate === "open"
      ? [
          { label: "Coaches", value: loading ? "—" : String(coachCount), note: "Virtual coaches" },
          { label: "Clients", value: loading ? "—" : String(clientCount), note: "1:1 clients" },
          {
            label: "Directory",
            value: profile?.directory_visible ? "Listed" : "Off",
            note: "Personal trainer opt-in",
          },
        ]
      : [
          { label: "Coaches", value: "Locked", note: "Included with MetFix Pro" },
          { label: "Clients", value: "Locked", note: "1:1 coaching" },
          { label: "Programming", value: "Locked", note: "Series and plans" },
        ];

  return (
    <DashboardLayout
      title={`${firstName}’s coaching`}
      description="Coaches, clients, notes, and programming from the MetFix app."
      hideChromeTitle
    >
      <ToolHero
        photo="/Stills/group-bodyweight-stand-gym.jpg"
        chips={
          <>
            <Link href={basePath("/account")} className="dash-chip">
              Overview
            </Link>
            {gate === "open" ? (
              <span className="dash-chip">Status · {status}</span>
            ) : (
              <span className="dash-chip dash-chip--accent">Included with MetFix Pro</span>
            )}
          </>
        }
        title={`${firstName}’s coaching tools.`}
        lede="The same coaching hub as the app: your coaches, your clients, coach notes, and programming."
        cta={
          gate === "locked" ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock coaching tools
            </Link>
          ) : null
        }
        stats={heroStats}
      />
      <BodyNav current="coaching" />
      {error ? <p className="account-error">{error}</p> : null}

      {gate !== "open" ? (
        <BodyPanel>
          <FeedSkeleton label="Coaching tools locked" />
          {gate === "locked" ? <ProUnlockBanner /> : null}
        </BodyPanel>
      ) : (
        <BodyPanel>
          <div className="dash-segment" role="tablist" aria-label="Coaching">
            {(
              [
                ["coach", "My coach"],
                ["clients", "My clients"],
                ["programming", "Programming"],
                ["find", "Find a coach"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "dash-segment__on" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && tab !== "programming" && tab !== "find" ? (
            <FeedSkeleton label="Loading coaching" />
          ) : null}

          {tab === "coach" && !loading ? (
            <>
              <h2 className="dash-section-title">My gym</h2>
              <GymList rows={clientHub?.affiliates ?? []} empty="No gym coaching hub yet." />
              <h2 className="dash-section-title">Virtual coaches</h2>
              <RelationshipList
                rows={clientHub?.coaches ?? []}
                empty="No coaches yet. Use Find a coach to send a request."
                onChange={() => setReload((n) => n + 1)}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
              />
            </>
          ) : null}

          {tab === "clients" && !loading ? (
            <>
              <label className="account-inline-check">
                <input
                  type="checkbox"
                  checked={profile?.directory_visible === true}
                  disabled={profileBusy}
                  onChange={(ev) => onDirectoryToggle(ev.target.checked)}
                />
                List me in the coach directory
              </label>
              <h2 className="dash-section-title">My gyms</h2>
              <GymList rows={coachHub?.affiliates ?? []} empty="No gyms where you coach." />
              <h2 className="dash-section-title">Virtual clients</h2>
              <RelationshipList
                rows={coachHub?.clients ?? []}
                empty="No 1:1 clients yet. Invite codes and QR join stay in the MetFix app."
                onChange={() => setReload((n) => n + 1)}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
              />
            </>
          ) : null}

          {selected && selected.status === "active" ? (
            <section className="dash-coach-notes" aria-label="Coach notes">
              <h2 className="dash-section-title">Notes · {personName(selected)}</h2>
              {notesLoading ? <FeedSkeleton label="Loading notes" /> : null}
              {notesError ? <p className="account-error">{notesError}</p> : null}
              {!notesLoading && notes.length === 0 && !notesError ? (
                <p className="account-muted">No notes yet.</p>
              ) : (
                <ul className="dash-coach-list">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <p>{note.body}</p>
                      {note.created_at ? (
                        <p className="dash-feed-row__meta">{formatStamp(note.created_at)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <form className="account-form" onSubmit={onNote}>
                <label>
                  Add a note
                  <textarea
                    value={noteBody}
                    onChange={(ev) => setNoteBody(ev.target.value)}
                    maxLength={4000}
                    disabled={noteBusy}
                  />
                </label>
                <button type="submit" className="account-btn" disabled={noteBusy}>
                  {noteBusy ? "Saving…" : "Save note"}
                </button>
              </form>
            </section>
          ) : null}

          {tab === "programming" ? (
            progLoading ? (
              <FeedSkeleton label="Loading programming" />
            ) : (
              <>
                {progError ? <p className="account-error">{progError}</p> : null}
                <h2 className="dash-section-title">Subscriptions</h2>
                {subscriptions.length === 0 ? (
                  <p className="account-muted">No programming subscriptions yet.</p>
                ) : (
                  <ul className="dash-coach-list">
                    {subscriptions.map((sub) => (
                      <li key={sub.id}>
                        <p className="dash-feed-row__title">
                          {sub.series_title || `Series ${sub.series_id}`}
                        </p>
                        <p className="dash-feed-row__meta">
                          {sub.status ?? "active"}
                          {sub.calendar_sync_enabled ? " · on your calendar" : ""}
                        </p>
                        <div className="dash-coach-list__actions">
                          <button type="button" className="account-btn account-btn--ghost" onClick={() => openDays(sub.series_id)}>
                            Show days
                          </button>
                          {sub.source !== "marketplace" && sub.status === "active" ? (
                            <button type="button" className="account-btn account-btn--ghost" onClick={() => onCancelSub(sub.id)}>
                              Stop
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <h2 className="dash-section-title">Published series</h2>
                {series.length === 0 ? (
                  <p className="account-muted">No published series returned.</p>
                ) : (
                  <ul className="dash-coach-list">
                    {series.map((item) => (
                      <li key={item.id}>
                        <p className="dash-feed-row__title">{item.title}</p>
                        <p className="dash-feed-row__meta">
                          {item.access_mode ?? "series"}
                          {item.status ? ` · ${item.status}` : ""}
                        </p>
                        {item.description ? <p className="account-muted">{item.description}</p> : null}
                        <div className="dash-coach-list__actions">
                          <button type="button" className="account-btn account-btn--ghost" onClick={() => openDays(item.id)}>
                            Show days
                          </button>
                          {item.is_subscribed ? (
                            <span className="account-muted">Subscribed</span>
                          ) : (
                            <button type="button" className="account-btn" onClick={() => onSubscribe(item.id)}>
                              Subscribe
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {daysFor != null ? (
                  <section aria-label="Programming days">
                    <h2 className="dash-section-title">Days</h2>
                    {daysLoading ? <FeedSkeleton label="Loading days" /> : null}
                    {!daysLoading && days.length === 0 ? (
                      <p className="account-muted">No days in this window.</p>
                    ) : (
                      <ul className="dash-coach-list">
                        {days.map((day) => (
                          <li key={day.id}>
                            <p className="dash-feed-row__title">
                              {formatDayLabel(day.calendar_date, today)}
                            </p>
                            <p className="dash-feed-row__meta">
                              {day.items.map((item) => item.label || item.item_type || "Item").join(" · ") ||
                                "No items"}
                            </p>
                            {day.notes ? <p className="account-muted">{day.notes}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}
                <h2 className="dash-section-title">Plans</h2>
                <Link href={basePath("/account/plans/new")} className="account-btn">
                  Build a plan
                </Link>
                {plans.length === 0 ? (
                  <p className="account-muted">No plans in your library yet.</p>
                ) : (
                  <ul className="dash-coach-list">
                    {plans.map((plan) => (
                      <li key={plan.id}>
                        <Link href={basePath(`/account/plans/${plan.id}`)} className="dash-feed-row">
                          <span className="dash-feed-row__title">{plan.title}</span>
                          <span className="dash-feed-row__meta">
                            {plan.duration_days != null ? `${plan.duration_days} days` : "Plan"}
                            {plan.status ? ` · ${plan.status}` : ""}
                            {plan.usage_status === "used" ? " · in use" : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          ) : null}

          {tab === "find" ? (
            <>
              <form className="account-form dash-pr-log" onSubmit={onDirectory}>
                <label>
                  Search coaches
                  <input
                  value={draftQuery}
                  onChange={(ev) => setDraftQuery(ev.target.value)}
                  placeholder="Name"
                  />
                </label>
                <button type="submit" className="account-btn">
                  Search
                </button>
              </form>
              {findError ? <p className="account-error">{findError}</p> : null}
              {findLoading ? <FeedSkeleton label="Loading coaches" /> : null}
              {!findLoading && directory.length === 0 ? (
                <p className="account-muted">No coaches match.</p>
              ) : (
                <ul className="dash-coach-list">
                  {directory.map((entry) => {
                    const name = entry.display_name || entry.name || "Coach";
                    return (
                      <li key={entry.user_id}>
                        <p className="dash-feed-row__title">{name}</p>
                        <p className="dash-feed-row__meta">
                          {entry.completed_courses_count != null
                            ? `${entry.completed_courses_count} courses`
                            : "Coach"}
                        </p>
                        {entry.search_excerpt || entry.bio ? (
                          <p className="account-muted">{entry.search_excerpt || entry.bio}</p>
                        ) : null}
                        <button
                          type="button"
                          className="account-btn"
                          disabled={requested[entry.user_id] === true}
                          onClick={() => onRequest(entry)}
                        >
                          {requested[entry.user_id] ? "Request sent" : "Request coach"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="account-muted">QR scan and invite codes stay in the MetFix app.</p>
            </>
          ) : null}
        </BodyPanel>
      )}
    </DashboardLayout>
  );
}
