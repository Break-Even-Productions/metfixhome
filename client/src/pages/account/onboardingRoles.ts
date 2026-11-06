import {
  ONBOARDING_ROLES,
  type RoleId,
} from "@shared/join/membership-domain";

/** Short labels for dashboard pills / settings (opt-in audience attrs). */
export const ONBOARDING_ROLE_SHORT: Record<RoleId, string> = {
  individual: "Individual",
  coach: "Coach",
  gym_owner: "Gym Owner",
  first_responder: "First Responder",
  clinician: "Clinician",
};

export function onboardingRoleLabel(id: RoleId): string {
  return ONBOARDING_ROLE_SHORT[id] ?? id;
}

export function onboardingRoleOptions() {
  return ONBOARDING_ROLES.map((role) => ({
    id: role.id,
    title: ONBOARDING_ROLE_SHORT[role.id],
    description: role.description,
  }));
}
