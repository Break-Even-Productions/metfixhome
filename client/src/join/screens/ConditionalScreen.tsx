import type { RoleId } from "@shared/join";
import { GoldButton, Kicker, Question } from "../ui";

function Choice({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex-1 rounded-full border py-3.5 text-sm font-semibold transition-colors duration-300 ease-out ${
        selected
          ? "border-[var(--join-accent)] bg-[var(--join-accent)] text-[var(--join-ink)]"
          : "border-[var(--join-line)] bg-[var(--join-paper)] text-[var(--join-ink)] hover:bg-[var(--join-cream-2)]"
      }`}
    >
      {label}
    </button>
  );
}

export function ConditionalScreen({
  roles,
  hasPhysicalGym,
  hasPhysicalClinic,
  onGym,
  onClinic,
  onContinue,
}: {
  roles: RoleId[];
  hasPhysicalGym: boolean | null;
  hasPhysicalClinic: boolean | null;
  onGym: (value: boolean) => void;
  onClinic: (value: boolean) => void;
  onContinue: () => void;
}) {
  const askGym = roles.includes("gym_owner");
  const askClinic = roles.includes("clinician");
  const ready =
    (!askGym || hasPhysicalGym !== null) && (!askClinic || hasPhysicalClinic !== null);

  return (
    <div>
      <Kicker>A couple of details.</Kicker>
      <Question>Help us recommend the right path.</Question>
      <div className="mt-10 space-y-10">
        {askGym ? (
          <div>
            <h2 className="font-serif text-2xl text-[var(--join-ink)]">
              Do you operate a physical gym location?
            </h2>
            <p className="mt-2 text-sm text-[var(--join-muted)]">
              Physical locations are required for MetFix Affiliate status.
            </p>
            <div className="mt-5 flex gap-3">
              <Choice label="Yes" selected={hasPhysicalGym === true} onSelect={() => onGym(true)} />
              <Choice label="No" selected={hasPhysicalGym === false} onSelect={() => onGym(false)} />
            </div>
          </div>
        ) : null}
        {askClinic ? (
          <div>
            <h2 className="font-serif text-2xl text-[var(--join-ink)]">
              Do you see patients at a physical practice or clinic?
            </h2>
            <p className="mt-2 text-sm text-[var(--join-muted)]">
              This determines whether they may also be eligible for a MetFix Affiliate location.
            </p>
            <div className="mt-5 flex gap-3">
              <Choice
                label="Yes"
                selected={hasPhysicalClinic === true}
                onSelect={() => onClinic(true)}
              />
              <Choice
                label="No"
                selected={hasPhysicalClinic === false}
                onSelect={() => onClinic(false)}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-10">
        <GoldButton disabled={!ready} onClick={onContinue}>
          Continue
        </GoldButton>
      </div>
    </div>
  );
}
