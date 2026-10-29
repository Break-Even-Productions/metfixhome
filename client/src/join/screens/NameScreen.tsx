import { useState } from "react";
import { Field, GoldButton, Kicker, Question, ScreenForm } from "../ui";

const NAME_MAX = 80;

export function validateNamePart(value: string): string | null {
  const t = value.trim();
  if (!t) return "Required";
  if ([...t].length > NAME_MAX) return `Must be ${NAME_MAX} characters or fewer`;
  return null;
}

export function NameScreen({
  firstName,
  lastName,
  onChange,
  onContinue,
}: {
  firstName: string;
  lastName: string;
  onChange: (field: "firstName" | "lastName", value: string) => void;
  onContinue: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const showErrors = attempted || firstName.length > 0 || lastName.length > 0;
  const firstErr = showErrors ? validateNamePart(firstName) : null;
  const lastErr = showErrors ? validateNamePart(lastName) : null;
  const canSubmit = !validateNamePart(firstName) && !validateNamePart(lastName);

  return (
    <ScreenForm
      onSubmit={() => {
        setAttempted(true);
        if (!canSubmit) return;
        onContinue();
      }}
    >
      <Kicker>Let’s get started.</Kicker>
      <Question>What’s your name?</Question>
      <div className="mt-10 space-y-4">
        <Field
          label="First name"
          value={firstName}
          autoFocus
          id="join-first-name"
          describedBy={firstErr ? "join-first-name-err" : undefined}
          error={firstErr}
          onChange={(v) => onChange("firstName", v)}
        />
        <Field
          label="Last name"
          value={lastName}
          id="join-last-name"
          describedBy={lastErr ? "join-last-name-err" : undefined}
          error={lastErr}
          onChange={(v) => onChange("lastName", v)}
        />
      </div>
      <div className="mt-10">
        <GoldButton type="submit" disabled={!canSubmit && attempted}>
          Continue
        </GoldButton>
      </div>
      <p className="mt-6 text-center text-sm text-[var(--join-muted)]">
        Explore MetFix free for your first month. Cancel anytime.
      </p>
    </ScreenForm>
  );
}
