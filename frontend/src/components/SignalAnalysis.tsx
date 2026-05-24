import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { Signals } from "../types";
import { getRsiBarClass, getRsiColorClass } from "../utils/signals";

interface SignalAnalysisProps {
  signals: Signals;
}

export function SignalAnalysis({ signals }: SignalAnalysisProps) {
  const rsiColor = getRsiColorClass(signals.rsi);
  const rsiBar = getRsiBarClass(signals.rsi);

  return (
    <div className="card">
      <div className="card-title">Signal Analysis</div>

      <SignalRow label="RSI (14) · Binance 1m">
        <div className="signal-bar">
          <div
            className={cn(
              "h-full rounded-sm transition-[width] duration-800",
              rsiBar,
            )}
            style={{ width: `${Math.min(100, signals.rsi)}%` }}
          />
        </div>
        <span className={cn("text-xs font-medium", rsiColor)}>
          {signals.rsi.toFixed(1)}
        </span>
      </SignalRow>

      <SignalRow label="EMA 9 / 21 cross">
        <div />
        <span
          className={cn(
            "text-xs font-medium",
            signals.ema === "Bullish" ? "text-pm-green" : "text-pm-red",
          )}
        >
          {signals.ema}
        </span>
      </SignalRow>

      <SignalRow label="5m volume vs avg (live)">
        <div className="signal-bar">
          <div
            className={cn(
              "h-full rounded-sm transition-[width] duration-800",
              signals.vol >= 0 ? "bg-pm-green" : "bg-pm-red",
            )}
            style={{ width: `${Math.min(100, Math.abs(signals.vol))}%` }}
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            signals.vol >= 0 ? "text-pm-green" : "text-pm-red",
          )}
        >
          {signals.vol >= 0 ? "+" : ""}
          {signals.vol.toFixed(0)}%
        </span>
      </SignalRow>

      <SignalRow label="Polymarket book Δ">
        <div />
        <span
          className={cn(
            "text-xs font-medium",
            signals.ob === "Bid heavy" ? "text-pm-green" : "text-pm-red",
          )}
        >
          {signals.ob}
        </span>
      </SignalRow>

      <SignalRow label="Market UP %" last>
        <div className="signal-bar">
          <div
            className="h-full rounded-sm bg-pm-blue transition-[width] duration-800"
            style={{ width: `${signals.marketUpPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-pm-blue">
          {signals.marketUpPct}%
        </span>
      </SignalRow>
    </div>
  );
}

function SignalRow({
  label,
  children,
  last,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5",
        !last && "border-b border-pm-border-subtle",
      )}
    >
      <span className="text-xs text-pm-text-tertiary">{label}</span>
      <div className="flex flex-1 items-center justify-between max-w-1/2">
        {children}
      </div>
    </div>
  );
}
