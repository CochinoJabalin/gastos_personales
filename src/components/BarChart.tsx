"use client";

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  trendLabel?: string;
  trendValue?: string;
  trendPositive?: boolean;
  trendLine?: number[];
}

export default function BarChart({
  data,
  height = 192,
  trendLabel,
  trendValue,
  trendPositive,
  trendLine,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div className="flex flex-col">
      {(trendLabel || trendValue) && (
        <div className="flex justify-between items-center mb-lg">
          {trendLabel && (
            <span className="text-label-caps text-on-surface-variant uppercase">
              {trendLabel}
            </span>
          )}
          {trendValue && (
            <span
              className={`text-data-mono text-body-sm tabular-nums ${
                trendPositive ? "text-positive" : "text-on-surface-variant"
              }`}
            >
              {trendValue}
            </span>
          )}
        </div>
      )}
      <div
        className="flex-grow flex items-end gap-1 pb-md relative"
        style={{ height }}
      >
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
          <div className="w-full h-px bg-on-surface" />
          <div className="w-full h-px bg-on-surface" />
          <div className="w-full h-px bg-on-surface" />
        </div>
        {data.map((d, i) => {
          const barHeight = (Math.abs(d.value) / maxValue) * 100;
          const isLast = i === data.length - 1;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all duration-200 hover:opacity-80"
              style={{
                height: `${barHeight}%`,
                backgroundColor: d.color || (isLast ? "#adc6ff" : "rgba(173, 198, 255, 0.2)"),
              }}
            />
          );
        })}
        {trendLine && trendLine.length > 1 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%" }}
            preserveAspectRatio="none"
            viewBox={`0 0 ${trendLine.length - 1} 100`}
          >
            <polyline
              points={trendLine
                .map((val, i) => `${i},${100 - (val / maxValue) * 100}`)
                .join(" ")}
              fill="none"
              stroke="#10B981"
              strokeWidth="0.15"
              strokeDasharray="0.2 0.15"
            />
          </svg>
        )}
      </div>
      <div className="flex justify-between mt-sm">
        {data.map((d, i) => (
          <span
            key={i}
            className={`text-label-caps text-[9px] ${
              i === data.length - 1 ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
