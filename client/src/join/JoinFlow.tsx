import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveJoinStepTransition, type RoleId } from "@shared/join";
import { loadMe } from "@/lib/session";
import { fetchCsrf, postOnboarding } from "./api";
import { emptyProfile } from "./data";
import { AuthScreen } from "./screens/AuthScreen";
import { ConditionalScreen } from "./screens/ConditionalScreen";
import { ArticlePage, CoursePage } from "./screens/ContentPages";
import { NameScreen, validateNamePart } from "./screens/NameScreen";
import { RecommendedPath } from "./screens/RecommendedPath";
import { RolesScreen } from "./screens/RolesScreen";
import type {
  AuthView,
  JoinProfile,
  JoinStep,
  PathView,
  RecommendArticle,
  RecommendCourse,
} from "./types";
import { JoinShell } from "./ui";
import "./join.css";

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type JoinFlowProps = {
  open: boolean;
  onClose: () => void;
  /** When true, mount as page (no modal overlay dismiss via route). */
  standalone?: boolean;
  initialStep?: JoinStep;
};

function fingerprintOnboarding(profile: JoinProfile): string {
  return JSON.stringify({
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    roles: [...profile.roles].sort(),
    has_physical_gym: profile.hasPhysicalGym,
    has_physical_clinic: profile.hasPhysicalClinic,
  });
}

