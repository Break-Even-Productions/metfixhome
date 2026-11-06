/**
 * Body dashboard shapers — workout feed, PR attempt logs, and coaching tools.
 * Allowlisted fields only. Mirrors the MetFix app clients in workoutApi,
 * plannedWorkoutCalendarApi, personalTrainingApi, programmingApi, and planApi.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmdRange(
  startRaw: string | null,
  endRaw: string | null,
  maxDays = 800,
): { start: string; end: string } | null {
  const start = startRaw ?? "";
  const end = endRaw ?? "";
  if (!YMD.test(start) || !YMD.test(end) || end < start) return null;
  if (!isRealYmd(start) || !isRealYmd(end)) return null;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const days = Math.round((b - a) / 86_400_000);
  if (days > maxDays) return null;
  return { start, end };
}

export function parseRouteId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function isRealYmd(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function finiteNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function posInt(v: unknown): number | null {
  const n = finiteNum(v);
  if (n == null || !Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function httpsOrNull(v: unknown): string | null {
  const s = clip(v, 500);
  if (!s || !s.startsWith("https://")) return null;
  return s;
}

function firstArray(obj: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!obj) return [];
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function loggedFlag(v: unknown): number {
  return v === 1 || v === "1" || v === true ? 1 : 0;
}

function shapeScoreEntry(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const value = finiteNum(r.score_value);
  const type = clip(r.score_type, 40);
  if (value == null && !type) return null;
  const scaling = r.scaling_mode === "scaled" || r.scaling_mode === "rx" ? r.scaling_mode : null;
  return {
    score_type: type,
    score_value: value,
    scaling_mode: scaling,
  };
}

function shapeScoreEntries(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const row of raw) {
    const shaped = shapeScoreEntry(row);
    if (shaped) out.push(shaped);
    if (out.length >= 12) break;
  }
  return out;
}

export function shapeWorkoutLog(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  if (!id) return null;
  const title = clip(r.workout_title, 180) ?? clip(r.title, 180) ?? "Workout";
  const dateTime = clip(r.date_time, 32) ?? "";
  const sourceRaw = r.workout_source;
  const source =
    sourceRaw === "daily_fix" || sourceRaw === "custom" ? sourceRaw : clip(sourceRaw, 40);
  const scaling =
    r.scaling_mode === "scaled" || r.scaling_mode === "rx" ? r.scaling_mode : null;
  return {
    id,
    workout_title: title,
    date_time: dateTime,
    calories_burned: finiteNum(r.calories_burned),
    activity_minutes: finiteNum(r.activity_minutes),
    workout_source: source,
    workout_source_id: posInt(r.workout_source_id),
    workout_free_text: clip(r.workout_free_text, 2000),
    scaling_mode: scaling,
    score_entries: shapeScoreEntries(r.score_entries),
    photo_url: httpsOrNull(r.photo_url),
  };
}

export function shapeWorkoutLogs(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["workouts", "items", "data"]);
  const workouts: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = shapeWorkoutLog(row);
    if (shaped) workouts.push(shaped);
    if (workouts.length >= 400) break;
  }
  return { workouts };
}

export function shapePlannedWorkout(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  const planDate = clip(r.plan_date, 10);
  if (!id || !planDate || !YMD.test(planDate)) return null;
  const sourceRaw = r.workout_source;
  const source = sourceRaw === "daily_fix" || sourceRaw === "custom" ? sourceRaw : null;
  if (!source) return null;
  return {
    id,
    plan_date: planDate,
    workout_source: source,
    workout_source_id: posInt(r.workout_source_id),
    logged: loggedFlag(r.logged),
    sort_order: finiteNum(r.sort_order),
    title: clip(r.title, 180) ?? clip(r.workout_title, 180),
  };
}

export function shapePlannedWorkouts(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["planned_workouts", "workouts", "items"]);
  const planned: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = shapePlannedWorkout(row);
    if (shaped) planned.push(shaped);
    if (planned.length >= 400) break;
  }
  return { planned_workouts: planned };
}

export function shapeCustomWorkout(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const nested = asRecord(obj.custom_workout) ?? asRecord(obj.workout) ?? obj;
  const id = posInt(nested.id ?? obj.id);
  const title = clip(nested.title, 180) ?? clip(obj.title, 180);
  if (!id || !title) return null;
  const shaped: Record<string, unknown> = {
    id,
    title,
    photo_url: httpsOrNull(nested.photo_url ?? obj.photo_url),
  };
  const excerpt = clip(nested.excerpt, 500);
  if (excerpt) shaped.excerpt = excerpt;
  const logging = typeof nested.logging_type === "string" ? nested.logging_type : "";
  if (LOGGING_TYPES.has(logging)) shaped.logging_type = logging;
  const structure = sanitizeWorkoutStructure(nested.structure);
  if (structure) shaped.structure = structure;
  const items = shapeWorkoutItems(nested.workout_items);
  if (items.length > 0) shaped.workout_items = items;
  return shaped;
}

const DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

export function validateLogWorkoutBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const title = clip(obj.workout_title, 180);
  if (!title) return { ok: false };
  const when = typeof obj.date_time === "string" ? obj.date_time.trim() : "";
  const match = DATE_TIME.exec(when);
  if (!match || !isRealYmd(match[1]!)) return { ok: false };
  const hh = match[2] ?? "12";
  const mm = match[3] ?? "00";
  const ss = match[4] ?? "00";
  const hour = Number(hh);
  const minute = Number(mm);
  const second = Number(ss);
  if (hour > 23 || minute > 59 || second > 59) return { ok: false };
  const body: Record<string, unknown> = {
    workout_title: title,
    date_time: `${match[1]} ${hh}:${mm}:${ss}`,
  };
  const note = clip(obj.workout_free_text, 2000);
  if (note) body.workout_free_text = note;
  if (obj.activity_minutes != null && obj.activity_minutes !== "") {
    const minutes = finiteNum(obj.activity_minutes);
    if (minutes == null || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440) {
      return { ok: false };
    }
    body.activity_minutes = minutes;
  }
  if (obj.calories_burned != null && obj.calories_burned !== "") {
    const calories = finiteNum(obj.calories_burned);
    if (calories == null || !Number.isSafeInteger(calories) || calories < 0 || calories > 20000) {
      return { ok: false };
    }
    body.calories_burned = calories;
  }
  if (obj.scaling_mode != null && obj.scaling_mode !== "") {
    if (obj.scaling_mode !== "rx" && obj.scaling_mode !== "scaled") return { ok: false };
    body.scaling_mode = obj.scaling_mode;
  }
  if (obj.daily_fix_date != null && obj.daily_fix_date !== "") {
    const day = typeof obj.daily_fix_date === "string" ? obj.daily_fix_date.trim() : "";
    if (!YMD.test(day) || !isRealYmd(day)) return { ok: false };
    body.daily_fix_date = day;
  }
  const occurrence = obj.occurrence_id;
  if (occurrence != null && occurrence !== "") {
    const id = posInt(occurrence);
    if (!id) return { ok: false };
    body.occurrence_id = id;
  }
  if (obj.workout_source != null && obj.workout_source !== "") {
    if (
      obj.workout_source !== "daily_fix" &&
      obj.workout_source !== "custom" &&
      obj.workout_source !== "favorite" &&
      obj.workout_source !== "affiliate"
    ) {
      return { ok: false };
    }
    body.workout_source = obj.workout_source;
    const sourceId = posInt(obj.workout_source_id);
    if (sourceId != null) body.workout_source_id = sourceId;
    if (obj.workout_source === "daily_fix" && sourceId == null && body.daily_fix_date == null) {
      return { ok: false };
    }
    if (obj.workout_source === "affiliate" && body.occurrence_id == null) return { ok: false };
  }
  if (obj.scores != null) {
    const scores = sanitizeScores(obj.scores);
    if (!scores) return { ok: false };
    if (scores.length > 0) body.scores = scores;
  }
  if (obj.movement_actuals != null) {
    const actuals = sanitizeMovementActuals(obj.movement_actuals);
    if (!actuals) return { ok: false };
    if (actuals.length > 0) body.movement_actuals = actuals;
  }
  if (obj.measurements != null) {
    const measurements = sanitizeMeasurements(obj.measurements);
    if (!measurements) return { ok: false };
    if (measurements.length > 0) body.measurements = measurements;
  }
  return { ok: true, body };
}

function personFrom(
  row: Record<string, unknown>,
  viewerIsCoach: boolean,
): { user_id: string; name: string | null; display_name: string | null } {
  const coach = asRecord(row.coach);
  const client = asRecord(row.client);
  const other = viewerIsCoach ? client : coach;
  const cp = asRecord(row.counterparty) ?? other ?? {};
  const uid =
    posInt(cp.user_id) ??
    posInt(cp.id) ??
    posInt(other?.user_id) ??
    posInt(other?.id) ??
    posInt(row.counterparty_user_id);
  const display =
    clip(cp.display_name, 120) ??
    clip(other?.display_name, 120) ??
    clip(row.display_name, 120);
  const name =
    clip(cp.name, 120) ??
    display ??
    clip(other?.name, 120) ??
    clip(row.name, 120);
  return {
    user_id: uid != null ? String(uid) : "",
    name,
    display_name: display,
  };
}

const RELATIONSHIP_STATUS = new Set(["pending", "active", "declined", "ended"]);

export function shapeRelationship(
  row: unknown,
  viewerIsCoach: boolean,
): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id ?? r.relationship_id);
  if (!id) return null;
  const statusRaw = typeof r.status === "string" ? r.status : "active";
  const status = RELATIONSHIP_STATUS.has(statusRaw) ? statusRaw : "active";
  const invited = r.invited_by === "coach" || r.invited_by === "client" ? r.invited_by : null;
  return {
    id,
    status,
    invited_by: invited,
    viewer_is_coach: viewerIsCoach,
    counterparty: personFrom(r, viewerIsCoach),
  };
}

function shapeAffiliate(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.affiliate_id ?? r.id);
  if (!id) return null;
  const name = clip(r.name, 160) ?? clip(r.display_name, 160) ?? "Gym";
  const count = finiteNum(r.member_count);
  return {
    affiliate_id: id,
    name,
    logo: httpsOrNull(r.logo ?? r.logo_url),
    member_count: count != null && Number.isSafeInteger(count) && count >= 0 ? count : null,
    group_conversation_id: posInt(r.group_conversation_id),
  };
}

export function shapeCoachingClient(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const affiliates = firstArray(obj, ["affiliates"])
    .map(shapeAffiliate)
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 40);
  const coaches = firstArray(obj, ["coaches", "relationships", "items", "data"])
    .map((row) => shapeRelationship(row, false))
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 80);
  return { affiliates, coaches };
}

export function shapeCoachingCoach(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const affiliates = firstArray(obj, ["affiliates"])
    .map(shapeAffiliate)
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 40);
  const clients = firstArray(obj, ["clients", "relationships", "items", "data"])
    .map((row) => shapeRelationship(row, true))
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 80);
  return { affiliates, clients };
}

export function shapeDirectory(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["trainers", "coaches", "entries", "items", "data"]);
  const trainers: Record<string, unknown>[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const uid = posInt(r.user_id ?? r.id ?? r.wp_user_id);
    if (!uid) continue;
    const coursesRaw = Array.isArray(r.completed_courses) ? r.completed_courses : [];
    const courses: string[] = [];
    for (const course of coursesRaw) {
      const name =
        typeof course === "string"
          ? clip(course, 80)
          : clip(asRecord(course)?.name, 80) ?? clip(asRecord(course)?.title, 80);
      if (name) courses.push(name);
      if (courses.length >= 4) break;
    }
    const count = finiteNum(r.completed_courses_count);
    trainers.push({
      user_id: String(uid),
      name: clip(r.name, 120),
      display_name: clip(r.display_name, 120),
      bio: clip(r.bio, 280) ?? clip(r.directory_bio, 280),
      search_excerpt: clip(r.search_excerpt, 280) ?? clip(r.directory_bio, 280),
      avatar: httpsOrNull(r.avatar ?? r.avatar_url ?? r.pfp_pic),
      completed_courses: courses,
      completed_courses_count:
        count != null && Number.isSafeInteger(count) && count >= 0 ? count : courses.length,
    });
    if (trainers.length >= 40) break;
  }
  return { trainers };
}

export function directoryQuery(params: URLSearchParams): string | null {
  const name = (params.get("name") ?? "").trim();
  if (name.length > 80) return null;
  const limitRaw = params.get("limit") ?? "20";
  const offsetRaw = params.get("offset") ?? "0";
  if (!/^\d+$/.test(limitRaw) || !/^\d+$/.test(offsetRaw)) return null;
  const limit = Number(limitRaw);
  const offset = Number(offsetRaw);
  if (limit < 1 || limit > 40 || offset < 0 || offset > 200) return null;
  const q = new URLSearchParams();
  if (name) q.set("name", name);
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  const sort = params.get("sort_by");
  if (sort === "name" || sort === "completed_courses") q.set("sort_by", sort);
  const order = params.get("sort_order");
  if (order === "asc" || order === "desc") q.set("sort_order", order);
  const course = params.get("course");
  if (course) {
    if (!/^[a-z0-9-]{1,40}$/i.test(course)) return null;
    q.set("course", course);
  }
  return q.toString();
}

export function validatePtInviteBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const uid = posInt(obj.counterparty_user_id);
  if (!uid) return { ok: false };
  if (obj.role !== "client_request" && obj.role !== "coach_invite") return { ok: false };
  return {
    ok: true,
    body: { counterparty_user_id: uid, role: obj.role },
  };
}

export function shapeCoachNote(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  const body = clip(r.body, 4000);
  if (!id || !body) return null;
  return {
    id,
    body,
    created_at: clip(r.created_at, 40),
  };
}

export function shapeCoachNotes(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = Array.isArray(raw) ? raw : firstArray(obj, ["notes", "items", "data"]);
  const notes: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = shapeCoachNote(row);
    if (shaped) notes.push(shaped);
    if (notes.length >= 50) break;
  }
  return { notes };
}

export function validateCoachNoteBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  const body = clip(obj?.body, 4000);
  if (!body) return { ok: false };
  return { ok: true, body: { body } };
}

export function shapeCoachProfile(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const visible = obj.directory_visible === true || obj.visible_in_directory === true;
  return {
    directory_visible: visible,
    bio: clip(obj.bio, 500) ?? clip(obj.directory_bio, 500),
  };
}

export function validateCoachProfileBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const body: Record<string, unknown> = {};
  if (obj.directory_visible != null) {
    if (typeof obj.directory_visible !== "boolean") return { ok: false };
    body.directory_visible = obj.directory_visible;
  }
  if (obj.bio != null) {
    if (typeof obj.bio !== "string") return { ok: false };
    body.bio = obj.bio.trim().slice(0, 500);
  }
  if (Object.keys(body).length === 0) return { ok: false };
  return { ok: true, body };
}

function shapeSeries(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  const title = clip(r.title, 180);
  if (!id || !title) return null;
  const status =
    r.status === "published" || r.status === "archived" || r.status === "draft" ? r.status : null;
  const access = r.access_mode === "free" || r.access_mode === "paid" ? r.access_mode : null;
  const subscribed =
    r.is_subscribed == null
      ? null
      : r.is_subscribed === true || r.is_subscribed === 1 || r.is_subscribed === "1";
  return {
    id,
    title,
    description: clip(r.description, 500),
    status,
    start_date: clip(r.start_date, 10),
    end_date: clip(r.end_date, 10),
    access_mode: access,
    is_subscribed: subscribed,
  };
}

export function shapeProgrammingSeriesList(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["series", "items"]);
  const series: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = shapeSeries(row);
    if (shaped) series.push(shaped);
    if (series.length >= 40) break;
  }
  return { series };
}

export function shapeProgrammingSubscriptions(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["subscriptions", "items"]);
  const subscriptions: Record<string, unknown>[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const id = posInt(r.id);
    const seriesId = posInt(r.series_id);
    if (!id || !seriesId) continue;
    const status =
      r.status === "active" ||
      r.status === "paused" ||
      r.status === "canceled" ||
      r.status === "expired"
        ? r.status
        : null;
    const source =
      r.source === "marketplace" ||
      r.source === "free" ||
      r.source === "admin" ||
      r.source === "owner_invite"
        ? r.source
        : null;
    subscriptions.push({
      id,
      series_id: seriesId,
      status,
      source,
      series_title: clip(r.series_title, 180),
      start_date: clip(r.start_date, 10),
      end_date: clip(r.end_date, 10),
      calendar_sync_enabled:
        r.calendar_sync_enabled === true ||
        r.calendar_sync_enabled === 1 ||
        r.calendar_sync_enabled === "1",
    });
    if (subscriptions.length >= 40) break;
  }
  return { subscriptions };
}

function shapeProgrammingItem(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  if (!id) return null;
  const itemType =
    r.item_type === "workout" || r.item_type === "meal" || r.item_type === "brain"
      ? r.item_type
      : null;
  return {
    id,
    item_type: itemType,
    label: clip(r.label, 180),
  };
}

export function shapeProgrammingDays(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["days", "items"]);
  const days: Record<string, unknown>[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const id = posInt(r.id);
    const date = clip(r.calendar_date, 10);
    if (!id || !date) continue;
    const items: Record<string, unknown>[] = [];
    const itemRows = Array.isArray(r.items) ? r.items : [];
    for (const item of itemRows) {
      const shaped = shapeProgrammingItem(item);
      if (shaped) items.push(shaped);
      if (items.length >= 20) break;
    }
    days.push({
      id,
      calendar_date: date,
      notes: clip(r.notes, 500),
      status: r.status === "draft" || r.status === "published" ? r.status : null,
      items,
    });
    if (days.length >= 60) break;
  }
  return { days };
}

function shapePlan(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id);
  const title = clip(r.title, 180);
  if (!id || !title) return null;
  const days = finiteNum(r.duration_days);
  return {
    id,
    title,
    duration_days: days != null && Number.isSafeInteger(days) && days > 0 ? days : null,
    status: r.status === "draft" || r.status === "published" ? r.status : null,
    is_active: r.is_active !== false && r.is_active !== 0 && r.is_active !== "0",
    usage_status: r.usage_status === "saved_only" || r.usage_status === "used" ? r.usage_status : null,
  };
}

function plansFromBucket(raw: unknown): Record<string, unknown>[] {
  const bucket = asRecord(raw) ?? {};
  const rows = [
    ...firstArray(bucket, ["saved_only"]),
    ...firstArray(bucket, ["used"]),
  ];
  const out: Record<string, unknown>[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const shaped = shapePlan(row);
    if (!shaped) continue;
    const id = shaped.id as number;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(shaped);
    if (out.length >= 40) break;
  }
  return out;
}

export function shapePlanLibrary(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  return {
    active: plansFromBucket(obj.active),
    inactive: plansFromBucket(obj.inactive),
  };
}

const LOGGING_TYPES = new Set([
  "time",
  "reps",
  "score",
  "calories",
  "distance",
  "completion",
  "weight_max",
  "weight_sum",
  "weight_min",
  "rounds",
]);

const SEGMENT_PRESETS = new Set([
  "straight",
  "rounds",
  "chipper",
  "amrap",
  "emom",
  "alternating_emom",
  "tabata",
]);

const LOGGABLE_DIMS = new Set([
  "weight",
  "reps",
  "time",
  "distance",
  "calories",
  "inches",
  "bodyweight_adjustment",
]);

const WEIGHT_UNITS = new Set([1, 2, 20]);
/** Reps and load ceiling. Scientific form keeps the legacy pricing literal out of source. */
const COUNT_CAP = 1e5;
/** Distance, score, and measurement ceiling. */
const MEASURE_CAP = 1e6;

