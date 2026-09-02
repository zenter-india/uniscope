interface Row {
  date: string;
  [k: string]: string | number;
}

/** Compact stacked bar chart — one bar per day, two stacked segments.
 * Pure SVG, no library. Non-uniform scaling is fine at this size. */
export function MiniBarChart({
  data,
  keys,
  colors,
  height = 60,
}: {
  data: Row[];
  keys: [string, string];
  colors: [string, string];
  height?: number;
}) {
  const totals = data.map((d) => Number(d[keys[0]]) + Number(d[keys[1]]));
  const max = Math.max(1, ...totals);
  const n = Math.max(1, data.length);
  const bw = 100 / n;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Daily activity"
    >
      {data.map((d, i) => {
        const a = (Number(d[keys[0]]) / max) * height;
        const b = (Number(d[keys[1]]) / max) * height;
        const x = i * bw;
        const w = bw * 0.72;
        return (
          <g key={d.date}>
            {a > 0 && (
              <rect x={x} y={height - a} width={w} height={a} fill={colors[0]} rx={0.5} />
            )}
            {b > 0 && (
              <rect x={x} y={height - a - b} width={w} height={b} fill={colors[1]} rx={0.5} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
