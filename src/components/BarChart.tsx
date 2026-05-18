"use client";

import ValueBlur from "@/components/ValueBlur";

interface BarSegment {
  value: number;
  color: string;
}

interface OverlayLine {
  values: (number | null)[];
  color: string;
}

interface BarChartProps {
  data: Array<{
    label: string;
    value?: number;
    color?: string;
    segments?: BarSegment[];
  }>;
  height?: number;
  trendLabel?: string;
  trendValue?: string;
  trendPositive?: boolean;
  trendLine?: number[];
  overlayLine?: OverlayLine;
  hidden?: boolean;
}

export default function BarChart({
  data,
  height = 192,
  trendLabel,
  trendValue,
  trendPositive,
  trendLine,
  overlayLine,
  hidden = false,
}: BarChartProps) {
  const maxValue = (() => {
    if (data[0]?.segments) {
      return Math.max(...data.map((d) => d.segments!.reduce((s, seg) => s + Math.abs(seg.value), 0)), 1);
    }
    return Math.max(...data.map((d) => Math.abs(d.value || 0)), 1);
  })();

  return (
    <div className="flex flex-col h-full">
      {(trendLabel || trendValue) && (
        <div className="flex justify-between items-center mb-lg">
          {trendLabel && (
            <span className="text-label-caps text-on-surface-variant uppercase">
              {trendLabel}
            </span>
          )}
          {trendValue && (
            <ValueBlur hidden={hidden}>
            <span
              className={`text-data-mono text-body-sm tabular-nums ${
                trendPositive ? "text-positive" : "text-on-surface-variant"
              }`}
            >
              {trendValue}
            </span>
            </ValueBlur>
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
          if (d.segments) {
            const totalBar = d.segments.reduce((s, seg) => s + Math.abs(seg.value), 0);
            const barHeight = Math.max((totalBar / maxValue) * 100, 2);
            let accumulated = 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end relative"
                style={{ height: `${barHeight}%` }}
              >
                {d.segments.map((seg, j) => {
                  const segH = (Math.abs(seg.value) / totalBar) * 100;
                  const isTop = j === d.segments!.length - 1;
                  accumulated += segH;
                  return (
                    <div
                      key={j}
                      className="w-full transition-all duration-200 hover:opacity-80"
                      style={{
                        height: `${segH}%`,
                        backgroundColor: seg.color,
                        borderTopLeftRadius: isTop ? "0.125rem" : 0,
                        borderTopRightRadius: isTop ? "0.125rem" : 0,
                      }}
                    />
                  );
                })}
              </div>
            );
          }
          const barHeight = Math.max((Math.abs(d.value || 0) / maxValue) * 100, 2);
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
        {overlayLine && overlayLine.values.length > 1 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%" }}
            preserveAspectRatio="none"
            viewBox={`0 0 ${overlayLine.values.length - 1} 100`}
          >
            <polyline
              points={overlayLine.values
                .map((val, i) => {
                  if (val === null) return "";
                  const x = i;
                  const y = 100 - Math.min(Math.max((val / maxValue) * 100, 0), 100);
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(" ")}
              fill="none"
              stroke={overlayLine.color}
              strokeWidth="0.2"
            />
          </svg>
        )}
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
