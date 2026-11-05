import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampJoinDeepLink,
  facilityFlagsForRoles,
  parseJoinStepParam,
  resolveJoinStepTransition,
  type RoleId,
} from "@shared/join";
import { loadMe } from "@/lib/session";
import { fetchCsrf, postOnboarding } from "./api";
import { emptyProfile } from "./data";
import { AuthScreen } from "./screens/AuthScreen";
import { ConditionalScreen } from "./screens/ConditionalScreen";
import { AffiliateApplicationScreen } from "./screens/AffiliateApplicationScreen";
import { NameScreen, validateNamePart } from "./screens/NameScreen";
import { RecommendedPath } from "./screens/RecommendedPath";
import { RolesScreen } from "./screens/RolesScreen";
import type { AuthView, JoinProfile, JoinStep } from "./types";
import { JoinShell } from "./ui";
import "./join.css";

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type JoinFlowProps = {
  open: boolean;
  onClose: () => void;
  initialStep?: JoinStep;
  /** WJ15: element to restore focus to when the modal closes. */
  returnFocusTo?: HTMLElement | null;
};

function fingerprintOnboarding(profile: JoinProfile): string {
  const flags = facilityFlagsForRoles(
    profile.roles,
    profile.hasPhysicalGym,
    profile.hasPhysicalClinic,
  );
  return JSON.stringify({
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    roles: [...profile.roles].sort(),
    has_physical_gym: flags.has_physical_gym,
    has_physical_clinic: flags.has_physical_clinic,
  });
}

