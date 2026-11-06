import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSparkEntry,
  loadSparkUnits,
  type SparkUnit,
} from "@/lib/account";

const BODY_WEIGHT_MEASUREMENT_ID = 1;
const WEIGHT_UNIT_IDS = new Set([1, 2, 20]); // lb, kg, pood

/** Local `datetime-local` value (YYYY-MM-DDTHH:mm). */
function datetimeLocalNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Units appropriate for this health measurement (weight family, default, or history). */
export function unitsForHealthMeasurement(
  measurementId: number,
  defaultUnitId: number | null,
  defaultAbbrev: string | null,
  allUnits: SparkUnit[],
  historyUnitIds: number[],
): SparkUnit[] {
  if (measurementId === BODY_WEIGHT_MEASUREMENT_ID) {
    const weight = allUnits.filter((u) => WEIGHT_UNIT_IDS.has(u.unit_id));
    if (weight.length > 0) {
      return [...weight].sort((a, b) => a.unit_id - b.unit_id);
    }
  }

  const preferred = new Set<number>();
  if (defaultUnitId != null) preferred.add(defaultUnitId);
  for (const id of historyUnitIds) preferred.add(id);

  let matched = allUnits.filter((u) => preferred.has(u.unit_id));

  // Same-abbreviation family (e.g. mg/dL + mmol/L companions stay out unless in catalog default).
  if (matched.length === 0 && defaultAbbrev) {
    const needle = defaultAbbrev.trim().toLowerCase();
    matched = allUnits.filter((u) => u.abbreviation.trim().toLowerCase() === needle);
  }

  if (matched.length === 0 && defaultUnitId != null) {
    return [
      {
        unit_id: defaultUnitId,
        name: defaultAbbrev?.trim() || `Unit ${defaultUnitId}`,
        abbreviation: defaultAbbrev?.trim() || String(defaultUnitId),
      },
    ];
  }

  return matched.sort((a, b) => a.name.localeCompare(b.name));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurementId: number;
  measurementName: string;
  defaultUnitId: number | null;
  defaultUnitAbbreviation: string | null;
  historyUnitIds: number[];
  onLogged: () => void;
};

export function HealthLogModal({
  open,
  onOpenChange,
  measurementId,
  measurementName,
  defaultUnitId,
  defaultUnitAbbreviation,
  historyUnitIds,
  onLogged,
}: Props) {
  const [units, setUnits] = useState<SparkUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [value, setValue] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [when, setWhen] = useState(datetimeLocalNow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = useMemo(
    () =>
      unitsForHealthMeasurement(
        measurementId,
        defaultUnitId,
        defaultUnitAbbreviation,
        units,
        historyUnitIds,
      ),
    [measurementId, defaultUnitId, defaultUnitAbbreviation, units, historyUnitIds],
  );

  useEffect(() => {
    if (!open) return;
    setValue("");
    setWhen(datetimeLocalNow());
    setError(null);
    const ac = new AbortController();
    let cancelled = false;
    setUnitsLoading(true);
    (async () => {
      try {
        const page = await loadSparkUnits({ signal: ac.signal });
        if (cancelled) return;
        setUnits(Array.isArray(page.units) ? page.units : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUnits([]);
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, measurementId]);

  useEffect(() => {
    if (!open) return;
    if (choices.length === 0) {
      setUnitId(defaultUnitId);
      return;
    }
    const fromDefault =
      defaultUnitId != null
        ? choices.find((u) => u.unit_id === defaultUnitId)?.unit_id
        : undefined;
    setUnitId(fromDefault ?? choices[0]!.unit_id);
  }, [open, choices, defaultUnitId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid value.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when.trim())) {
      setError("Pick a measurement date and time.");
      return;
    }
    if (unitId == null) {
      setError("Select a unit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createSparkEntry({
        measurement_id: measurementId,
        value: n,
        measurement_date: when.trim(),
        unit_id: unitId,
      });
      if (res.skipped || res.auto_log_skipped) {
        setError(res.message || "Entry was not saved (not an improvement over your last log).");
        return;
      }
      onLogged();
      onOpenChange(false);
    } catch {
      setError("Could not save this entry. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dash-health-log-dialog">
        <DialogHeader>
          <DialogTitle>Log {measurementName}</DialogTitle>
          <DialogDescription>
            Add a new health measurement. Units are limited to those that match this metric.
          </DialogDescription>
        </DialogHeader>
        <form className="account-form dash-health-log-form" onSubmit={onSubmit}>
          <div className="account-form-row">
            <label>
              Value
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={value}
                onChange={(ev) => setValue(ev.target.value)}
                required
                disabled={busy}
                autoFocus
              />
            </label>
            <label>
              Unit
              <select
                value={unitId ?? ""}
                onChange={(ev) => setUnitId(Number(ev.target.value) || null)}
                required
                disabled={busy || unitsLoading || choices.length === 0}
              >
                {choices.length === 0 ? (
                  <option value="">
                    {unitsLoading ? "Loading units…" : defaultUnitAbbreviation || "No units"}
                  </option>
                ) : (
                  choices.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.name}
                      {u.abbreviation && u.abbreviation !== u.name ? ` (${u.abbreviation})` : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <label>
            Date &amp; time
            <input
              type="datetime-local"
              value={when}
              onChange={(ev) => setWhen(ev.target.value)}
              required
              disabled={busy}
            />
          </label>
          {error ? <p className="account-error">{error}</p> : null}
          <DialogFooter>
            <button
              type="button"
              className="account-btn account-btn--ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="account-btn account-btn--accent" disabled={busy}>
              {busy ? "Saving…" : "Save entry"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
