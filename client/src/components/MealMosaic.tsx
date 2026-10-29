/**
 * MealMosaic — Scroll-animated food photo mosaic
 * Design: "Earned Authority" dark system — #0A0A0A bg | #C9A96E gold
 *
 * A grid of food photo tiles that assemble as the user scrolls,
 * forming a striking visual that connects food to performance.
 * Uses IntersectionObserver for scroll-triggered animation.
 */
import { useEffect, useRef, useState } from "react";

// Reliable Unsplash food & fitness images (metabolic health aesthetic)
const FOOD_IMGS = [
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&q=75", // eggs/breakfast
  "https://images.unsplash.com/photo-1547592180-85f173990554?w=300&q=75", // salad bowl
  "https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&q=75", // steak
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=75", // vegetables
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&q=75", // salmon
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300&q=75", // colorful bowl
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&q=75", // food spread
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&q=75", // kettlebell
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=300&q=75", // workout
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=300&q=75", // medical
  "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=300&q=75", // berries
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&q=75", // healthy food
];

// Weightlifter silhouette — overhead press position
// 10 columns × 18 rows. 1 = filled, 0 = empty
const SILHOUETTE: number[][] = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // row 0  - head top
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0], // row 1  - head
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // row 2  - neck
  [0, 1, 0, 0, 1, 1, 0, 0, 1, 0], // row 3  - shoulders + upper arms
  [0, 1, 0, 1, 1, 1, 1, 0, 1, 0], // row 4  - arms + upper chest
  [1, 1, 0, 1, 1, 1, 1, 0, 1, 1], // row 5  - barbell ends + arms
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0], // row 6  - chest
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0], // row 7  - upper torso
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // row 8  - waist
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0], // row 9  - lower waist
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0], // row 10 - hips
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // row 11 - upper thighs
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // row 12 - thighs
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // row 13 - knees
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // row 14 - shins
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], // row 15 - lower shins
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0], // row 16 - ankles
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0], // row 17 - feet
];


interface TileData {
  row: number;
  col: number;
  imgIndex: number;
  delay: number;
}

