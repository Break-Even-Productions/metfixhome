import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import { BackToTop } from "@/components/BackToTop";
import {
  loadOverview,
  loadPrOverview,
  loadSubscriptions,
  type AccountOverview,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { buildPrCatalog, catalogItems, type CatalogSection } from "./prCatalog";

function sectionLoggedCount(section: CatalogSection): number {
  return section.rows.filter((row) => row.best_score != null).length;
}

export default function AccountBenchmarkCatalog() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [gate, setGate] = useState<"loading" | "locked" | "open" | "error">("loading");
  const [sections, setSections] = useState<ReturnType<typeof buildPrCatalog>>([]);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su, prs] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadPrOverview({ signal: ac.signal, catalogCap: 500 }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        const tier = su?.canonical_tier ?? ov?.canonical_tier ?? "free";
        if (!metfixToolsUnlocked(tier)) {
          setGate("locked");
          return;
        }
        const next = buildPrCatalog(prs);
        setSections(next);
        setOpenIds(next[0] ? new Set([next[0].id]) : new Set());
        setGate("open");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load PRs.");
        setGate("error");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const grouped = useMemo(() => {
    const families: Array<"Movements" | "Benchmarks"> = ["Movements", "Benchmarks"];
    return families
      .map((family) => ({
        family,
        sections: sections.filter((section) => section.family === family),
      }))
      .filter((block) => block.sections.length > 0);
  }, [sections]);

  const totalOptions = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const totalLogged = sections.reduce((sum, section) => sum + sectionLoggedCount(section), 0);

  function toggleSection(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DashboardLayout
      title="All PR types"
      description="Full Movement Library catalog of movements and benchmarks, grouped by type."
      hideChromeTitle
    >
      <BodyNav current="prs" />
      <BodyPanel className="dash-pr-catalog">
        <Link href={basePath("/account/benchmarks")} className="dash-pr-catalog__back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M8.5 2.5 4 7l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Link>

        <header className="dash-pr-catalog__hero">
          <p className="dash-kicker">Catalog</p>
          <h2 className="dash-section-title">{firstName}’s PR types</h2>
          <p className="dash-pr-catalog__lede">Track your progress over time</p>
          {gate === "open" ? (
            <div className="dash-pr-catalog__stats" aria-label="Catalog totals">
              <div className="dash-pr-catalog__stat">
                <span className="dash-pr-catalog__stat-value">{totalOptions}</span>
                <span className="dash-pr-catalog__stat-label">Options</span>
              </div>
              <div className="dash-pr-catalog__stat">
                <span className="dash-pr-catalog__stat-value">{totalLogged}</span>
                <span className="dash-pr-catalog__stat-label">Logged</span>
              </div>
              <div className="dash-pr-catalog__stat">
                <span className="dash-pr-catalog__stat-value">{sections.length}</span>
                <span className="dash-pr-catalog__stat-label">Groups</span>
              </div>
            </div>
          ) : null}
        </header>

        {gate === "loading" ? <FeedSkeleton label="Loading PRs" /> : null}
        {error ? <p className="account-error">{error}</p> : null}
        {gate === "locked" ? (
          <>
            <FeedSkeleton label="PR catalog locked" />
            <ProUnlockBanner introOffer={overview} />
          </>
        ) : null}
        {gate === "open" && grouped.length === 0 ? (
          <p className="dash-coach-empty">No PR types returned from the catalog.</p>
        ) : null}
        {gate === "open"
          ? grouped.map((block) => (
              <div key={block.family} className="dash-pr-catalog__family">
                <div className="dash-pr-catalog__family-head">
                  <h3 className="dash-pr-catalog__family-title">{block.family}</h3>
                  <span className="dash-pr-catalog__family-count">
                    {block.sections.length} group{block.sections.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="dash-pr-catalog__sections">
                  {block.sections.map((section) => {
                    const open = openIds.has(section.id);
                    const items = catalogItems(section.rows);
                    const logged = sectionLoggedCount(section);
                    return (
                      <section
                        key={section.id}
                        className={`dash-pr-catalog__section${open ? " dash-pr-catalog__section--open" : ""}`}
                      >
                        <button
                          type="button"
                          className="dash-pr-catalog__toggle"
                          aria-expanded={open}
                          aria-controls={`${section.id}-panel`}
                          id={section.id}
                          onClick={() => toggleSection(section.id)}
                        >
                          <span className="dash-pr-catalog__toggle-copy">
                            <span className="dash-pr-catalog__toggle-title">{section.title}</span>
                            <span className="dash-pr-catalog__toggle-meta">
                              {items.length} option{items.length === 1 ? "" : "s"}
                              {logged > 0 ? ` · ${logged} logged` : ""}
                            </span>
                          </span>
                          <span className="dash-pr-catalog__chevron" aria-hidden="true">
                            {open ? (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path
                                  d="M2.5 7h9"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path
                                  d="M7 2.5v9M2.5 7h9"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </span>
                        </button>
                        {open ? (
                          <ul id={`${section.id}-panel`} role="region" aria-labelledby={section.id}>
                            {items.map((item) => (
                              <li key={item.key}>
                                <Link
                                  href={basePath(
                                    `/account/benchmarks?lift=${encodeURIComponent(item.liftId)}`,
                                  )}
                                  className={`dash-pr-catalog__row${
                                    item.logged ? " dash-pr-catalog__row--logged" : " dash-pr-catalog__row--empty"
                                  }`}
                                >
                                  <span className="dash-pr-catalog__row-copy">
                                    <span className="dash-pr-catalog__title">{item.title}</span>
                                    <span className="dash-pr-catalog__tags">
                                      {item.tags.map((tag) => (
                                        <span
                                          key={tag.label}
                                          className={`dash-pr-catalog__tag${
                                            tag.logged ? " dash-pr-catalog__tag--on" : ""
                                          }`}
                                        >
                                          {tag.label}
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                  <span className="dash-pr-catalog__go" aria-hidden="true">
                                    →
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            ))
          : null}
      </BodyPanel>
      <BackToTop mode="items" itemSelector=".dash-pr-catalog__section" cycleEvery={8} />
    </DashboardLayout>
  );
}
