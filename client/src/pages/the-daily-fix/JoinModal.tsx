type JoinModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Join prompt for logged-out comment submit.
 * Neither action creates a session, sends email, or starts OAuth.
 */
export function JoinModal({ open, onClose }: JoinModalProps) {
  if (!open) return null;

  return (
    <div className="df-join-backdrop" role="presentation" onClick={onClose}>
      <div
        className="df-join-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="df-join-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="df-join-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="df-kicker">Membership</p>
        <h2 id="df-join-title">Join MetFix Today</h2>
        <p className="df-muted">
          Sign in to leave a comment on today’s fix. This step does not create a session yet.
        </p>
        <form
          className="df-join-form"
          onSubmit={(event) => {
            event.preventDefault();
            // Join with Email does not send the email and does not create a session.
          }}
        >
          <label>
            <span className="sr-only">Email</span>
            <input type="email" name="email" autoComplete="email" placeholder="you@email.com" />
          </label>
          <button type="submit" className="df-btn df-btn-accent">
            Join with Email
          </button>
        </form>
        <button
          type="button"
          className="df-btn df-btn-ink df-join-google"
          onClick={() => {
            // Continue with Google does not start OAuth and does not create a session.
          }}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