function boundedNum(
  v: unknown,
  min: number,
  max: number,
  integer: boolean,
): number | null | undefined {
  if (v == null || v === "") return undefined;
  const n = finiteNum(v);
  if (n == null || n < min || n > max) return null;
  if (integer && !Number.isSafeInteger(n)) return null;
  return n;
}

function sanitizePrescription(raw: unknown): Record<string, unknown> | null | undefined {
  if (raw == null) return undefined;
  const r = asRecord(raw);
  if (!r) return null;
  const out: Record<string, unknown> = {};
  const pairs: Array<[string, number, number, boolean]> = [
    ["reps", 0, COUNT_CAP, true],
    ["distance_m", 0, MEASURE_CAP, false],
    ["duration_sec", 0, 86400, true],
    ["weight", 0, COUNT_CAP, false],
    ["calories", 0, 20000, true],
    ["inches", 0, 200, false],
    ["bodyweight_adjustment", -500, 500, false],
  ];
  for (const [key, min, max, integer] of pairs) {
    if (r[key] == null || r[key] === "") continue;
    const n = boundedNum(r[key], min, max, integer);
    if (n == null) return null;
    out[key] = n;
  }
  if (out.weight != null || out.bodyweight_adjustment != null) {
    const unitKey = out.weight != null ? "weight_unit_id" : "bodyweight_adjustment_unit_id";
    const unit = posInt(r[unitKey] ?? r.weight_unit_id);
    if (unit == null || !WEIGHT_UNITS.has(unit)) return null;
    if (out.weight != null) out.weight_unit_id = unit;
    if (out.bodyweight_adjustment != null) {
      const adj = posInt(r.bodyweight_adjustment_unit_id ?? r.weight_unit_id);
      if (adj == null || !WEIGHT_UNITS.has(adj)) return null;
      out.bodyweight_adjustment_unit_id = adj;
    }
  }
  const mode = r.duration_rx_mode;
  if (mode != null && mode !== "") {
    if (mode !== "segment_cap" && mode !== "cumulative") return null;
    out.duration_rx_mode = mode;
  }
  return out;
}

