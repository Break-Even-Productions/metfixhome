import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { formatUsdFromCents } from "@shared/account/ltv";
import {
  accountRead,
  accountWrite,
  affiliatePath,
  apiMessage,
  AccountApiError,
} from "@/lib/affiliateAccount";
import type { AccountOverview } from "@/lib/account";
import { AttributeFields, type AttributeWrite } from "./AttributeFields";
import type { AttributeFieldModel } from "./AttributeFields";

type PanelId = "overview" | "settings" | "team" | "feed" | "payments" | "insurance" | "activity";

type AffiliateChoice = { id: number; name: string };

type Permissions = {
  can_edit_affiliate?: boolean;
  can_invite_coaches?: boolean;
  can_add_delegates?: boolean;
  can_view_payments?: boolean;
  can_submit_insurance?: boolean;
  can_post_affiliate_announcement?: boolean;
  can_moderate_affiliate_feed?: boolean;
};

type Caps = {
  role: string | null;
  permissions: Permissions;
  capabilities: Record<string, boolean>;
};

type TeamMember = {
  member_id: number;
  user_id: number;
  name: string;
  email?: string;
  role: string;
  active?: boolean;
  activation_date?: string;
};

const CAP_LABELS: Record<string, string> = {
  bsi_can_edit_affiliate: "Edit affiliate settings",
  bsi_can_invite_coach_to_affiliate: "Invite coaches",
  bsi_can_add_delegate: "Add delegates",
  bsi_can_submit_affiliate_insurance: "Submit insurance",
  bsi_can_view_affiliate_payments: "View and make affiliate payments",
  bsi_can_view_metfix_resources: "View MetFix resources",
  bsi_can_access_all_courses: "Access all courses",
  bsi_can_view_recorded_webinars: "View recorded webinars",
  bsi_can_edit_spark_dash: "Edit Spark dashboard",
  bsi_can_manage_occurrences: "Manage classes",
  bsi_can_manage_schedules: "Manage schedules",
  bsi_can_manage_affiliate_challenges: "Manage challenges",
};

