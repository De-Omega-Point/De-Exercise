type SparklineProps = {
  values: number[];
  label: string;
};

export function Sparkline({ values, label }: SparklineProps) {
  if (values.length < 2) {
    return <div className="sparkline-empty" aria-label={label}>Need more sets for trend</div>;
  }

  const width = 160;
  const height = 44;
  const padding = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