function sanitizeLoggable(raw: unknown): Record<string, unknown> | null | undefined {
  if (raw == null) return undefined;
  const r = asRecord(raw);
  if (!r) return null;
  const allow = Array.isArray(r.allow)
    ? r.allow.filter((dim): dim is string => typeof dim === "string" && LOGGABLE_DIMS.has(dim))
    : [];
  const require = Array.isArray(r.require)
    ? r.require.filter((dim): dim is string => typeof dim === "string" && LOGGABLE_DIMS.has(dim))
    : [];
  if (require.some((dim) => !allow.includes(dim))) return null;
  const out: Record<string, unknown> = {};
  if (allow.length > 0) out.allow = allow.slice(0, 7);
  if (require.length > 0) out.require = require.slice(0, 7);
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeSegmentParams(
  preset: string,
  raw: unknown,
): Record<string, unknown> | null | undefined {
  const r = asRecord(raw) ?? {};
  const cap = boundedNum(r.time_cap_seconds ?? r.duration_sec, 1, 86400, true);
  if (cap === null) return null;
  if (preset === "straight" || preset === "chipper") {
    return cap != null ? { time_cap_seconds: cap } : undefined;
  }
  if (preset === "rounds") {
    const count = boundedNum(r.round_count ?? r.rounds, 1, 500, true);
    if (count == null) return null;
    return { round_count: count, ...(cap != null ? { time_cap_seconds: cap } : {}) };
  }
  if (preset === "amrap") {
    if (cap == null) return null;
    return { time_cap_seconds: cap };
  }
  if (preset === "emom" || preset === "alternating_emom") {
    const minutes = boundedNum(r.duration_minutes ?? r.minutes, 1, 180, true);
    if (minutes == null) return null;
    return { duration_minutes: minutes };
  }
  const work = boundedNum(r.work_seconds, 0, 3600, true);
  const rest = boundedNum(r.rest_seconds, 0, 3600, true);
  const rounds = boundedNum(r.interval_rounds ?? r.rounds, 1, 200, true);
  if (work == null || rest == null || rounds == null) return null;
  return { work_seconds: work, rest_seconds: rest, interval_rounds: rounds };
}

function sanitizeWorkoutStructure(raw: unknown): Record<string, unknown> | null {
  const r = asRecord(raw);
  if (!r || r.version !== 1 || !Array.isArray(r.segments) || r.segments.length === 0) return null;
  if (r.segments.length > 12) return null;
  const segments: Record<string, unknown>[] = [];
  for (const segRaw of r.segments) {
    const seg = asRecord(segRaw);
    if (!seg) return null;
    const id = typeof seg.id === "string" ? seg.id.trim() : "";
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) return null;
    const preset = typeof seg.preset === "string" ? seg.preset : "";
    if (!SEGMENT_PRESETS.has(preset)) return null;
    const params = sanitizeSegmentParams(preset, seg.params);
    if (params === null) return null;
    if (!Array.isArray(seg.steps) || seg.steps.length < 1 || seg.steps.length > 40) return null;
    const steps: Record<string, unknown>[] = [];
    for (const stepRaw of seg.steps) {
      const step = asRecord(stepRaw);
      if (!step) return null;
      const movementId = posInt(step.movement_id);
      const order = boundedNum(step.order, 0, 500, true);
      if (!movementId || order == null) return null;
      const prescription = sanitizePrescription(step.prescription);
      const female = sanitizePrescription(step.prescription_female);
      const loggable = sanitizeLoggable(step.loggable);
      if (prescription === null || female === null || loggable === null) return null;
      const next: Record<string, unknown> = { movement_id: movementId, order };
      const label = clip(step.label, 120);
      if (label) next.label = label;
      const movementName = clip(step.movement_name, 120);
      if (movementName) next.movement_name = movementName;
      if (prescription && Object.keys(prescription).length > 0) next.prescription = prescription;
      if (female && Object.keys(female).length > 0) next.prescription_female = female;
      if (loggable) next.loggable = loggable;
      if (Array.isArray(step.scaling_movement_ids)) {
        const ids = step.scaling_movement_ids.map(posInt).filter((n): n is number => n != null);
        if (ids.length > 0) next.scaling_movement_ids = [...new Set(ids)].slice(0, 8);
      }
      steps.push(next);
    }
    segments.push({ id, preset, ...(params ? { params } : {}), steps });
  }
  return { version: 1, segments };
}

