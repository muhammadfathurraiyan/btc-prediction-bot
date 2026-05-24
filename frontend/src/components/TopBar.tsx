import { cn } from "../lib/cn";

interface TopBarProps {
  botActive: boolean;
  onToggle: () => void;
}

export function TopBar({ botActive, onToggle }: TopBarProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-lg font-medium tracking-wide text-pm-text">BTC_PREDICTION_BOT</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            botActive
              ? "border-pm-green bg-pm-green/20 text-pm-green"
              : "border-pm-amber bg-pm-amber/20 text-pm-amber",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              botActive ? "animate-pulse-dot bg-pm-green" : "bg-pm-amber",
            )}
          />
          {botActive ? "LIVE" : "PAUSED"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] tracking-widest text-pm-muted-dim">5-MIN WINDOW</span>
        <button type="button" className="btn-ghost !flex-none px-3.5 py-1.5" onClick={onToggle}>
          {botActive ? "PAUSE" : "RESUME"}
        </button>
      </div>
    </div>
  );
}