export function JoinFlow({ open, onClose, standalone = false, initialStep }: JoinFlowProps) {
  const [step, setStep] = useState<JoinStep>(initialStep ?? "name");
  const [authView, setAuthView] = useState<AuthView>("choose");
  const [pathView, setPathView] = useState<PathView>("plan");
  const [article, setArticle] = useState<RecommendArticle | null>(null);
  const [course, setCourse] = useState<RecommendCourse | null>(null);
  const [profile, setProfile] = useState<JoinProfile>(emptyProfile);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const savingRef = useRef(false);
  const lastSavedFp = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const me = await loadMe();
      if (cancelled) return;
      const signedIn = me.status === "signed_in";
      setIsSignedIn(signedIn);
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get("step");
      const resumeStep: JoinStep | null =
        stepParam === "roles" ||
        stepParam === "path" ||
        stepParam === "conditional" ||
        stepParam === "auth" ||
        stepParam === "name"
          ? stepParam
          : null;

      setProfile((prev) => {
        const next = { ...emptyProfile, ...prev };
        if (signedIn && me.status === "signed_in") {
          const parts = me.public_name.split(/\s+/).filter(Boolean);
          if (!next.firstName && parts[0]) next.firstName = parts[0];
          if (!next.lastName && parts.length > 1) next.lastName = parts.slice(1).join(" ");
        }
        return next;
      });

      if (initialStep) {
        setStep(initialStep);
      } else if (resumeStep) {
        if (resumeStep === "auth" && signedIn) setStep("roles");
        else setStep(resumeStep);
      } else {
        setStep("name");
      }
      setAuthView("choose");
      setPathView("plan");
      setDirection(1);
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
    const next = resolveJoinStepTransition(from, 1, {
      isSignedIn,
      roles: profile.roles,
    });
    if (!next) return;

    if (next === "path") {
      // WJ9: persist onboarding once when entering RecommendedPath
      const fp = fingerprintOnboarding(profile);
      if (lastSavedFp.current !== fp && !savingRef.current) {
        savingRef.current = true;
        setOnboardingError(null);
        try {
          const csrf = await fetchCsrf();
          if (!csrf) {
            setOnboardingError("Could not save your answers. Try again.");
            savingRef.current = false;
            return;
          }
          const result = await postOnboarding(
            {
              first_name: profile.firstName.trim(),
              last_name: profile.lastName.trim(),
              roles: profile.roles,
              has_physical_gym: profile.roles.includes("gym_owner")
                ? profile.hasPhysicalGym
                : profile.hasPhysicalGym ?? null,
              has_physical_clinic: profile.roles.includes("clinician")
                ? profile.hasPhysicalClinic
                : profile.hasPhysicalClinic ?? null,
            },
            csrf,
          );
          if (!result.ok) {
            setOnboardingError("Could not save your answers. Try again.");
            savingRef.current = false;
            return;
          }
          lastSavedFp.current = fp;
          update({ completed: true });
        } catch {
          setOnboardingError("Could not save your answers. Try again.");
          savingRef.current = false;
          return;
        } finally {
          savingRef.current = false;
        }
      }
    }
    go(next, 1);
  };

  const progress = useMemo(() => {
    const map: Record<JoinStep, number> = {
      name: 0.2,
      auth: 0.4,
      roles: 0.65,
      conditional: 0.8,
      path: 1,
    };
    return map[step];
  }, [step]);

  const back = () => {
    if (step === "path" && pathView !== "plan") {
      setPathView("plan");
      setArticle(null);
      setCourse(null);
      return;
    }
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

  const showProgress = step !== "path";
  const shell = (
    <JoinShell
      onClose={onClose}
      onBack={step === "name" || (step === "path" && pathView === "plan") ? undefined : back}
      progress={showProgress ? progress : undefined}
      wide={step === "path" && pathView === "plan"}
    >
      {onboardingError ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {onboardingError}
        </p>
      ) : null}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={
            step === "path"
              ? `${pathView}-${article?.id ?? course?.id ?? "plan"}`
              : `${step}-${authView}`
          }
          custom={direction}
          initial={{ opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
        >
          {step === "name" ? (
            <NameScreen
              firstName={profile.firstName}
              lastName={profile.lastName}
              onChange={(field, value) => update({ [field]: value })}
              onContinue={() => {
                if (validateNamePart(profile.firstName) || validateNamePart(profile.lastName)) {
                  return;
                }
                void advanceFrom("name");
              }}
            />
          ) : null}
          {step === "auth" ? (
            <AuthScreen
              firstName={profile.firstName}
              email={profile.email}
              view={authView}
              onView={setAuthView}
              onEmail={(value) => update({ email: value })}
              onAuthenticated={(provider, email) => {
                setIsSignedIn(true);
                update({
                  authProvider: provider,
                  email: email ?? profile.email,
                });
                setAuthView("choose");
                go("roles", 1);
              }}
            />
          ) : null}
          {step === "roles" ? (
            <RolesScreen
              selected={profile.roles}
              onToggle={(id: RoleId) => {
                setProfile((prev) => {
                  const roles = prev.roles.includes(id)
                    ? prev.roles.filter((role) => role !== id)
                    : [...prev.roles, id];
                  return { ...prev, roles };
                });
              }}
              onContinue={() => void advanceFrom("roles")}
            />
          ) : null}
          {step === "conditional" ? (
            <ConditionalScreen
              roles={profile.roles}
              hasPhysicalGym={profile.hasPhysicalGym}
              hasPhysicalClinic={profile.hasPhysicalClinic}
              onGym={(value) => update({ hasPhysicalGym: value })}
              onClinic={(value) => update({ hasPhysicalClinic: value })}
              onContinue={() => void advanceFrom("conditional")}
            />
          ) : null}
          {step === "path" && pathView === "plan" ? (
            <RecommendedPath
              profile={profile}
              onStartCourse={(item) => {
                setCourse(item);
                setPathView("course");
              }}
              onOpenArticle={(item) => {
                setArticle(item);
                setPathView("article");
              }}
            />
          ) : null}
          {step === "path" && pathView === "article" && article ? (
            <ArticlePage article={article} onBack={() => setPathView("plan")} />
          ) : null}
          {step === "path" && pathView === "course" && course ? (
            <CoursePage course={course} onBack={() => setPathView("plan")} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </JoinShell>
  );

  if (standalone) return shell;
  return shell;
}

/** Re-export for tests */
export { resolveJoinStepTransition };