function shapeWorkoutItems(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const row of raw) {
    const r = asRecord(row);
    if (!r) continue;
    const id = posInt(r.workout_item_id ?? r.id);
    const field = clip(r.scoring_field, 40) ?? clip(r.logging_type, 40);
    if (!id || !field) continue;
    const logging = typeof r.logging_type === "string" && LOGGING_TYPES.has(r.logging_type)
      ? r.logging_type
      : null;
    const direction =
      r.scoring_direction === "higher_better" || r.scoring_direction === "lower_better"
        ? r.scoring_direction
        : null;
    out.push({
      workout_item_id: id,
      logging_type: logging,
      scoring_direction: direction,
      scoring_field: field,
      title: clip(r.title, 180),
      mirror_measurement_id: posInt(r.mirror_measurement_id),
    });
    if (out.length >= 12) break;
  }
  return out;
}

function sanitizeScores(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 12) return null;
  const out: Record<string, unknown>[] = [];
  for (const row of raw) {
    const r = asRecord(row);
    if (!r) return null;
    const scoreType = clip(r.score_type, 40);
    const value = finiteNum(r.score_value);
    if (!scoreType || value == null || value < 0 || value > MEASURE_CAP) return null;
    const next: Record<string, unknown> = { score_type: scoreType, score_value: value };
    const item = posInt(r.workout_item_id);
    if (r.workout_item_id != null && r.workout_item_id !== "" && !item) return null;
    if (item) next.workout_item_id = item;
    if (r.scoring_direction != null && r.scoring_direction !== "") {
      if (r.scoring_direction !== "higher_better" && r.scoring_direction !== "lower_better") {
        return null;
      }
      next.scoring_direction = r.scoring_direction;
    }
    if (r.score_unit_id != null && r.score_unit_id !== "") {
      const unit = posInt(r.score_unit_id);
      if (unit !== 1 && unit !== 2) return null;
      next.score_unit_id = unit;
    }
    out.push(next);
  }
  return out;
}

