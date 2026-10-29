export type LtvBudgetSummary = {
  total_ltv_cents: number;
  claimed_courses_value_cents: number;
  available_certificate_ltv_cents: number;
  utilization_percent: number; // integer 0..100 for segmented progress bar
};

export type CourseCertificateEligibility =
  | { status: "claimed"; method: "ltv" | "direct_purchase" | null }
  | { status: "eligible_direct_purchase" } // purchased_directly === true && completed
  | { status: "eligible_ltv"; required_cents: number; remaining_after_claim_cents: number }
  | {
      status: "insufficient_ltv";
      required_cents: number;
      available_cents: number;
      shortfall_cents: number;
    }
  | { status: "incomplete"; required_cents: number; shortfall_cents: number };

/** Non-negative safe-integer cents; rejects floats, NaN, negatives. */
export function toNonNegativeSafeCents(n: unknown): number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
    throw new Error("invalid_cents");
  }
  return n;
}

export function computeLtvBudget(
  totalLtvCents: number,
  claimedCoursesValueCents: number,
): LtvBudgetSummary {
  const total = toNonNegativeSafeCents(totalLtvCents);
  const claimed = toNonNegativeSafeCents(claimedCoursesValueCents);
  const available = Math.max(0, total - claimed);
  const utilization =
    total > 0 ? Math.min(100, Math.round((Math.min(claimed, total) * 100) / total)) : 0;
  return {
    total_ltv_cents: total,
    claimed_courses_value_cents: claimed,
    available_certificate_ltv_cents: available,
    utilization_percent: utilization,
  };
}

export type CourseCertificateEvalInput = {
  course_price_cents: number;
  completed: boolean;
  certificate_claimed: boolean;
  claim_method?: "ltv" | "direct_purchase" | null;
  purchased_directly?: boolean;
};

/**
 * Pure course certificate eligibility against available LTV budget (DP-CERT-1..5).
 * Direct-purchase courses allocate 0 cents against claimed_courses_value_cents.
 */
export function evaluateCourseCertificateEligibility(
  course: CourseCertificateEvalInput,
  availableCertificateLtvCents: number,
): CourseCertificateEligibility {
  const required = toNonNegativeSafeCents(course.course_price_cents);
  const available = toNonNegativeSafeCents(availableCertificateLtvCents);

  if (course.certificate_claimed) {
    const method = course.claim_method === "ltv" || course.claim_method === "direct_purchase"
      ? course.claim_method
      : null;
    return { status: "claimed", method };
  }

  if (!course.completed) {
    return {
      status: "incomplete",
      required_cents: required,
      shortfall_cents: Math.max(0, required - available),
    };
  }

  if (course.purchased_directly === true) {
    return { status: "eligible_direct_purchase" };
  }

  if (available >= required) {
    return {
      status: "eligible_ltv",
      required_cents: required,
      remaining_after_claim_cents: available - required,
    };
  }

  return {
    status: "insufficient_ltv",
    required_cents: required,
    available_cents: available,
    shortfall_cents: required - available,
  };
}

/** Leaf USD formatter — always two decimal places (`$300.00`, `$100.50`). */
export function formatUsdFromCents(cents: number): string {
  const n = toNonNegativeSafeCents(cents);
  const dollars = Math.floor(n / 100);
  const rem = n % 100;
  return `$${dollars}.${String(rem).padStart(2, "0")}`;
}
