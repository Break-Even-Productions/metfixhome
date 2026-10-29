import { Check } from "lucide-react";
import { ONBOARDING_ROLES, type RoleId } from "@shared/join";
import { GoldButton, Kicker, Question } from "../ui";

export function RolesScreen({
  selected,
  onToggle,
  onContinue,
}: {
  selected: RoleId[];
  onToggle: (id: RoleId) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <Kicker>Tell us a little more about you.</Kicker>
      <Question>Which of these best describes you?</Question>
      <p className="mt-4 text-sm text-[var(--join-muted)]">Choose all that apply.</p>
      <div className="mt-8 space-y-3">
        {ONBOARDING_ROLES.map((role) => {
          const on = selected.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onToggle(role.id)}
              aria-pressed={on}
              className={`w-full rounded-[1.4rem] border px-5 py-4 text-left transition-[border-color,background-color,box-shadow] duration-300 ease-out ${
                on
                  ? "border-[var(--join-accent)] bg-[var(--join-paper)] shadow-[0_10px_30px_rgba(23,21,18,0.06)]"
                  : "border-[var(--join-line)] bg-[var(--join-paper)]/60 hover:border-[var(--join-accent)]/50 hover:bg-[var(--join-paper)]"
              }`}
            >
              <span className="flex items-start justify-between gap-4">
                <span>
                  <span className="block font-serif text-xl text-[var(--join-ink)]">{role.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--join-muted)]">
                    {role.description}
                  </span>
                </span>
                <span
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ease-out ${
                    on
                      ? "border-[var(--join-accent)] bg-[var(--join-accent)] text-[var(--join-ink)]"
                      : "border-[var(--join-line)] text-transparent"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-10">
        <GoldButton disabled={selected.length === 0} onClick={onContinue}>
          Continue
        </GoldButton>
      </div>
    </div>
  );
}
