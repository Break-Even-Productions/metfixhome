/**
 * Newsletter signup modal (mia-metfix design).
 * Posts EMAIL + FNAME to the existing Mailchimp embed audience.
 * Interests / location are collected for UX + localStorage; tags need API access later.
 */
import { NEWSLETTER_FORM_ACTION } from "@/components/siteFooterNav";
import { easeOutExpo } from "@/components/home/motion";
import {
  MAILCHIMP_HONEYPOT_NAME,
  NEWSLETTER_INTERESTS,
  NEWSLETTER_STORAGE_KEY,
  type NewsletterInterestId,
} from "@/data/newsletter";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import "@/join/join.css";

type InterestLabel = (typeof NEWSLETTER_INTERESTS)[number]["label"];

const fieldClass =
  "w-full rounded-full border border-[var(--join-line)] bg-[var(--join-paper)] px-5 py-3.5 text-sm text-[var(--join-ink)] outline-none transition-[box-shadow,border-color] duration-300 ease-out placeholder:text-[var(--join-muted-2)] focus:border-[var(--join-accent)] focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--join-accent)_18%,transparent)]";

type NewsletterModalProps = {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
};

function interestLabels(ids: NewsletterInterestId[]) {
  return ids
    .map((id) => NEWSLETTER_INTERESTS.find((interest) => interest.id === id)?.label)
    .filter((label): label is InterestLabel => label !== undefined);
}

function listTopics(labels: string[]) {
  if (labels.length === 0) return "the newsletter";
  if (labels.length === 1) return labels[0]!.toLowerCase();
  if (labels.length === 2) return `${labels[0]!.toLowerCase()} and ${labels[1]!.toLowerCase()}`;
  return `${labels[0]!.toLowerCase()}, ${labels[1]!.toLowerCase()}, and ${labels.length - 2} more`;
}

function postMailchimpSubscribe(email: string, name: string, iframeName: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = NEWSLETTER_FORM_ACTION;
  form.target = iframeName;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  const fields: Record<string, string> = {
    EMAIL: email,
    FNAME: name,
    [MAILCHIMP_HONEYPOT_NAME]: "",
  };
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function NewsletterModal({
  open,
  onClose,
  initialEmail = "",
}: NewsletterModalProps) {
  const iframeName = useId().replace(/:/g, "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<NewsletterInterestId[]>([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showInterestError, setShowInterestError] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail.trim());
    setName("");
    setLocation("");
    setInterests([]);
    setDone(false);
    setSubmitting(false);
    setShowInterestError(false);
  }, [open, initialEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleInterest = (id: NewsletterInterestId) => {
    setInterests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setShowInterestError(false);
  };

  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();
    const nextName = name.trim();
    const nextLocation = location.trim();
    if (!nextEmail.includes("@") || !nextName || !nextLocation) return;
    if (interests.length === 0) {
      setShowInterestError(true);
      return;
    }

    const signup = {
      email: nextEmail,
      name: nextName,
      location: nextLocation,
      interests,
      subscribedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(signup));
    } catch {
      /* Confirmation still shows if storage is blocked. */
    }

    setSubmitting(true);
    try {
      postMailchimpSubscribe(nextEmail, nextName, `mc-newsletter-${iframeName}`);
    } catch {
      /* Still show confirmation; Mailchimp may open in the hidden iframe. */
    }
    setSubmitting(false);
    setDone(true);
  };

  const firstName = name.trim().split(/\s+/)[0] || "there";
  const topics = listTopics(interestLabels(interests));

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="membership-theme fixed inset-0 z-[70] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <iframe
            title="Mailchimp subscribe"
            name={`mc-newsletter-${iframeName}`}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-[var(--join-ink)]/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-title"
            className="relative max-h-[min(44rem,calc(100svh-2rem))] w-full max-w-lg overflow-y-auto rounded-3xl bg-[var(--join-cream)] p-8 shadow-2xl md:p-10"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: easeOutExpo }}
          >
            <div className="mb-6 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-[var(--join-muted)] transition-colors duration-300 ease-out hover:text-[var(--join-ink)]"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="font-serif text-sm text-[var(--join-accent-2)]">
              Let&apos;s Start with the Truth
            </p>
            <h2
              id="newsletter-title"
              className="mt-2 font-serif text-3xl leading-tight text-[var(--join-ink)]"
            >
              {done ? "You\u2019re on the list." : "What should we send you?"}
            </h2>

            <AnimatePresence mode="wait">
              <motion.div
                key={done ? "done" : "form"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: easeOutExpo }}
              >
                {done ? (
                  <div className="mt-6">
                    <p className="text-sm leading-relaxed text-[var(--join-muted)]">
                      Thanks, {firstName}. We&apos;ll send {topics} to {email.trim()}.
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-6 w-full rounded-full bg-[var(--join-accent)] py-3.5 text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)]"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form className="mt-6" onSubmit={subscribe}>
                    <p className="text-sm leading-relaxed text-[var(--join-muted)]">
                      A name, a place, and the topics you want. We&apos;ll use this to choose what
                      lands in your inbox.
                    </p>

                    <div className="mt-6 space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
                          Email
                        </span>
                        <input
                          autoFocus={!initialEmail.includes("@")}
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="Email address"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
                          Name
                        </span>
                        <input
                          autoFocus={initialEmail.includes("@")}
                          type="text"
                          required
                          autoComplete="name"
                          placeholder="Your name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]">
                          Location
                        </span>
                        <input
                          type="text"
                          required
                          autoComplete="address-level2"
                          placeholder="City or region"
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                    </div>

                    <fieldset className="mt-6">
                      <legend
                        id="newsletter-interests"
                        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--join-accent-2)]"
                      >
                        I&apos;m interested in
                      </legend>
                      <p className="mt-2 text-sm text-[var(--join-muted)]">Choose all that apply.</p>
                      <div
                        role="group"
                        aria-labelledby="newsletter-interests"
                        className="mt-3 flex flex-wrap gap-2"
                      >
                        {NEWSLETTER_INTERESTS.map((interest) => {
                          const selected = interests.includes(interest.id);
                          return (
                            <button
                              key={interest.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleInterest(interest.id)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-sm transition-[border-color,background-color,color] duration-300 ease-out ${
                                selected
                                  ? "border-[var(--join-accent)] bg-[var(--join-accent)] font-semibold text-[var(--join-ink)]"
                                  : "border-[var(--join-line)] bg-[var(--join-paper)] text-[var(--join-ink)] hover:border-[var(--join-accent)]/60"
                              }`}
                            >
                              {selected ? (
                                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                              ) : null}
                              {interest.label}
                            </button>
                          );
                        })}
                      </div>
                      {showInterestError ? (
                        <p className="mt-3 text-sm text-[var(--join-ink)]">Pick at least one topic.</p>
                      ) : null}
                    </fieldset>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-6 w-full rounded-full bg-[var(--join-accent)] py-3.5 text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Signing up…" : "Sign up"}
                    </button>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