function sanitizeMovementActuals(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 40) return null;
  const out: Record<string, unknown>[] = [];
  const numeric: Array<[string, number, number, boolean]> = [
    ["weight", 0, COUNT_CAP, false],
    ["reps", 0, COUNT_CAP, true],
    ["time_sec", 0, 86400, true],
    ["distance_m", 0, MEASURE_CAP, false],
    ["calories", 0, 20000, true],
    ["inches", 0, 200, false],
    ["bodyweight_adjustment", -500, 500, false],
  ];
  for (const row of raw) {
    const r = asRecord(row);
    if (!r) return null;
    const movementId = posInt(r.movement_id);
    if (!movementId) return null;
    const next: Record<string, unknown> = { movement_id: movementId };
    const segment = clip(r.segment_id, 40);
    if (segment) next.segment_id = segment;
    const order = boundedNum(r.step_order, 0, 500, true);
    if (order === null) return null;
    if (order != null) next.step_order = order;
    for (const [key, min, max, integer] of numeric) {
      if (r[key] == null || r[key] === "") continue;
      const n = boundedNum(r[key], min, max, integer);
      if (n == null) return null;
      next[key] = n;
    }
    if (next.weight != null) {
      const unit = posInt(r.weight_unit_id);
      next.weight_unit_id = unit != null && WEIGHT_UNITS.has(unit) ? unit : 1;
    }
    if (typeof r.unbroken === "boolean") next.unbroken = r.unbroken;
    out.push(next);
  }
  return out;
}