const PANELS: Array<{ id: PanelId; title: string; detail: string }> = [
  { id: "overview", title: "Overview", detail: "Status and public join" },
  { id: "settings", title: "Settings", detail: "Affiliate attributes" },
  { id: "team", title: "Team", detail: "People and capabilities" },
  { id: "feed", title: "Feed", detail: "Posts, likes, and comments" },
  { id: "payments", title: "Payments", detail: "Dues and membership calendar" },
  { id: "insurance", title: "Insurance", detail: "Policy and submission" },
  { id: "activity", title: "Activity", detail: "Change history" },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function feedText(item: Record<string, unknown>): { title: string; body: string; postId: number | null } {
  const data = asRecord(item.data) ?? item;
  const content = typeof data.content === "string" ? data.content : "";
  const author = typeof data.author_name === "string" ? data.author_name : "";
  const type = typeof item.type === "string" ? item.type : "post";
  const postId =
    typeof data.id === "number" ? data.id : typeof item.id === "number" ? item.id : null;
  return {
    title: author || type.replace(/_/g, " "),
    body: content || type.replace(/_/g, " "),
    postId: type === "post" ? postId : null,
  };
}

export default function AffiliateWorkspace(props: {
  affiliates: AffiliateChoice[];
  overview: AccountOverview | null;
  onPortal: () => void;
  portalBusy: boolean;
}) {
  const { affiliates, overview, onPortal, portalBusy } = props;
  const [affiliateId, setAffiliateId] = useState(affiliates[0]?.id ?? 0);
  const [panel, setPanel] = useState<PanelId>("overview");
  const [caps, setCaps] = useState<Caps | null>(null);
  const [hidden, setHidden] = useState<Partial<Record<PanelId, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!affiliates.some((row) => row.id === affiliateId) && affiliates[0]) {
      setAffiliateId(affiliates[0].id);
    }
  }, [affiliates, affiliateId]);

  useEffect(() => {
    if (!affiliateId) return;
    const ac = new AbortController();
    accountRead<Caps>(affiliatePath(affiliateId, "/me/capabilities"), ac.signal)
      .then((body) => {
        setCaps({
          role: typeof body.role === "string" ? body.role : null,
          permissions: body.permissions ?? {},
          capabilities: body.capabilities ?? {},
        });
        setHidden({});
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setCaps(null);
        setError(apiMessage(err, "Unable to load affiliate access."));
      });
    return () => ac.abort();
  }, [affiliateId]);

  const visiblePanels = PANELS.filter((item) => {
    if (hidden[item.id]) return false;
    const p = caps?.permissions;
    if (item.id === "settings") return p?.can_edit_affiliate === true;
    if (item.id === "payments") return p?.can_view_payments === true;
    if (item.id === "insurance") return p?.can_submit_insurance === true;
    return true;
  });

  const hidePanel = useCallback((id: PanelId) => {
    setHidden((current) => ({ ...current, [id]: true }));
    setPanel("overview");
  }, []);

  const visibleKey = visiblePanels.map((item) => item.id).join(",");
  useEffect(() => {
    if (visibleKey && !visibleKey.split(",").includes(panel)) setPanel("overview");
  }, [visibleKey, panel]);

  const current = visiblePanels.find((item) => item.id === panel) ?? visiblePanels[0];

  return (
    <div className="settings-shell">
      <div>
        {affiliates.length > 1 ? (
          <label className="account-form">
            Affiliate
            <select
              aria-label="Affiliate"
              value={String(affiliateId)}
              onChange={(e) => {
                setAffiliateId(Number(e.target.value));
                setMessage(null);
                setError(null);
              }}
            >
              {affiliates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="account-mono">{affiliates[0]?.name}</p>
        )}
        <nav className="settings-menu" aria-label="Affiliate">
          {visiblePanels.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={panel === item.id}
              onClick={() => {
                setPanel(item.id);
                setMessage(null);
                setError(null);
              }}
            >
              <span>
                <span className="settings-menu__title">{item.title}</span>
                <span className="settings-menu__detail">{item.detail}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
      <section className="settings-detail" aria-labelledby="affiliate-detail-title">
        <h2 id="affiliate-detail-title">{current?.title ?? "Overview"}</h2>
        {caps?.role ? <p className="account-muted">Your role: {caps.role}</p> : null}
        {error ? <p className="account-error">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        {affiliateId && panel === "overview" ? (
          <OverviewPanel
            affiliateId={affiliateId}
            canEditJoin={caps?.permissions.can_edit_affiliate === true}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            setMessage={setMessage}
            onPortal={onPortal}
            portalBusy={portalBusy}
          />
        ) : null}
        {affiliateId && panel === "settings" ? (
          <SettingsPanel
            affiliateId={affiliateId}
            setError={setError}
            setMessage={setMessage}
            onForbidden={() => hidePanel("settings")}
          />
        ) : null}
        {affiliateId && panel === "team" ? (
          <TeamPanel
            affiliateId={affiliateId}
            caps={caps}
            setError={setError}
            setMessage={setMessage}
          />
        ) : null}
        {affiliateId && panel === "feed" ? (
          <FeedPanel
            affiliateId={affiliateId}
            caps={caps}
            setError={setError}
            setMessage={setMessage}
          />
        ) : null}
        {affiliateId && panel === "payments" ? (
          <PaymentsPanel affiliateId={affiliateId} onForbidden={() => hidePanel("payments")} setError={setError} />
        ) : null}
        {affiliateId && panel === "insurance" ? (
          <InsurancePanel
            affiliateId={affiliateId}
            overview={overview}
            affiliateName={affiliates.find((row) => row.id === affiliateId)?.name ?? ""}
            onForbidden={() => hidePanel("insurance")}
            setError={setError}
          />
        ) : null}
        {affiliateId && panel === "activity" ? (
          <ActivityPanel affiliateId={affiliateId} onForbidden={() => hidePanel("activity")} setError={setError} />
        ) : null}
      </section>
    </div>
  );
}

function OverviewPanel(props: {
  affiliateId: number;
  canEditJoin: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;
  onPortal: () => void;
  portalBusy: boolean;
}) {
  const { affiliateId, canEditJoin, busy, setBusy, setError, setMessage, onPortal, portalBusy } = props;
  const [body, setBody] = useState<Record<string, unknown> | null>(null);
  const [join, setJoin] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    accountRead<Record<string, unknown>>(affiliatePath(affiliateId), ac.signal)
      .then((next) => {
        setBody(next);
        setJoin(next.public_profile_join_enabled === true);
      })
      .catch((err) => {
        if (!ac.signal.aborted) setError(apiMessage(err, "Unable to load this affiliate."));
      });
    return () => ac.abort();
  }, [affiliateId, setError]);

  async function onJoin(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await accountWrite(affiliatePath(affiliateId, "/join-settings"), "PATCH", {
        public_profile_join_enabled: next,
      });
      setJoin(next);
      setMessage(next ? "Public join requests are on." : "Public join requests are off.");
    } catch (err) {
      setError(apiMessage(err, "Could not update join settings."));
    } finally {
      setBusy(false);
    }
  }

  const payment = asRecord(body?.payment_status);
  const insurance = asRecord(body?.insurance_status);
  const foundations = asRecord(body?.foundations_status);
  const name = typeof body?.name === "string" ? body.name : "Affiliate";

  return (
    <>
      <h3>{name}</h3>
      <ul className="account-checklist">
        <li>Payment: {typeof payment?.status === "string" ? payment.status : "—"}</li>
        <li>Insurance: {typeof insurance?.status === "string" ? insurance.status : "—"}</li>
        <li>Foundations: {typeof foundations?.status === "string" ? foundations.status : "—"}</li>
      </ul>
      {canEditJoin && "public_profile_join_enabled" in (body ?? {}) ? (
        <label className="account-inline-check">
          <input
            type="checkbox"
            checked={join}
            disabled={busy}
            onChange={(e) => void onJoin(e.target.checked)}
          />
          Accept public profile join requests
        </label>
      ) : null}
      <div className="account-course-card__actions">
        <button type="button" className="account-btn" disabled={portalBusy} onClick={onPortal}>
          Manage organization billing
        </button>
      </div>
    </>
  );
}

