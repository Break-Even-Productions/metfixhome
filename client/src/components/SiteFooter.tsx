import CopyrightText from "@/components/CopyrightText";
import { assetUrl, basePath } from "@/const";

const METFIX_MAP_URL = "https://brokenscience.org/metfix/metfix-map/";

const linkStyle = {
  display: "block",
  fontFamily: "'DM Sans'",
  fontSize: "0.85rem",
  color: "rgba(239,239,239,0.8)",
  textDecoration: "none",
  marginBottom: "0.75rem",
  transition: "color 0.2s",
} as const;

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={basePath(href)}
      target={href.startsWith("http") ? "_blank" : "_self"}
      rel="noopener noreferrer"
      style={linkStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#EFEFEF";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(239,239,239,0.5)";
      }}
    >
      {label}
    </a>
  );
}

/** Site footer used on the homepage and resource readers. */
export function SiteFooter() {
  return (
    <footer
      style={{
        background: "#050505",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "4rem 0 2rem",
        paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
      }}
      className="footer-mobile-pad"
    >
      <div className="container">
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: "3rem",
            marginBottom: "3rem",
          }}
        >
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <img
                src={assetUrl("/metfix-lockup.png")}
                alt="MetFix"
                style={{ height: "2.25rem", width: "auto", display: "block" }}
              />
            </div>
            <p
              style={{
                fontFamily: "'DM Sans'",
                fontSize: "0.85rem",
                lineHeight: 1.7,
                color: "rgba(239,239,239,0.82)",
                maxWidth: "280px",
                marginBottom: "1.25rem",
              }}
            >
              The metabolic health education platform for coaches, gym owners, and health
              leaders fighting chronic disease.
            </p>
            <a
              href="https://brokenscience.org/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "'DM Mono'",
                fontSize: "0.75rem",
                letterSpacing: "0.12em",
                color: "rgba(201,169,110,0.5)",
                textDecoration: "none",
                textTransform: "uppercase",
              }}
            >
              A Broken Science Initiative Project
            </a>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'DM Mono'",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                color: "#C9A96E",
                textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}
            >
              Learn
            </div>
            <FooterLink href="/the-daily-fix" label="The Daily Fix" />
            <FooterLink href="https://whatis.metfix.org/" label="What Is MetFix?" />
            <FooterLink href="https://brokenscience.org/events/" label="Foundations Seminar" />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'DM Mono'",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                color: "#C9A96E",
                textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}
            >
              Specialty
            </div>
            <FooterLink href="/courses" label="Courses" />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'DM Mono'",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                color: "#C9A96E",
                textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}
            >
              Community
            </div>
            <FooterLink href={METFIX_MAP_URL} label="Find a Gym" />
            <FooterLink href="/become-an-affiliate" label="Become an Affiliate" />
            <FooterLink href="https://brokenscience.org/" label="Broken Science Initiative" />
            <FooterLink href="https://brokenscience.org/login/" label="Login" />
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1.25rem 2rem",
          }}
        >
          <CopyrightText variant="home" />
          <div
            style={{
              fontFamily: "'DM Mono'",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              color: "rgba(239,239,239,0.75)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            <a
              href="https://brokenscience.org/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#EFEFEF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(239,239,239,0.75)";
              }}
            >
              Privacy
            </a>
            {" · "}
            <a
              href="https://brokenscience.org/terms-and-conditions/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#EFEFEF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(239,239,239,0.75)";
              }}
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
