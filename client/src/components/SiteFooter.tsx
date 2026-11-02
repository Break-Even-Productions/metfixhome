import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import CopyrightText from "@/components/CopyrightText";
import {
  NEWSLETTER_FORM_ACTION,
  SITE_FOOTER_LINKS,
  type FooterLink,
} from "@/components/siteFooterNav";

type SiteFooterProps = {
  onJoin?: () => void;
  /** Default false — Home passes true (P-E-15b). */
  showNewsletter?: boolean;
  newsletterTitle?: string;
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) {
  return (
    <nav aria-label={title}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-3">{title}</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            {link.external || /^https?:\/\//.test(link.href) ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cream/80 transition-colors duration-300 ease-out hover:text-cream"
              >
                {link.label}
              </a>
            ) : link.href.startsWith("/#") ? (
              <a
                href={link.href}
                className="text-sm text-cream/80 transition-colors duration-300 ease-out hover:text-cream"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-cream/80 transition-colors duration-300 ease-out hover:text-cream"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter({
  onJoin,
  showNewsletter = false,
  newsletterTitle = "Metabolic health, weekly",
}: SiteFooterProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const next = email.trim();
    if (!next.includes("@")) {
      event.preventDefault();
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
  };

  return (
    <footer className="footer-root section-card relative bg-footer-band" data-site-footer="">
      <img
        src="/footer.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="footer-glass relative z-[1]">
        <div className="relative z-[2] px-6 py-10 md:px-10 md:py-12 lg:px-12 lg:py-14">
          {showNewsletter ? (
            <form
              id="newsletter"
              action={NEWSLETTER_FORM_ACTION}
              method="post"
              target="_blank"
              noValidate
              onSubmit={onSubmit}
              className="flex flex-col gap-6 border-b border-white/15 pb-8 md:flex-row md:items-end md:justify-between md:gap-10 md:pb-10"
            >
              <div className="min-w-0 max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-3">
                  Newsletter
                </p>
                <h2 className="mt-2 font-serif text-[1.7rem] leading-tight text-cream md:text-[2rem]">
                  {newsletterTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-cream/70">
                  New essays on metabolic health, in your inbox.
                </p>
              </div>
              <div className="flex w-full max-w-md shrink-0 flex-col gap-2 sm:flex-row">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Email address</span>
                  <input
                    type="email"
                    name="EMAIL"
                    required
                    autoComplete="email"
                    placeholder="Email address"
                    value={email}
                    aria-describedby={error ? "newsletter-error" : "newsletter-hint"}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-cream outline-none transition-[box-shadow,border-color] duration-300 ease-out placeholder:text-cream/45 focus:border-gold focus:shadow-[0_0_0_4px_rgba(196,164,108,0.22)]"
                  />
                </label>
                <div aria-hidden="true" style={{ position: "absolute", left: "-5000px" }}>
                  <input
                    type="text"
                    name="b_473a65a0067d6101d3a6277c8_abdc550935"
                    tabIndex={-1}
                    defaultValue=""
                  />
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink transition-colors duration-300 ease-out hover:bg-gold-2"
                >
                  Sign up
                </button>
              </div>
              <p id="newsletter-hint" className="sr-only">
                Submits to the MetFix Mailchimp list. Opens in a new tab.
              </p>
              {error ? (
                <p id="newsletter-error" role="alert" className="text-sm text-accent-3">
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}

          <div
            className={`grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 ${
              showNewsletter ? "pt-8 md:pt-10" : ""
            }`}
          >
            <div className="col-span-2 max-w-sm lg:col-span-1">
              <Link href="/" className="inline-flex" aria-label="MetFix">
                <img
                  src="/MetFixLogoBlack.png"
                  alt=""
                  className="h-8 w-auto brightness-0 invert md:h-9"
                />
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-cream/75">
                Evidence-informed metabolic health education for real life.
              </p>
            </div>
            <FooterColumn title="Explore" links={SITE_FOOTER_LINKS.explore} />
            <FooterColumn title="MetFix" links={SITE_FOOTER_LINKS.company} />
          </div>

          <div className="mt-8 grid gap-4 border-t border-white/15 pt-6 text-[12px] text-cream/60 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <CopyrightText
              variant="home"
              className="!text-[12px] !normal-case !tracking-normal !text-cream/60"
            />
            <div className="flex gap-6">
              {SITE_FOOTER_LINKS.legal.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors duration-300 ease-out hover:text-cream"
                >
                  {link.label}
                </a>
              ))}
            </div>
            {onJoin ? (
              <button
                type="button"
                onClick={onJoin}
                className="w-fit rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-300 ease-out hover:bg-gold-2 md:justify-self-end"
              >
                Join Today — 1 Month Free
              </button>
            ) : (
              <span className="md:justify-self-end" />
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
