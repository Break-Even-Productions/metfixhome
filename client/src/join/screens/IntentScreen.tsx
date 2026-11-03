import { GhostButton, GoldButton, Kicker, Question } from "../ui";

export function IntentScreen({
  onIndividual,
  onAffiliate,
  onSignIn,
}: {
  onIndividual: () => void;
  onAffiliate: () => void;
  onSignIn: () => void;
}) {
  return (
    <div>
      <Kicker>Let’s get started.</Kicker>
      <Question>How do you want to join?</Question>

      <div className="mt-10 space-y-4">
        <GoldButton type="button" onClick={onIndividual}>
          Individual membership — $30/mo
        </GoldButton>
        <GhostButton onClick={onAffiliate}>Affiliate membership — $170/mo</GhostButton>
      </div>

      <p className="mt-6 text-sm text-[var(--join-muted)]">
        Do you have a physical location, gym, or medical practice you would like to affiliate with
        MetFix? Choose Affiliate membership to start your application.
      </p>

      <p className="mt-8 text-center text-sm text-[var(--join-muted)]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="font-semibold text-[var(--join-ink)] underline decoration-[var(--join-line)] underline-offset-4 transition-colors duration-300 ease-out hover:text-[var(--join-accent-2)]"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
