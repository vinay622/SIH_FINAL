export interface HorizonSelectorProps {
  value: number;
  onChange: (horizon: number) => void;
  options?: number[];
  className?: string;
  label?: string;
}

export function HorizonSelector({
  value,
  onChange,
  options = [0, 24, 48, 72],
  className = "",
  label = "FORECAST HORIZON:",
}: HorizonSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="micro-label text-text-muted">{label}</span>}
      <div className="flex items-center bg-[#0b1524] p-0.5 rounded border border-[#16263c]">
        {options.map((opt) => {
          const isSelected = value === opt;
          const displayLabel = opt === 0 ? "T+0 (NOW)" : `+${opt}h`;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded transition-colors ${
                isSelected
                  ? "bg-primary text-[#00363e] shadow-[0_0_8px_rgba(138,235,255,0.4)]"
                  : "text-text-muted hover:text-text-primary hover:bg-[#16263c]/50"
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
