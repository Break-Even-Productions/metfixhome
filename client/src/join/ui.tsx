import { ChevronLeft, X } from "lucide-react";
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";

export function JoinShell({
  children,
  onClose,
  onBack,
  progress,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  progress?: number;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="join-theme fixed inset-0 z-[80] flex flex-col bg-[var(--join-cream)] text-[var(--join-ink)]"
      role="dialog"
      aria-modal="true"
      aria-label="Join MetFix"
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 md:px-8">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-[var(--join-ink)]/70 transition-colors duration-300 ease-out hover:text-[var(--join-ink)]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-9" />
        )}
        <p className="font-serif text-xl tracking-tight">MetFix</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-[var(--join-ink)]/70 transition-colors duration-300 ease-out hover:text-[var(--join-ink)]"
          aria-label="Close onboarding"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      {progress != null ? (
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
          <div className="h-[2px] overflow-hidden rounded-full bg-[var(--join-cream-2)]">
            <div
              className="h-full bg-[var(--join-accent)] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto" id="join-scroll">
        <div
          className={`mx-auto w-full px-5 py-10 md:px-8 md:py-16 ${wide ? "max-w-3xl" : "max-w-xl"}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="font-serif text-lg text-[var(--join-accent-2)] md:text-xl">{children}</p>
  );
}

export function Question({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2 font-serif text-4xl leading-[1.12] text-[var(--join-ink)] md:text-[2.75rem]">
      {children}
    </h1>
  );
}

export function Field({
  label,
  value,
  onChange,
  autoFocus,
  type = "text",
  id,
  describedBy,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  type?: string;
  id?: string;
  describedBy?: string;
  error?: string | null;
}) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-2 block text-sm text-[var(--join-muted)]">{label}</span>
      <input
        id={inputId}
        autoFocus={autoFocus}
        type={type}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-[var(--join-line)] bg-[var(--join-paper)] px-5 py-3.5 text-base text-[var(--join-ink)] outline-none transition-[box-shadow,border-color] duration-300 ease-out placeholder:text-[var(--join-muted-2)] focus:border-[var(--join-accent)] focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--join-accent)_18%,transparent)]"
      />
      {error ? (
        <span id={describedBy} className="mt-2 block text-sm text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function GoldButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-full bg-[var(--join-accent)] py-3.5 text-sm font-semibold text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-accent-2)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--join-line)] bg-[var(--join-paper)] py-3.5 text-sm font-medium text-[var(--join-ink)] transition-colors duration-300 ease-out hover:bg-[var(--join-cream-2)]"
    >
      {children}
    </button>
  );
}

export function ScreenForm({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return <form onSubmit={submit}>{children}</form>;
}
