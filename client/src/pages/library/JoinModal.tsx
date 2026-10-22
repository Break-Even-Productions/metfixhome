import { joinCtaHref } from "@shared/library";

type JoinModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
};

export function JoinModal({ open, title, onClose }: JoinModalProps) {
  if (!open) return null;
  return (
    <div
      className="library-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-join-title"
      onClick={onClose}
    >
      <div className="library-modal" onClick={(e) => e.stopPropagation()}>
        <p className="library-card-pro">Professional access</p>
        <h2 id="library-join-title">
          {title ? `Unlock “${title}”` : "Unlock this resource"}
        </h2>
        <p>
          This content is part of the MetFix professional library. Sign in with your
          MetFix account or join to read on metfix.org.
        </p>
        <div className="library-modal-actions">
          <a className="library-btn library-btn-gold" href={joinCtaHref()}>
            Log in / Join
          </a>
          <button type="button" className="library-btn library-btn-ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
