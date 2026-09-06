export interface MapLegendProps {
  type?: "risk" | "ice";
  className?: string;
}

export function MapLegend({ type = "risk", className = "" }: MapLegendProps) {
  if (type === "risk") {
    return (
      <div className={`bg-[#080e19]/90 border border-[#16263c] backdrop-blur-md p-2.5 rounded shadow-lg font-mono text-[10px] ${className}`}>
        <div className="flex items-center justify-between text-text-muted mb-1 font-semibold tracking-wider">
          <span>RISK SEVERITY</span>
          <span className="text-primary">0.0 → 1.0</span>
        </div>
        <div className="h-2 rounded-sm w-44 bg-gradient-to-r from-emerald-500 via-yellow-500 via-orange-500 to-red-600 border border-white/10" />
        <div className="flex justify-between text-[9px] text-[#94a3b8] mt-1">
          <span>SAFE</span>
          <span>MOD</span>
          <span>CRIT</span>
          <span>BLOCK</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#080e19]/90 border border-[#16263c] backdrop-blur-md p-2.5 rounded shadow-lg font-mono text-[10px] ${className}`}>
      <div className="flex items-center justify-between text-text-muted mb-1 font-semibold tracking-wider">
        <span>ICE CONCENTRATION</span>
        <span className="text-primary">0% → 100%</span>
      </div>
      <div className="h-2 rounded-sm w-44 bg-gradient-to-r from-transparent via-cyan-600 via-sky-300 to-white border border-white/10" />
      <div className="flex justify-between text-[9px] text-[#94a3b8] mt-1">
        <span>OPEN</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
