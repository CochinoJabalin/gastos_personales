"use client";

interface ConditionalChipProps {
  label: string;
  variant?: "success" | "critical" | "info" | "warning";
  icon?: string;
}

const variantStyles: Record<string, string> = {
  success: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
  critical: "bg-[#F59E0B] text-black border-[#F59E0B]/30",
  info: "bg-[#adc6ff]/10 text-[#adc6ff] border-[#adc6ff]/20",
  warning: "bg-[#ffb786]/10 text-[#ffb786] border-[#ffb786]/20",
};

export default function ConditionalChip({
  label,
  variant = "info",
  icon,
}: ConditionalChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-xs px-sm py-[2px] border rounded-full text-label-caps ${variantStyles[variant]}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[12px]">{icon}</span>
      )}
      {label}
    </span>
  );
}
