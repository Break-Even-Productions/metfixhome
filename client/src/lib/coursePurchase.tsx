import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { openWhopCheckout, purchaseCourseCheckout } from "@/lib/account";
import { loadMe, peekMe } from "@/lib/session";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import "@/join/join.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailModalProps = {
  open: boolean;
  email: string;
  error: string | null;
  buying: boolean;
  onEmail: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CourseEmailModal({
  open,
  email,
  error,
  buying,
  onEmail,
  onClose,
  onSubmit,
}: EmailModalProps) {
  const titleId = useId();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="membership-theme fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--join-ink)]/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-3xl bg-[var(--join-cream)] p-8 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-2xl leading-tight text-[var(--join-ink)]">
            Email for this purchase
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--join-muted)] hover:text-[var(--join-ink)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--join-muted)]">
          We&apos;ll use this email to set up your course access.
        </p>
        <form className="mt-6" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
              Email
            </span>
            <input
              autoFocus
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              aria-label="Email for this purchase"
              onChange={(event) => onEmail(event.target.value)}
              className="w-full rounded-full border border-[var(--join-line)] bg-[var(--join-paper)] px-5 py-3.5 text-sm text-[var(--join-ink)] outline-none placeholder:text-[var(--join-muted-2)] focus:border-[var(--join-accent)]"
            />
          </label>
          {error ? (
            <p className="mt-3 text-sm text-[#9b3b32]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={buying}
            className="mt-5 w-full rounded-full bg-[var(--join-accent)] py-3.5 text-sm font-semibold text-[var(--join-ink)] hover:bg-[var(--join-accent-2)] disabled:cursor-wait disabled:opacity-70"
          >
            {buying ? "Opening…" : "Continue"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function useCoursePurchase(courseId: number | string | undefined): {
  signedIn: boolean | null;
  buying: boolean;
  error: string | null;
  buy: () => void;
  emailModal: ReactNode;
} {
  const [signedIn, setSignedIn] = useState<boolean | null>(() => {
    const me = peekMe();
    if (!me) return null;
    return me.status === "signed_in";
  });
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadMe().then((me) => {
      if (live) setSignedIn(me.status === "signed_in");
    });
    return () => {
      live = false;
    };
  }, []);

  const closeEmail = () => {
    if (buying) return;
    setEmailOpen(false);
    setError(null);
  };

  const startCheckout = async (guestEmail?: string) => {
    if (courseId == null || courseId === "" || buying) return;
    setError(null);
    setBuying(true);
    try {
      const res = await purchaseCourseCheckout(courseId, {
        return_path: "/checkout/complete",
        ...(guestEmail ? { email: guestEmail } : {}),
      });
      if (!openWhopCheckout(res.checkout_url)) {
        setError("Checkout unavailable. Try again.");
        return;
      }
      setEmailOpen(false);
      setEmail("");
    } catch {
      setError("Checkout unavailable. Try again.");
    } finally {
      setBuying(false);
    }
  };

  const buy = () => {
    if (courseId == null || courseId === "" || buying || signedIn == null) return;
    setError(null);
    if (!signedIn) {
      setEmailOpen(true);
      return;
    }
    void startCheckout();
  };

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setError("Enter the email for this purchase.");
      return;
    }
    void startCheckout(value);
  };

  const emailModal = (
    <CourseEmailModal
      open={emailOpen}
      email={email}
      error={emailOpen ? error : null}
      buying={buying}
      onEmail={setEmail}
      onClose={closeEmail}
      onSubmit={submitEmail}
    />
  );

  return {
    signedIn,
    buying,
    error: emailOpen ? null : error,
    buy,
    emailModal,
  };
}