function sanitizeMeasurements(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 20) return null;
  const out: Record<string, unknown>[] = [];
  for (const row of raw) {
    const r = asRecord(row);
    if (!r) return null;
    const id = posInt(r.measurement_id);
    const value = finiteNum(r.value);
    if (!id || value == null || value < 0 || value > MEASURE_CAP) return null;
    const next: Record<string, unknown> = { measurement_id: id, value };
    if (r.unit_id != null && r.unit_id !== "") {
      const unit = posInt(r.unit_id);
      if (!unit) return null;
      next.unit_id = unit;
    }
    out.push(next);
  }
  return out;
}

export function shapeCustomWorkoutList(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["workouts", "items", "data"]);
  const workouts: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = shapeCustomWorkout(row);
    if (shaped) workouts.push(shaped);
    if (workouts.length >= 40) break;
  }
  return { workouts };
}

export function customWorkoutListQuery(params: URLSearchParams): string | null {
  const limitRaw = params.get("limit") ?? "20";
  const offsetRaw = params.get("offset") ?? "0";
  if (!/^\d+$/.test(limitRaw) || !/^\d+$/.test(offsetRaw)) return null;
  const limit = Number(limitRaw);
  const offset = Number(offsetRaw);
  if (limit < 1 || limit > 40 || offset < 0 || offset > 200) return null;
  const owner = params.get("owner_id");
  if (owner != null && owner !== "" && owner !== "me") return null;
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  if (owner === "me") q.set("owner_id", "me");
  if (params.get("is_benchmark") === "1") q.set("is_benchmark", "1");
  return q.toString();
}