export function MealMosaic() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build tile list with stagger delays
  const tiles: TileData[] = [];
  let tileCount = 0;
  SILHOUETTE.forEach((rowData, row) => {
    rowData.forEach((cell, col) => {
      if (cell === 1) {
        tiles.push({
          row,
          col,
          imgIndex: tileCount % FOOD_IMGS.length,
          delay: tileCount * 40,
        });
        tileCount++;
      }
    });
  });

  const TILE = 52; // px per tile
  const COLS = 10;
  const ROWS = SILHOUETTE.length;

  return (
    <section
      ref={sectionRef}
      style={{
        background: "#080808",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 70% 50%, rgba(201,169,110,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          {/* LEFT: Copy */}
          <div>
            <div className="rule">
              <span className="label-mono">Food Is Medicine</span>
            </div>
            <h2
              className="display-serif"
              style={{
                fontSize: "clamp(2rem, 4vw, 3.2rem)",
                marginBottom: "1.5rem",
                lineHeight: 1.15,
              }}
            >
              Every rep, every recovery, every result traces back to{" "}
              <span className="display-serif-italic text-gold">what you eat.</span>
            </h2>
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "rgba(239,239,239,0.65)",
                fontWeight: 300,
                marginBottom: "2rem",
                maxWidth: "480px",
              }}
            >
              Metabolic health isn't a niche. It's the foundation of every outcome your clients care about. MetFix gives coaches the framework, the research, and the tools to address it.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
                marginBottom: "2.5rem",
              }}
            >
              {[
                {
                  label: "Prevent",
                  desc: "Reverse prediabetes before it becomes diabetes",
                  color: "#C9A96E",
                },
                {
                  label: "Perform",
                  desc: "Maximize athletic output through metabolic optimization",
                  color: "#C9A96E",
                },
                {
                  label: "Protect",
                  desc: "Build the metabolic resilience that outlasts any fitness trend",
                  color: "#C9A96E",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "flex", gap: "1rem", alignItems: "center" }}
                >
                  <div
                    style={{
                      width: "2px",
                      height: "2rem",
                      background: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontFamily: "'DM Mono'",
                        fontSize: "0.7rem",
                        letterSpacing: "0.15em",
                        color: item.color,
                        textTransform: "uppercase",
                        marginRight: "0.75rem",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Sans'",
                        fontSize: "0.9rem",
                        color: "rgba(239,239,239,0.55)",
                      }}
                    >
                      {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://whatis.metfix.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Start the Free Course{" "}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ marginLeft: "0.4rem" }}
              >
                <path
                  d="M1 7h12M8 3l5 4-5 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          {/* RIGHT: Mosaic silhouette */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              paddingTop: "2rem",
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Head circle */}
              <div
                style={{
                  position: "absolute",
                  top: -(TILE * 1.6),
                  left: "50%",
                  transform: inView
                    ? "translateX(-50%) scale(1)"
                    : "translateX(-50%) scale(0.6)",
                  width: TILE * 1.5,
                  height: TILE * 1.5,
                  borderRadius: "50%",
                  overflow: "hidden",
                  opacity: inView ? 1 : 0,
                  transition: `opacity 0.7s ease ${tiles.length * 40 + 80}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${tiles.length * 40 + 80}ms`,
                  border: "2px solid rgba(201,169,110,0.35)",
                  boxShadow: inView
                    ? "0 0 30px rgba(201,169,110,0.15)"
                    : "none",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&q=80"
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "brightness(0.75) saturate(0.85)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(201,169,110,0.06)",
                  }}
                />
              </div>

              {/* Body grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`,
                  gridTemplateRows: `repeat(${ROWS}, ${TILE}px)`,
                  gap: "2px",
                  marginTop: TILE * 0.2,
                }}
              >
                {SILHOUETTE.map((rowData, row) =>
                  rowData.map((cell, col) => {
                    if (cell === 0) {
                      return (
                        <div
                          key={`${row}-${col}-empty`}
                          style={{ width: TILE, height: TILE }}
                        />
                      );
                    }
                    const tile = tiles.find(
                      (t) => t.row === row && t.col === col
                    );
                    if (!tile) return null;

                    // Direction: tiles come from different angles
                    const fromLeft = col < 4;
                    const fromTop = row < 5;
                    const tx = fromLeft ? -24 : 24;
                    const ty = fromTop ? -16 : 16;

                    return (
                      <div
                        key={`${row}-${col}`}
                        style={{
                          width: TILE,
                          height: TILE,
                          overflow: "hidden",
                          opacity: inView ? 1 : 0,
                          transform: inView
                            ? "translate(0,0) scale(1)"
                            : `translate(${tx}px,${ty}px) scale(0.82)`,
                          transition: `opacity 0.55s ease ${tile.delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${tile.delay}ms`,
                        }}
                      >
                        <img
                          src={FOOD_IMGS[tile.imgIndex]}
                          alt=""
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            filter: "brightness(0.72) saturate(0.88)",
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Gold glow overlay when fully assembled */}
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  pointerEvents: "none",
                  boxShadow: inView
                    ? "0 0 80px rgba(201,169,110,0.1), 0 0 160px rgba(201,169,110,0.05)"
                    : "none",
                  transition: `box-shadow 1.2s ease ${tiles.length * 40 + 400}ms`,
                }}
              />

              {/* Caption */}
              <div
                style={{
                  marginTop: "1.25rem",
                  textAlign: "center",
                  opacity: inView ? 1 : 0,
                  transition: `opacity 0.6s ease ${tiles.length * 40 + 600}ms`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.52rem",
                    letterSpacing: "0.2em",
                    color: "rgba(201,169,110,0.4)",
                    textTransform: "uppercase",
                  }}
                >
                  Built from food. Powered by knowledge.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