function SettingsPanel(props: {
  affiliateId: number;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;
  onForbidden: () => void;
}) {
  const { affiliateId, setError, setMessage, onForbidden } = props;
  const [fields, setFields] = useState<AttributeFieldModel[]>([]);
  const [busy, setBusy] = useState(false);
  const writesRef = useRef<AttributeWrite[]>([]);
  const onChange = useCallback((writes: AttributeWrite[]) => {
    writesRef.current = writes;
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    accountRead<unknown>(affiliatePath(affiliateId, "/attributes"), ac.signal)
      .then((raw) => {
        const groups = Array.isArray(raw) ? raw : [];
        const next: AttributeFieldModel[] = [];
        for (const group of groups) {
          const rec = asRecord(group);
          if (!rec || !Array.isArray(rec.attributes)) continue;
          const category =
            typeof rec.category_display_name === "string" ? rec.category_display_name : "";
          for (const row of rec.attributes) {
            const attr = asRecord(row);
            if (!attr || typeof attr.id !== "number") continue;
            const formType = typeof attr.form_type === "string" ? attr.form_type : "text";
            if (formType === "email" || formType === "file" || formType === "video") continue;
            const rawValue = attr.raw_value == null ? "" : String(attr.raw_value);
            const shown = typeof attr.current_value === "string" ? attr.current_value : rawValue;
            next.push({
              attr_id: attr.id,
              label: typeof attr.name === "string" ? attr.name : `Attribute ${attr.id}`,
              description: typeof attr.description === "string" ? attr.description : undefined,
              category,
              form_type: formType,
              value: formType === "tag" || formType === "affiliate_select" ? rawValue : shown,
              address: asRecord(attr.address)
                ? {
                    address: String((attr.address as { address?: string }).address ?? ""),
                    address2: String((attr.address as { address2?: string }).address2 ?? ""),
                    city: String((attr.address as { city?: string }).city ?? ""),
                    zip: String((attr.address as { zip?: string }).zip ?? ""),
                    state:
                      typeof (attr.address as { state?: unknown }).state === "number"
                        ? (attr.address as { state: number }).state
                        : null,
                    country:
                      typeof (attr.address as { country?: unknown }).country === "number"
                        ? (attr.address as { country: number }).country
                        : 1,
                  }
                : null,
            });
          }
        }
        setFields(next);
      })
      .catch((err) => {
        if (err instanceof AccountApiError && err.status === 403) onForbidden();
        else if (!ac.signal.aborted) setError(apiMessage(err, "Unable to load affiliate settings."));
      });
    return () => ac.abort();
  }, [affiliateId, onForbidden, setError]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      for (const row of writesRef.current) {
        const body =
          row.form_type === "address" && row.address
            ? row.address
            : { value: row.value };
        await accountWrite(affiliatePath(affiliateId, `/attributes/${row.attr_id}`), "PATCH", body);
      }
      setMessage("Affiliate settings saved.");
    } catch (err) {
      setError(apiMessage(err, "Could not save affiliate settings."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={(e) => void onSave(e)}>
      {fields.length === 0 ? <p className="account-muted">No editable affiliate fields.</p> : null}
      <AttributeFields fields={fields} idPrefix={`aff-${affiliateId}`} onChange={onChange} />
      <button type="submit" className="account-btn" disabled={busy || fields.length === 0}>
        Save settings
      </button>
    </form>
  );
}

function TeamPanel(props: {
  affiliateId: number;
  caps: Caps | null;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;
}) {
  const { affiliateId, caps, setError, setMessage } = props;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"coach" | "delegate" | "member">("coach");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editCaps, setEditCaps] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const body = await accountRead<{ members?: TeamMember[] }>(affiliatePath(affiliateId, "/members"));
    setMembers(Array.isArray(body.members) ? body.members : []);
  }, [affiliateId]);

  useEffect(() => {
    load().catch((err) => setError(apiMessage(err, "Unable to load the team.")));
  }, [load, setError]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await accountWrite<{ message?: string }>(
        affiliatePath(affiliateId, "/invites"),
        "POST",
        { member_email: email, member_role: role },
      );
      setMessage(result.message ?? "Invite sent.");
      setEmail("");
    } catch (err) {
      setError(apiMessage(err, "Invite failed."));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(member: TeamMember) {
    setBusy(true);
    setError(null);
    try {
      await accountWrite(affiliatePath(affiliateId, `/members/${member.member_id}`), "DELETE");
      setMessage("Member removed.");
      await load();
    } catch (err) {
      setError(apiMessage(err, "Could not remove that member."));
    } finally {
      setBusy(false);
    }
  }

  async function openCaps(member: TeamMember) {
    const kind = member.role === "delegate" ? "delegates" : "coaches";
    try {
      const body = await accountRead<Record<string, boolean>>(
        affiliatePath(affiliateId, `/${kind}/${member.user_id}/capabilities`),
      );
      setEditing(member);
      setEditCaps(body);
    } catch (err) {
      setError(apiMessage(err, "Unable to load capabilities."));
    }
  }

  async function saveCaps() {
    if (!editing) return;
    const kind = editing.role === "delegate" ? "delegates" : "coaches";
    setBusy(true);
    try {
      await accountWrite(
        affiliatePath(affiliateId, `/${kind}/${editing.user_id}/capabilities`),
        "PATCH",
        { capabilities: editCaps },
      );
      setMessage("Capabilities saved.");
      setEditing(null);
    } catch (err) {
      setError(apiMessage(err, "Could not save capabilities."));
    } finally {
      setBusy(false);
    }
  }

  const canInvite = caps?.permissions.can_invite_coaches === true;
  const canDelegate = caps?.permissions.can_add_delegates === true;
  const ownCaps = caps?.capabilities ?? {};

  return (
    <>
      <table className="account-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Since</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.member_id}>
              <td>{member.name || "Member"}</td>
              <td>{member.role}</td>
              <td>{member.activation_date ?? "—"}</td>
              <td>
                {member.role !== "owner" && (member.role === "coach" || member.role === "delegate") ? (
                  <button type="button" className="account-btn account-btn--ghost" onClick={() => void openCaps(member)}>
                    Capabilities
                  </button>
                ) : null}
                {member.role !== "owner" ? (
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    disabled={busy}
                    onClick={() => void onRemove(member)}
                  >
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canInvite || canDelegate ? (
        <form className="account-form" onSubmit={(e) => void onInvite(e)}>
          <h3>Invite</h3>
          <p className="account-muted">
            Coach and member invites can go to a new email. Delegate invites need an existing account with seminar credit.
          </p>
          <label>
            Email
            <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              {canInvite ? <option value="coach">Coach</option> : null}
              {canInvite ? <option value="member">Member</option> : null}
              {canDelegate ? <option value="delegate">Delegate</option> : null}
            </select>
          </label>
          <button type="submit" className="account-btn" disabled={busy}>
            Send invite
          </button>
        </form>
      ) : null}
      {Object.keys(ownCaps).length > 0 ? (
        <div>
          <h3>Your capabilities</h3>
          <ul className="account-checklist">
            {Object.entries(ownCaps).map(([key, enabled]) => (
              <li key={key} data-done={enabled ? "true" : "false"}>
                {CAP_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {editing ? (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveCaps();
          }}
        >
          <h3>Capabilities for {editing.name}</h3>
          {Object.keys(editCaps).map((key) => (
            <label key={key} className="account-inline-check">
              <input
                type="checkbox"
                checked={editCaps[key] === true}
                onChange={(e) => setEditCaps((current) => ({ ...current, [key]: e.target.checked }))}
              />
              {CAP_LABELS[key] ?? key}
            </label>
          ))}
          <button type="submit" className="account-btn" disabled={busy}>
            Save capabilities
          </button>
        </form>
      ) : null}
    </>
  );
}

function FeedPanel(props: {
  affiliateId: number;
  caps: Caps | null;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;
}) {
  const { affiliateId, caps, setError, setMessage } = props;
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [content, setContent] = useState("");
  const [announcement, setAnnouncement] = useState(false);
  const [comments, setComments] = useState<Record<number, Array<Record<string, unknown>>>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const staff = caps?.permissions.can_post_affiliate_announcement === true;
  const moderate = caps?.permissions.can_moderate_affiliate_feed === true;

  const load = useCallback(async () => {
    const body = await accountRead<{ items?: Record<string, unknown>[] }>(
      affiliatePath(affiliateId, "/feed?limit=20&offset=0"),
    );
    setItems(Array.isArray(body.items) ? body.items : []);
  }, [affiliateId]);

  useEffect(() => {
    load().catch((err) => setError(apiMessage(err, "Unable to load the feed.")));
  }, [load, setError]);

  async function onPost(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountWrite(affiliatePath(affiliateId, "/feed"), "POST", {
        post_type: announcement && staff ? "announcement" : "motivation",
        content,
      });
      setContent("");
      setMessage("Posted.");
      await load();
    } catch (err) {
      setError(apiMessage(err, "Could not post."));
    } finally {
      setBusy(false);
    }
  }

  async function mutatePost(postId: number, path: string, method: "POST" | "DELETE" | "PATCH", body?: unknown) {
    setBusy(true);
    try {
      await accountWrite(affiliatePath(affiliateId, `/feed/${postId}${path}`), method, body);
      await load();
    } catch (err) {
      setError(apiMessage(err, "Feed action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function loadComments(postId: number) {
    const body = await accountRead<{ comments?: Array<Record<string, unknown>> }>(
      affiliatePath(affiliateId, `/feed/${postId}/comments`),
    );
    setComments((current) => ({ ...current, [postId]: body.comments ?? [] }));
  }

  return (
    <>
      <form className="account-form" onSubmit={(e) => void onPost(e)}>
        <label>
          Post
          <textarea value={content} required onChange={(e) => setContent(e.target.value)} />
        </label>
        {staff ? (
          <label className="account-inline-check">
            <input
              type="checkbox"
              checked={announcement}
              onChange={(e) => setAnnouncement(e.target.checked)}
            />
            Announcement
          </label>
        ) : null}
        <button type="submit" className="account-btn" disabled={busy}>
          Post to feed
        </button>
      </form>
      <ul className="account-inbox-list">
        {items.map((item, index) => {
          const view = feedText(item);
          const data = asRecord(item.data) ?? {};
          const pinned = data.is_pinned === true || data.is_pinned === 1;
          return (
            <li key={`${view.postId ?? "item"}-${index}`}>
              <p>
                <strong>{view.title}</strong>
                {pinned ? " · Pinned" : ""}
              </p>
              <p>{view.body}</p>
              {view.postId ? (
                <div className="account-course-card__actions">
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    onClick={() =>
                      void mutatePost(view.postId!, "/like", "POST", {})
                    }
                  >
                    Like
                  </button>
                  {moderate ? (
                    <>
                      <button
                        type="button"
                        className="account-btn account-btn--ghost"
                        onClick={() => void mutatePost(view.postId!, "/pin", "POST", { pinned: !pinned })}
                      >
                        {pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        className="account-btn account-btn--ghost"
                        onClick={() => void mutatePost(view.postId!, "", "DELETE")}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="account-btn account-btn--ghost" onClick={() => void loadComments(view.postId!)}>
                    Comments
                  </button>
                </div>
              ) : null}
              {view.postId && comments[view.postId] ? (
                <div>
                  {comments[view.postId]!.map((comment, commentIndex) => (
                    <p key={commentIndex}>
                      {typeof comment.content === "string" ? comment.content : ""}
                      {moderate && typeof comment.id === "number" ? (
                        <button
                          type="button"
                          className="account-btn account-btn--ghost"
                          onClick={() =>
                            void accountWrite(
                              affiliatePath(affiliateId, `/feed/${view.postId}/comments/${comment.id}`),
                              "DELETE",
                            ).then(() => loadComments(view.postId!))
                          }
                        >
                          Remove comment
                        </button>
                      ) : null}
                    </p>
                  ))}
                  <form
                    className="account-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = drafts[view.postId!] ?? "";
                      void accountWrite(affiliatePath(affiliateId, `/feed/${view.postId}/comments`), "POST", {
                        content: text,
                      }).then(() => {
                        setDrafts((current) => ({ ...current, [view.postId!]: "" }));
                        return loadComments(view.postId!);
                      });
                    }}
                  >
                    <label>
                      Comment
                      <input
                        value={drafts[view.postId] ?? ""}
                        onChange={(e) =>
                          setDrafts((current) => ({ ...current, [view.postId!]: e.target.value }))
                        }
                      />
                    </label>
                    <button type="submit" className="account-btn account-btn--ghost">
                      Add comment
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PaymentsPanel(props: {
  affiliateId: number;
  onForbidden: () => void;
  setError: (v: string | null) => void;
}) {
  const { affiliateId, onForbidden, setError } = props;
  const [year, setYear] = useState(new Date().getFullYear());
  const [body, setBody] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    accountRead<Record<string, unknown>>(affiliatePath(affiliateId, `/payments?year=${year}`), ac.signal)
      .then(setBody)
      .catch((err) => {
        if (err instanceof AccountApiError && err.status === 403) onForbidden();
        else if (!ac.signal.aborted) setError(apiMessage(err, "Unable to load affiliate payments."));
      });
    return () => ac.abort();
  }, [affiliateId, year, onForbidden, setError]);

  const next = asRecord(body?.next_payment);
  const payments = Array.isArray(body?.payments) ? body.payments : [];
  const calendar = asRecord(body?.calendar);
  const months = Array.isArray(calendar?.months) ? calendar.months : [];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2023 }, (_, i) => current - i);
  }, []);

  return (
    <>
      <label>
        Year
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {next ? (
        <p>
          Next payment {typeof next.date === "string" ? next.date : ""} ·{" "}
          <span className="account-mono">
            {typeof next.amount === "number" ? formatUsdFromCents(next.amount) : "—"}
          </span>
          {typeof next.invoice_url === "string" && next.invoice_url.startsWith("https://") ? (
            <>
              {" "}
              <a href={next.invoice_url} rel="noreferrer">
                Pay
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <table className="account-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((row) => {
            const payment = asRecord(row);
            if (!payment) return null;
            const href = typeof payment.invoice_url === "string" ? payment.invoice_url : "";
            return (
              <tr key={String(payment.id)}>
                <td>{typeof payment.date === "string" ? payment.date : "—"}</td>
                <td className="account-mono">
                  {typeof payment.amount === "number" ? formatUsdFromCents(payment.amount) : "—"}
                </td>
                <td>{typeof payment.status === "string" ? payment.status : "—"}</td>
                <td>
                  {href.startsWith("https://") ? (
                    <a href={href} rel="noreferrer">
                      {payment.status === "paid" ? "Review" : "Pay"}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="affiliate-calendar" aria-label="Membership calendar">
        {months.map((row) => {
          const month = asRecord(row);
          if (!month) return null;
          const state = typeof month.state === "string" ? month.state : "inactive";
          return (
            <div key={String(month.ym)} className="affiliate-calendar__cell" data-state={state}>
              <span className="account-mono">{String(month.ym ?? "")}</span>
              <span>{state}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function InsurancePanel(props: {
  affiliateId: number;
  overview: AccountOverview | null;
  affiliateName: string;
  onForbidden: () => void;
  setError: (v: string | null) => void;
}) {
  const { affiliateId, overview, affiliateName, onForbidden, setError } = props;
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      accountRead<{ current_insurance?: Record<string, unknown> | null }>(
        affiliatePath(affiliateId, "/insurance"),
        ac.signal,
      ),
      accountRead<unknown>(affiliatePath(affiliateId, "/insurance/history"), ac.signal),
    ])
      .then(([now, past]) => {
        setCurrent(now.current_insurance ?? null);
        const wrapped = Array.isArray(past) ? asRecord(past[0]) : asRecord(past);
        const rows = wrapped && Array.isArray(wrapped.history) ? wrapped.history : [];
        setHistory(rows.filter((row): row is Record<string, unknown> => !!asRecord(row)));
      })
      .catch((err) => {
        if (err instanceof AccountApiError && err.status === 403) onForbidden();
        else if (!ac.signal.aborted) setError(apiMessage(err, "Unable to load insurance."));
      });
    return () => ac.abort();
  }, [affiliateId, onForbidden, setError]);

  useEffect(() => {
    if (!open) return;
    if (document.querySelector('script[data-fillout-embed="1"]')) return;
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    script.dataset.filloutEmbed = "1";
    document.body.appendChild(script);
  }, [open]);

  const expiration = typeof current?.expiration_date === "string" ? current.expiration_date : "";

  return (
    <>
      {current ? (
        <p>
          Effective {String(current.effective_date ?? "—")} · Expires {expiration || "—"} ·{" "}
          {String(current.status ?? "pending")}
          {typeof current.policy_url === "string" && current.policy_url.startsWith("https://") ? (
            <>
              {" "}
              <a href={current.policy_url} rel="noreferrer">
                Review policy
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="account-muted">No current policy on file.</p>
      )}
      <ul>
        {history.map((row) => (
          <li key={String(row.id)}>
            {String(row.effective_date ?? "")} – {String(row.expiration_date ?? "")} · {String(row.status ?? "")}
          </li>
        ))}
      </ul>
      <button type="button" className="account-btn" onClick={() => setOpen((value) => !value)}>
        {open ? "Close insurance form" : "Submit insurance"}
      </button>
      {open ? (
        <div
          style={{ width: "100%", height: "500px" }}
          data-fillout-id="vX2frHKKweus"
          data-fillout-embed-type="standard"
          data-fillout-inherit-parameters
          data-fillout-dynamic-resize
          data-fillout-domain="forms.metfix.org"
          data-aff_id={String(affiliateId)}
          data-name={overview?.display_name ?? ""}
          data-email={overview?.email ?? ""}
          data-metfix_aff={affiliateName}
          data-recent_ins={expiration}
          data-insurance_status={typeof current?.status === "string" ? current.status : ""}
        />
      ) : null}
    </>
  );
}

function ActivityPanel(props: {
  affiliateId: number;
  onForbidden: () => void;
  setError: (v: string | null) => void;
}) {
  const { affiliateId, onForbidden, setError } = props;
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const ac = new AbortController();
    accountRead<{ activity?: Array<Record<string, unknown>> }>(
      affiliatePath(affiliateId, `/activity?filter=${filter}&limit=50&offset=0`),
      ac.signal,
    )
      .then((body) => setRows(Array.isArray(body.activity) ? body.activity : []))
      .catch((err) => {
        if (err instanceof AccountApiError && err.status === 403) onForbidden();
        else if (!ac.signal.aborted) setError(apiMessage(err, "Unable to load activity."));
      });
    return () => ac.abort();
  }, [affiliateId, filter, onForbidden, setError]);

  return (
    <>
      <label>
        Filter
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="affiliate_setting">Settings</option>
          <option value="member">Members</option>
        </select>
      </label>
      <table className="account-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{String(row.timestamp ?? row.created_at ?? "—")}</td>
              <td>{String(row.member_name ?? "—")}</td>
              <td>
                {String(row.change_type ?? row.note ?? "")}
                {row.old_value || row.new_value
                  ? ` ${String(row.old_value ?? "")} → ${String(row.new_value ?? "")}`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