export function validateCustomWorkoutBody(
  raw: unknown,
  mode: "create" | "update",
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const title = clip(obj.title, 180);
  if (mode === "create" && !title) return { ok: false };
  const body: Record<string, unknown> = {};
  if (title) body.title = title;
  if (obj.excerpt != null) {
    if (typeof obj.excerpt !== "string") return { ok: false };
    const excerpt = obj.excerpt.trim();
    if (excerpt) body.excerpt = excerpt.slice(0, 500);
  }
  if (obj.body != null) {
    if (typeof obj.body !== "string") return { ok: false };
    const notes = obj.body.trim();
    if (notes) body.body = notes.slice(0, 8000);
  }
  if (obj.logging_type != null && obj.logging_type !== "") {
    if (typeof obj.logging_type !== "string" || !LOGGING_TYPES.has(obj.logging_type)) {
      return { ok: false };
    }
    body.logging_type = obj.logging_type;
  }
  if (obj.structure != null) {
    const structure = sanitizeWorkoutStructure(obj.structure);
    if (!structure) return { ok: false };
    body.structure = structure;
  } else if (mode === "create") {
    return { ok: false };
  }
  if (obj.mirror_measurement_id === null) {
    body.mirror_measurement_id = null;
  } else if (obj.mirror_measurement_id != null && obj.mirror_measurement_id !== "") {
    const id = posInt(obj.mirror_measurement_id);
    if (!id) return { ok: false };
    body.mirror_measurement_id = id;
  }
  if (Object.keys(body).length === 0) return { ok: false };
  return { ok: true, body };
}

export function movementQuery(params: URLSearchParams): string | null {
  const search = (params.get("search") ?? "").trim();
  if (search.length > 80) return null;
  const limitRaw = params.get("limit") ?? "20";
  const offsetRaw = params.get("offset") ?? "0";
  if (!/^\d+$/.test(limitRaw) || !/^\d+$/.test(offsetRaw)) return null;
  const limit = Number(limitRaw);
  const offset = Number(offsetRaw);
  if (limit < 1 || limit > 40 || offset < 0 || offset > 200) return null;
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  if (search) q.set("search", search);
  return q.toString();
}

export function shapeMovementList(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["movements", "items", "data"]);
  const movements: Record<string, unknown>[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const id = posInt(r.id);
    const name = clip(r.name, 120);
    if (!id || !name) continue;
    movements.push({
      id,
      name,
      category: clip(r.category, 40),
    });
    if (movements.length >= 40) break;
  }
  return { movements };
}

const PLAN_VISIBILITY = new Set(["public", "unlisted", "invite_only"]);
const PLAN_ITEM = new Set(["meal", "workout", "brain"]);

function sanitizePlanItem(raw: unknown): Record<string, unknown> | null {
  const r = asRecord(raw);
  if (!r || typeof r.item_type !== "string" || !PLAN_ITEM.has(r.item_type)) return null;
  const item: Record<string, unknown> = { item_type: r.item_type };
  const order = boundedNum(r.sort_order, 0, 40, true);
  if (order === null) return null;
  if (order != null) item.sort_order = order;
  const label = clip(r.label, 180);
  if (label) item.label = label;
  if (r.relative_to_schedule_date === true) item.relative_to_schedule_date = true;
  if (r.item_type === "workout") {
    if (r.workout_source != null && r.workout_source !== "") {
      if (r.workout_source !== "daily_fix" && r.workout_source !== "custom") return null;
      item.workout_source = r.workout_source;
    }
    const sourceId = posInt(r.workout_source_id);
    if (r.workout_source_id != null && r.workout_source_id !== "" && !sourceId) return null;
    if (sourceId) item.workout_source_id = sourceId;
    if (item.workout_source === "custom" && !sourceId) return null;
    if (item.workout_source === "daily_fix" && !sourceId && item.relative_to_schedule_date !== true) {
      return null;
    }
  }
  if (r.item_type === "meal") {
    if (r.recipe_source_type != null && r.recipe_source_type !== "") {
      if (r.recipe_source_type !== "daily_mod" && r.recipe_source_type !== "custom_recipe") {
        return null;
      }
      item.recipe_source_type = r.recipe_source_type;
    }
    const recipeId = posInt(r.recipe_source_id);
    if (r.recipe_source_id != null && r.recipe_source_id !== "" && !recipeId) return null;
    if (recipeId) item.recipe_source_id = recipeId;
    const servings = boundedNum(r.servings, 0, 20, false);
    if (servings === null) return null;
    if (servings != null) item.servings = servings;
  }
  if (r.item_type === "brain") {
    if (r.brain_source_type != null && r.brain_source_type !== "") {
      if (
        r.brain_source_type !== "daily_article" &&
        r.brain_source_type !== "wp_post" &&
        r.brain_source_type !== "course"
      ) {
        return null;
      }
      item.brain_source_type = r.brain_source_type;
    }
    const brainId = posInt(r.brain_source_id);
    if (r.brain_source_id != null && r.brain_source_id !== "" && !brainId) return null;
    if (brainId) item.brain_source_id = brainId;
    if (
      item.brain_source_type != null &&
      item.brain_source_type !== "daily_article" &&
      !brainId
    ) {
      return null;
    }
  }
  return item;
}

