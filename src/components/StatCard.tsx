"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  positive?: boolean;
  critical?: boolean;
  icon?: string;
  iconBg?: string;
  progress?: number;
  progressColor?: string;
  onClick?: () => void;
  valueClassName?: string;
}

export default function StatCard({
  label,
  value,
  trend,
  positive,
  critical,
  icon,
  iconBg,
  progress,
  progressColor,
  onClick,
  valueClassName = "",
}: StatCardProps) {
  const trendColor = critical
    ? "text-critical"
    : positive
      ? "text-positive"
      : "text-on-surface-variant";

  return (
    <div
      onClick={onClick}
      className={`bg-surface-container border border-surface-container-high rounded-xl p-lg flex flex-col space-y-md ${
        onClick ? "cursor-pointer hover:bg-surface-container-high transition-colors" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-label-caps text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className={`p-md rounded-full ${iconBg || "bg-secondary-container"}`}>
            <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
        )}
      </div>
      <span className={`text-display-lg text-on-surface tabular-nums ${valueClassName}`}>{value}</span>
      {trend && (
        <span className={`text-body-sm ${trendColor}`}>{trend}</span>
      )}
      {progress !== undefined && (
        <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor || "bg-primary"}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
