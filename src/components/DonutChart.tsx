"use client";

interface DonutChartProps {
  segments: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  centerLabel?: string;
  centerSubtext?: string;
  size?: number;
}

export default function DonutChart({
  segments,
  centerLabel,
  centerSubtext,
  size = 192,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const cx = 18;
  const cy = 18;
  const r = 15.915;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const paths = segments.map((seg) => {
    const percentage = seg.value / total;
    const length = percentage * circumference;
    const dasharray = `${length} ${circumference - length}`;
    const dashoffset = -offset;
    offset += length;
    return { ...seg, dasharray, dashoffset };
  });

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        className="transform -rotate-90"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="transparent"
          stroke="#2D3748"
          strokeWidth="8"
        />
        {paths.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke={seg.color}
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            strokeWidth="8"
            className="donut-segment transition-all duration-300 hover:stroke-[12] cursor-pointer"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-data-mono text-on-surface tabular-nums">
          {centerLabel || `${Math.round((segments[0]?.value || 0) / total * 100)}%`}
        </span>
        <span className="text-[10px] text-on-surface-variant">
          {centerSubtext || ""}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-md mt-sm">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-body-sm text-on-surface-variant">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