export function validatePlanWriteBody(
  raw: unknown,
  mode: "create" | "update",
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const title = clip(obj.title, 180);
  if (mode === "create" && !title) return { ok: false };
  const body: Record<string, unknown> = {};
  if (title) body.title = title;
  if (obj.description != null) {
    if (typeof obj.description !== "string") return { ok: false };
    const description = obj.description.trim();
    if (description) body.description = description.slice(0, 2000);
  }
  if (obj.duration_days != null && obj.duration_days !== "") {
    const days = boundedNum(obj.duration_days, 1, 90, true);
    if (days == null) return { ok: false };
    body.duration_days = days;
  } else if (mode === "create") {
    return { ok: false };
  }
  if (obj.visibility != null && obj.visibility !== "") {
    if (typeof obj.visibility !== "string" || !PLAN_VISIBILITY.has(obj.visibility)) return { ok: false };
    body.visibility = obj.visibility;
  }
  if (obj.status != null && obj.status !== "") {
    if (obj.status !== "draft" && obj.status !== "published") return { ok: false };
    body.status = obj.status;
  }
  if (obj.replace_days != null) {
    if (typeof obj.replace_days !== "boolean") return { ok: false };
    body.replace_days = obj.replace_days;
  }
  if (obj.days != null) {
    if (!Array.isArray(obj.days) || obj.days.length > 90) return { ok: false };
    const days: Record<string, unknown>[] = [];
    for (const dayRaw of obj.days) {
      const day = asRecord(dayRaw);
      if (!day) return { ok: false };
      const index = boundedNum(day.day_index, 0, 89, true);
      if (index == null) return { ok: false };
      const next: Record<string, unknown> = { day_index: index };
      const notes = clip(day.notes, 500);
      if (notes) next.notes = notes;
      if (day.items != null) {
        if (!Array.isArray(day.items) || day.items.length > 12) return { ok: false };
        const items: Record<string, unknown>[] = [];
        for (const itemRaw of day.items) {
          const item = sanitizePlanItem(itemRaw);
          if (!item) return { ok: false };
          items.push(item);
        }
        next.items = items;
      }
      days.push(next);
    }
    body.days = days;
  }
  if (Object.keys(body).length === 0) return { ok: false };
  return { ok: true, body };
}

function shapePlanItem(raw: unknown): Record<string, unknown> | null {
  const item = sanitizePlanItem(raw);
  if (!item) return null;
  const r = asRecord(raw);
  const id = posInt(r?.id);
  if (id) item.id = id;
  return item;
}

export function shapePlanDetail(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  const nested = asRecord(obj?.plan) ?? obj;
  if (!nested) return null;
  const id = posInt(nested.id);
  const title = clip(nested.title, 180);
  if (!id || !title) return null;
  const daysRaw = Array.isArray(nested.days) ? nested.days : [];
  const days: Record<string, unknown>[] = [];
  for (const dayRaw of daysRaw) {
    const day = asRecord(dayRaw);
    if (!day) continue;
    const dayId = posInt(day.id);
    const index = boundedNum(day.day_index, 0, 89, true);
    if (index == null) continue;
    const items = (Array.isArray(day.items) ? day.items : [])
      .map(shapePlanItem)
      .filter((row): row is Record<string, unknown> => row != null)
      .slice(0, 12);
    days.push({
      ...(dayId ? { id: dayId } : {}),
      day_index: index,
      notes: clip(day.notes, 500),
      items,
    });
    if (days.length >= 90) break;
  }
  const duration = boundedNum(nested.duration_days, 1, 90, true);
  const creator = asRecord(nested.creator);
  return {
    id,
    title,
    description: clip(nested.description, 2000),
    duration_days: duration ?? null,
    visibility: PLAN_VISIBILITY.has(String(nested.visibility)) ? nested.visibility : "invite_only",
    status: nested.status === "draft" || nested.status === "published" ? nested.status : null,
    is_active: nested.is_active !== false && nested.is_active !== 0 && nested.is_active !== "0",
    can_edit: nested.can_edit !== false,
    creator: {
      display_name: clip(creator?.display_name, 120),
    },
    days,
  };
}

export function shapePlanList(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const rows = firstArray(obj, ["plans", "items", "data"]);
  const plans: Record<string, unknown>[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const shaped = shapePlanDetail({ ...rec, days: [] });
    if (!shaped) continue;
    plans.push(shaped);
    if (plans.length >= 40) break;
  }
  return { plans };
}

export function planScheduleQuery(params: URLSearchParams): string | null {
  const start = params.get("start_date") ?? "";
  if (!YMD.test(start) || !isRealYmd(start)) return null;
  const q = new URLSearchParams();
  q.set("start_date", start);
  const end = params.get("end_date");
  if (end) {
    if (!YMD.test(end) || !isRealYmd(end) || end < start) return null;
    q.set("end_date", end);
  }
  const target = params.get("target_user_id");
  if (target) {
    if (!/^[1-9][0-9]{0,9}$/.test(target)) return null;
    q.set("target_user_id", target);
  }
  return q.toString();
}

export function validatePlanActiveBody(
  raw: unknown,
): { ok: true; body: { is_active: boolean } } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj || typeof obj.is_active !== "boolean") return { ok: false };
  return { ok: true, body: { is_active: obj.is_active } };
}

export function dailyFixQuery(params: URLSearchParams): string | null {
  const date = params.get("date") ?? "";
  if (!YMD.test(date) || !isRealYmd(date)) return null;
  return `date=${date}`;
}

export function shapeSparkUserInfo(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const nested = asRecord(obj.user) ?? obj;
  const gender =
    nested.training_gender === "male" || nested.training_gender === "female"
      ? nested.training_gender
      : null;
  const unit =
    nested.weight_display_unit === "lb" || nested.weight_display_unit === "kg"
      ? nested.weight_display_unit
      : null;
  return { training_gender: gender, weight_display_unit: unit };
}

export function shapeDailyFixWorkout(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const body = asRecord(obj.body) ?? obj;
  const date = clip(obj.date, 10);
  return {
    date: date && YMD.test(date) ? date : null,
    title: clip(body.title, 180),
    workout_id: posInt(body.id),
    custom_workout_id: posInt(body.custom_workout_id),
  };
}
