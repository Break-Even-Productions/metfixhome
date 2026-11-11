/** Shared best/last progress chart for account PR / health / benchmark views. */

export const CHART_W = 720;
export const CHART_H = 280;
export const CHART_PAD = { top: 28, right: 18, bottom: 44, left: 52 };

/** One decimal without `.toFixed` (CL-T21 money-scan forbids it in account/). */
export function formatScoreNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const tenths = Math.round(n * 10) / 10;
  if (Number.isInteger(tenths)) return String(tenths);
  const whole = Math.trunc(tenths);
  const frac = Math.abs(Math.round((tenths - whole) * 10));
  return `${whole}.${frac}`;
}

export function formatValue(n: number, unit: string | null | undefined): string {
  const u = unit?.trim();
  if (u === "lb" || u === "lbs") return `${Math.round(n)} ${u}`;
  if (u) return `${formatScoreNumber(n)} ${u}`;
  return formatScoreNumber(n);
}

export function parseEntryDate(raw: string): Date | null {
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function formatTickDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type ChartPoint = {
  date: Date;
  last: number;
  best: number;
  label: string;
};

export function buildChartSeries(
  entries: Array<{ measurement_date: string; value: number }>,
  higherIsBetter: boolean,
): ChartPoint[] {
  const sorted = [...entries]
    .map((e) => ({ entry: e, date: parseEntryDate(e.measurement_date) }))
    .filter((x): x is { entry: (typeof entries)[number]; date: Date } => x.date != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let best = higherIsBetter ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  const points: ChartPoint[] = [];
  for (const { entry, date } of sorted) {
    const last = Number(entry.value);
    if (!Number.isFinite(last)) continue;
    if (higherIsBetter) best = Math.max(best, last);
    else best = Math.min(best, last);
    points.push({
      date,
      last,
      best,
      label: formatTickDate(date),
    });
  }
  return points;
}

function chartGeometry(points: ChartPoint[]) {
  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const values = points.flatMap((p) => [p.last, p.best]);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
    minV = 0;
    maxV = 1;
  }
  if (minV === maxV) {
    minV = minV * 0.9;
    maxV = maxV * 1.1 || 1;
  }
  const pad = (maxV - minV) * 0.08;
  minV -= pad;
  maxV += pad;
  const xAt = (i: number) =>
    CHART_PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) =>
    CHART_PAD.top + ((maxV - v) / (maxV - minV || 1)) * innerH;
  return { innerW, innerH, minV, maxV, xAt, yAt };
}

