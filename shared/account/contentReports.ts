/**
 * UGC content reports (`metfix/v1/content-reports`).
 * The list screen reports `user_list`, matching the MetFix app overflow menu.
 */

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;

export const CONTENT_REPORT_TYPES = [
  "challenge",
  "challenge_feed_post",
  "challenge_feed_comment",
  "challenge_checkin",
  "daily_fix_comment",
  "affiliate_feed_post",
  "affiliate_feed_comment",
  "custom_workout",
  "workout_log",
  "custom_recipe",
  "user_list",
  "meal_plan",
  "shopping_list",
  "resource_comment",
  "course_comment",
  "messaging_message",
  "member_profile",
  "workout_plan",
  "med_showcase",
] as const;

export type ContentReportType = (typeof CONTENT_REPORT_TYPES)[number];

export const CONTENT_REPORT_REASONS = [
  { code: "spam", label: "Spam" },
  { code: "harassment", label: "Harassment or bullying" },
  { code: "hate", label: "Hate speech" },
  { code: "violence", label: "Violence or threats" },
  { code: "nudity", label: "Nudity or sexual content" },
  { code: "misinformation", label: "Misinformation" },
  { code: "copyright", label: "Copyright violation" },
  { code: "other", label: "Other" },
] as const;

export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number]["code"];

export type ContentReportReceipt = {
  id: number;
  content_type: ContentReportType;
  content_id: number;
  status: string;
};

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false };

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function plain(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const text = v
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, max);
}

function positiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return v;
  if (typeof v === "string" && POSITIVE_INT.test(v)) return Number(v);
  return null;
}

export function parseContentReportBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  const contentType = obj.content_type;
  if (
    typeof contentType !== "string" ||
    !(CONTENT_REPORT_TYPES as readonly string[]).includes(contentType)
  ) {
    return { ok: false };
  }
  const contentId = positiveInt(obj.content_id);
  if (contentId == null) return { ok: false };
  const reason = obj.reason_code;
  if (
    typeof reason !== "string" ||
    !CONTENT_REPORT_REASONS.some((row) => row.code === reason)
  ) {
    return { ok: false };
  }
  const body: Record<string, unknown> = {
    content_type: contentType,
    content_id: contentId,
    reason_code: reason,
    platform: "web",
  };
  if (obj.note != null && obj.note !== "") {
    const note = plain(obj.note, 2000);
    if (!note) return { ok: false };
    body.note = note;
  }
  return { ok: true, value: body };
}

export function shapeContentReport(json: unknown): ContentReportReceipt | null {
  const obj = asRecord(json);
  if (!obj) return null;
  const id = positiveInt(obj.report_id) ?? positiveInt(obj.id);
  const contentId = positiveInt(obj.content_id);
  const contentType = obj.content_type;
  const status = obj.status;
  if (id == null || contentId == null) return null;
  if (
    typeof contentType !== "string" ||
    !(CONTENT_REPORT_TYPES as readonly string[]).includes(contentType)
  ) {
    return null;
  }
  if (typeof status !== "string" || !/^[a-z_]{1,32}$/.test(status)) return null;
  return {
    id,
    content_type: contentType as ContentReportType,
    content_id: contentId,
    status,
  };
}
