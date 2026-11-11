import { useEffect, useMemo, useState } from "react";
import {
  loadNotifications,
  updateNotifications,
  type NotificationPrefType,
  type NotificationsPayload,
} from "@/lib/account";
import { humanSettingLabel } from "./settingLabels";

const CHANNELS = ["email", "text", "phone", "push", "in_feed"] as const;

const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  email: "Email",
  text: "Text",
  phone: "Phone",
  push: "Push",
  in_feed: "In app",
};

type PrefRow = {
  slug: string;
  label: string;
  group: string;
  allowed: string[];
  emailRequired: boolean;
  channels: Record<string, 0 | 1>;
};

function channelBit(raw: unknown): 0 | 1 {
  return raw === true || raw === 1 ? 1 : 0;
}

function rowFromType(type: NotificationPrefType): PrefRow[] {
  const slug = typeof type.slug === "string" ? type.slug.trim() : "";
  if (!slug) return [];
  const allowed = (type.allowed_channels ?? []).filter((channel) =>
    (CHANNELS as readonly string[]).includes(channel),
  );
  const channels: Record<string, 0 | 1> = {};
  for (const channel of allowed) {
    channels[channel] = channelBit(type.channels?.[channel as keyof typeof type.channels]);
  }
  if (type.email_required && allowed.includes("email")) channels.email = 1;
  return [
    {
      slug,
      label: (type.label ?? "").trim() || humanSettingLabel(slug) || slug,
      group: (type.group ?? "general").trim() || "general",
      allowed,
      emailRequired: type.email_required === true,
      channels,
    },
  ];
}

function prefRowsFrom(payload: NotificationsPayload | null): PrefRow[] {
  const types = payload?.account?.types;
  if (!Array.isArray(types)) return [];
  return types.flatMap((type) => rowFromType(type));
}

function SettingSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="settings-switch">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-switch__track" aria-hidden="true" />
    </label>
  );
}

export default function NotificationSettings() {
  const [types, setTypes] = useState<PrefRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const payload = await loadNotifications({ signal: ac.signal });
        if (cancelled) return;
        setTypes(prefRowsFrom(payload));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError("Unable to load notification settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, PrefRow[]>();
    for (const row of types) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()];
  }, [types]);

  async function onSave() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateNotifications({
        account: {
          types: types.map((row) => ({ slug: row.slug, channels: row.channels })),
        },
      });
      const saved = prefRowsFrom(next);
      if (saved.length > 0) setTypes(saved);
      setMessage("Notification settings saved.");
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="account-muted">Loading notification settings…</p>;
  }

  return (
    <div className="settings-prefs">
      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <p className="settings-detail__lede">
        Choose what MetFix sends you. In-app alerts still show in your inbox.
      </p>

      {groups.map(([group, rows]) => (
        <section className="settings-pref-group" key={group}>
          <h3>{humanSettingLabel(group) ?? group}</h3>
          {rows.map((row) => (
            <div className="settings-pref" key={row.slug}>
              <p className="settings-pref__title">{row.label}</p>
              <div className="settings-pref__channels">
                {row.allowed.map((channel) => {
                  const label = CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS] ?? channel;
                  const locked = channel === "email" && row.emailRequired;
                  return (
                    <div className="settings-pref__channel" key={channel}>
                      <span>{label}</span>
                      <SettingSwitch
                        label={`${row.label} ${label}`}
                        checked={row.channels[channel] === 1}
                        disabled={locked}
                        onChange={(on) => {
                          setTypes((prev) =>
                            prev.map((item) =>
                              item.slug === row.slug
                                ? {
                                    ...item,
                                    channels: { ...item.channels, [channel]: on ? 1 : 0 },
                                  }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      <button
        type="button"
        className="account-btn"
        style={{ marginTop: "1.25rem" }}
        disabled={busy}
        onClick={() => void onSave()}
      >
        Save preferences
      </button>
    </div>
  );
}