function linePath(
  points: ChartPoint[],
  pick: "last" | "best",
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[pick])}`)
    .join(" ");
}

export function PrProgressChart({
  points,
  unit,
  hoverIndex,
  onHover,
}: {
  points: ChartPoint[];
  unit: string | null;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const { minV, maxV, xAt, yAt } = chartGeometry(points);
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const t = i / (yTicks - 1);
    return minV + (maxV - minV) * (1 - t);
  });
  const maxDateTicks = Math.min(points.length, 8);
  const dateIndexes =
    points.length <= maxDateTicks
      ? points.map((_, i) => i)
      : Array.from({ length: maxDateTicks }, (_, i) =>
          Math.round((i / (maxDateTicks - 1)) * (points.length - 1)),
        );

  const hover = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="dash-pr-chart">
      <div className="dash-pr-chart__legend" aria-hidden="true">
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--best">Best</span>
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--last">Last</span>
        {unit ? <span className="dash-pr-chart__unit">{unit}</span> : null}
      </div>
      <svg
        className="dash-pr-chart__svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`Best and last ${unit ?? "score"} over time`}
        onMouseLeave={() => onHover(null)}
      >
        {yLabels.map((v, i) => {
          const y = yAt(v);
          return (
            <g key={`y-${i}`}>
              <line
                className="dash-pr-chart__grid"
                x1={CHART_PAD.left}
                x2={CHART_W - CHART_PAD.right}
                y1={y}
                y2={y}
              />
              <text className="dash-pr-chart__tick" x={CHART_PAD.left - 8} y={y + 3} textAnchor="end">
                {formatScoreNumber(v)}
              </text>
            </g>
          );
        })}
        {dateIndexes.map((i) => (
          <text
            key={`x-${i}`}
            className="dash-pr-chart__tick dash-pr-chart__tick--x"
            x={xAt(i)}
            y={CHART_H - 12}
            textAnchor="middle"
          >
            {points[i]!.label}
          </text>
        ))}
        <path
          className="dash-pr-chart__line dash-pr-chart__line--best"
          d={linePath(points, "best", xAt, yAt)}
          fill="none"
        />
        <path
          className="dash-pr-chart__line dash-pr-chart__line--last"
          d={linePath(points, "last", xAt, yAt)}
          fill="none"
        />
        {points.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle
              className="dash-pr-chart__hit"
              cx={xAt(i)}
              cy={yAt(p.last)}
              r={14}
              onMouseEnter={() => onHover(i)}
              onFocus={() => onHover(i)}
            />
            <circle
              className="dash-pr-chart__dot dash-pr-chart__dot--last"
              cx={xAt(i)}
              cy={yAt(p.last)}
              r={hoverIndex === i ? 5 : 3.5}
            />
            <circle
              className="dash-pr-chart__dot dash-pr-chart__dot--best"
              cx={xAt(i)}
              cy={yAt(p.best)}
              r={hoverIndex === i ? 4.5 : 3}
            />
          </g>
        ))}
        {hover && hoverIndex != null ? (
          <g className="dash-pr-chart__tooltip">
            <rect
              x={Math.min(xAt(hoverIndex) + 10, CHART_W - 150)}
              y={Math.max(yAt(hover.last) - 48, 4)}
              width={140}
              height={42}
              rx={6}
            />
            <text
              x={Math.min(xAt(hoverIndex) + 18, CHART_W - 142)}
              y={Math.max(yAt(hover.last) - 30, 20)}
            >
              {hover.label}
            </text>
            <text
              x={Math.min(xAt(hoverIndex) + 18, CHART_W - 142)}
              y={Math.max(yAt(hover.last) - 14, 36)}
            >
              {`Best ${formatValue(hover.best, unit)} · Last ${formatValue(hover.last, unit)}`}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function PrChartSkeleton() {
  return (
    <div className="dash-pr-chart dash-pr-chart--skeleton" aria-busy="true" aria-label="Loading chart">
      <div className="dash-pr-chart__legend" aria-hidden="true">
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--best">Best</span>
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--last">Last</span>
      </div>
      <svg className="dash-pr-chart__svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const y = CHART_PAD.top + (i / 4) * (CHART_H - CHART_PAD.top - CHART_PAD.bottom);
          return (
            <line
              key={i}
              className="dash-pr-chart__grid dash-pr-chart__grid--skel"
              x1={CHART_PAD.left}
              x2={CHART_W - CHART_PAD.right}
              y1={y}
              y2={y}
            />
          );
        })}
        <path
          className="dash-pr-chart__skel-line"
          d={`M ${CHART_PAD.left} ${CHART_H * 0.62} L ${CHART_W * 0.28} ${CHART_H * 0.55} L ${CHART_W * 0.48} ${CHART_H * 0.48} L ${CHART_W * 0.68} ${CHART_H * 0.42} L ${CHART_W - CHART_PAD.right} ${CHART_H * 0.36}`}
          fill="none"
        />
        {[0.18, 0.34, 0.5, 0.66, 0.82].map((t, i) => {
          const x = CHART_PAD.left + t * (CHART_W - CHART_PAD.left - CHART_PAD.right);
          const h = 28 + ((i * 17) % 40);
          return (
            <rect
              key={t}
              className="dash-pr-chart__skel-bar"
              x={x - 6}
              y={CHART_H - CHART_PAD.bottom - h}
              width={12}
              height={h}
              rx={3}
            />
          );
        })}
      </svg>
    </div>
  );
}