export function JoinFlow({
  open,
  onClose,
  initialStep,
  returnFocusTo = null,
}: JoinFlowProps) {
  const [step, setStep] = useState<JoinStep>("auth");
  const [authView, setAuthView] = useState<AuthView>("choose");
  const [profile, setProfile] = useState<JoinProfile>(emptyProfile);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  const lastSavedFp = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSessionReady(false);
    let cancelled = false;
    (async () => {
      const me = await loadMe();
      if (cancelled) return;
      const signedIn = me.status === "signed_in";
      setIsSignedIn(signedIn);
      const params = new URLSearchParams(window.location.search);
      const resumeStep = parseJoinStepParam(params.get("step"));

      let nextRoles: RoleId[] = [];
      setProfile((prev) => {
        const next = { ...emptyProfile, ...prev };
        if (signedIn && me.status === "signed_in") {
          const parts = me.public_name.split(/\s+/).filter(Boolean);
          if (!next.firstName && parts[0]) next.firstName = parts[0];
          if (!next.lastName && parts.length > 1)
            next.lastName = parts.slice(1).join(" ");
        }
        nextRoles = next.roles;
        return next;
      });

      const requested = initialStep ?? resumeStep;
      setStep(
        clampJoinDeepLink(requested, {
          isSignedIn: signedIn,
          roles: nextRoles,
        }),
      );
      setAuthView("choose");
      setDirection(1);
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialStep]);

  const update = (patch: Partial<JoinProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  const go = (next: JoinStep, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setStep(next);
  };

  const advanceFrom = async (from: JoinStep) => {
    if (savingRef.current) return;
    const next = resolveJoinStepTransition(from, 1, {
      isSignedIn,
      roles: profile.roles,
    });
    if (!next) return;

    if (next === "path") {
      const fp = fingerprintOnboarding(profile);
      if (lastSavedFp.current !== fp) {
        savingRef.current = true;
        setSaving(true);
        setOnboardingError(null);
        try {
          const csrf = await fetchCsrf();
          if (!csrf) {
            setOnboardingError("Could not save your answers. Try again.");
            return;
          }
          const flags = facilityFlagsForRoles(
            profile.roles,
            profile.hasPhysicalGym,
            profile.hasPhysicalClinic,
          );
          const result = await postOnboarding(
            {
              first_name: profile.firstName.trim(),
              last_name: profile.lastName.trim(),
              roles: profile.roles,
              has_physical_gym: flags.has_physical_gym,
              has_physical_clinic: flags.has_physical_clinic,
            },
            csrf,
          );
          if (!result.ok) {
            setOnboardingError("Could not save your answers. Try again.");
            return;
          }
          lastSavedFp.current = fp;
          update({ completed: true });
        } catch {
          setOnboardingError("Could not save your answers. Try again.");
          return;
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }
    }
    go(next, 1);
  };

  const progress = useMemo(() => {
    const map: Record<JoinStep, number> = {
      auth: 0.15,
      intent: 0.15,
      name: 0.4,
      roles: 0.7,
      conditional: 0.85,
      path: 1,
      affiliate: 1,
    };
    return map[step];
  }, [step]);

  const back = () => {
    if (step === "auth" && authView !== "choose") {
      setAuthView("choose");
      return;
    }
    const prev = resolveJoinStepTransition(step, -1, {
      isSignedIn,
      roles: profile.roles,
    });
    if (prev) go(prev, -1);
  };

  if (!open) return null;

  const showProgress = step !== "path" && step !== "affiliate";
  const hideBack =
    !sessionReady ||
    step === "name" ||
    step === "path" ||
    (step === "auth" && authView === "choose");

  return (
    <JoinShell
      onClose={onClose}
      onBack={hideBack ? undefined : back}
      progress={showProgress ? progress : undefined}
      wide={step === "path" || step === "affiliate"}
      returnFocusTo={returnFocusTo}
    >
      {onboardingError ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {onboardingError}
        </p>
      ) : null}
      {!sessionReady ? (
        <p className="text-sm text-[var(--join-muted)]">Loading…</p>
      ) : (
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${step}-${authView}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
          >
            {step === "auth" && !isSignedIn ? (
              <AuthScreen
                firstName={profile.firstName}
                email={profile.email}
                view={authView}
                onView={setAuthView}
                onEmail={(value) => update({ email: value })}
                onAuthenticated={(provider, email) => {
                  setIsSignedIn(true);
                  setAuthView("choose");
                  void (async () => {
                    const me = await loadMe();
                    setProfile((prev) => {
                      const next = {
                        ...prev,
                        authProvider: provider,
                        email: email ?? prev.email,
                      };
                      if (me.status === "signed_in") {
                        const parts = me.public_name
                          .split(/\s+/)
                          .filter(Boolean);
                        if (!next.firstName && parts[0])
                          next.firstName = parts[0];
                        if (!next.lastName && parts.length > 1) {
                          next.lastName = parts.slice(1).join(" ");
                        }
                      }
                      return next;
                    });
                    go("name", 1);
                  })();
                }}
              />
            ) : null}
            {isSignedIn && step === "name" ? (
              <NameScreen
                firstName={profile.firstName}
                lastName={profile.lastName}
                onChange={(field, value) => update({ [field]: value })}
                onContinue={() => {
                  if (
                    validateNamePart(profile.firstName) ||
                    validateNamePart(profile.lastName)
                  ) {
                    return;
                  }
                  void advanceFrom("name");
                }}
              />
            ) : null}
            {isSignedIn && step === "affiliate" ? (
              <AffiliateApplicationScreen />
            ) : null}
            {isSignedIn && step === "roles" ? (
              <RolesScreen
                selected={profile.roles}
                saving={saving}
                onToggle={(id: RoleId) => {
                  setProfile((prev) => {
                    const roles = prev.roles.includes(id)
                      ? prev.roles.filter((role) => role !== id)
                      : [...prev.roles, id];
                    return {
                      ...prev,
                      roles,
                      hasPhysicalGym: roles.includes("gym_owner")
                        ? prev.hasPhysicalGym
                        : null,
                      hasPhysicalClinic: roles.includes("clinician")
                        ? prev.hasPhysicalClinic
                        : null,
                    };
                  });
                }}
                onContinue={() => void advanceFrom("roles")}
              />
            ) : null}
            {isSignedIn && step === "conditional" ? (
              <ConditionalScreen
                roles={profile.roles}
                hasPhysicalGym={profile.hasPhysicalGym}
                hasPhysicalClinic={profile.hasPhysicalClinic}
                saving={saving}
                onGym={(value) => update({ hasPhysicalGym: value })}
                onClinic={(value) => update({ hasPhysicalClinic: value })}
                onContinue={() => void advanceFrom("conditional")}
              />
            ) : null}
            {isSignedIn && step === "path" ? (
              <RecommendedPath
                profile={profile}
                onOpenAffiliate={() => go("affiliate", 1)}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      )}
    </JoinShell>
  );
}
