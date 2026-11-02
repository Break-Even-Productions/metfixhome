/**
 * Icon-search modal: type a query, submit to /library/search?query=…
 * Matches mia-metfix search panel (cream card, quick course links).
 */
import { SEARCH_HREF } from "@/const";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";

const QUICK_LINKS = [
  { kicker: "Core", title: "What is MetFix?", detail: "Self-paced · 15 lessons", href: "/#classes" },
  { kicker: "Coaches", title: "MetFix Essentials", detail: "Self-paced · 86 lessons", href: "/courses" },
  { kicker: "First Responders", title: "Fit For Duty", detail: "Self-paced · 11 modules", href: "/courses" },
  { kicker: "Women's Health", title: "Women's Health", detail: "Self-paced · 6 modules", href: "/courses" },
  { kicker: "Physician", title: "The Prepared Patient", detail: "Self-paced · 6 lessons", href: "/courses" },
  { kicker: "Nutrition", title: "Medical Nutrition", detail: "40 hrs · 39 lessons", href: "/courses" },
] as const;

type NavSearchModalProps = {
  open: boolean;
  onClose: () => void;
};

export function NavSearchModal({ open, onClose }: NavSearchModalProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const goSearch = (value: string) => {
    const q = value.trim();
    onClose();
    const href = q
      ? `${SEARCH_HREF}?query=${encodeURIComponent(q)}`
      : SEARCH_HREF;
    setLocation(href);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    goSearch(query);
  };

  return (
    <div className="nav-search" role="presentation">
      <button
        type="button"
        className="nav-search__backdrop"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="nav-search__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="sr-only">
          Search MetFix
        </h2>
        <form className="nav-search__form" onSubmit={onSubmit}>
          <Search className="nav-search__icon" size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes, instructors..."
            className="nav-search__input"
            aria-label="Search classes, instructors"
            autoComplete="off"
          />
          <button
            type="button"
            className="nav-search__close"
            aria-label="Close search"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
        <ul className="nav-search__list">
          {QUICK_LINKS.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className="nav-search__hit"
                onClick={onClose}
              >
                <span>
                  <span className="nav-search__kicker">{item.kicker}</span>
                  <span className="nav-search__title">{item.title}</span>
                </span>
                <span className="nav-search__detail">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
