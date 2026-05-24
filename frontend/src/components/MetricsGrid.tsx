import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatSignedUsd, formatUsd } from "../utils/formatPrice";

interface MetricsGridProps {
  btc: number;
  btcChange: string;
  priceToBeat: number | null;
  btcVsBeatPct: number | null;
  balanceUsd: number | null;
  demoMode: boolean;
  demoBalance: number;
  winRate: number | null;
  resolvedCount: number;
  pnl: number;
  countdown: string;
}

export function MetricsGrid({
  btc,
  btcChange,
  priceToBeat,
  btcVsBeatPct,
  balanceUsd,
  demoMode,
  demoBalance,
  winRate,
  resolvedCount,
  pnl,
  countdown,
}: MetricsGridProps) {
  const btcChangeNum = Number(btcChange);
  const vsBeat = btcVsBeatPct ?? btcChangeNum;
  const beatPositive = vsBeat >= 0;
  const displayBalance = demoMode ? demoBalance : balanceUsd;
  const balanceLabel = demoMode ? "Demo balance" : "Balance";

  return (
    <div className="grid grid-cols-3 gap-3">
      <MetricCard
        label="BTC Price"
        value={formatUsd(btc)}
      >
        <span className="text-[11px] text-pm-muted-dim">
          Chainlink · Polymarket
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[11px]",
            beatPositive ? "text-pm-green" : "text-pm-red",
          )}
        >
          {beatPositive ? "+" : ""}
          {vsBeat.toFixed(2)}% vs beat
        </span>
      </MetricCard>

      <MetricCard
        label="Price to beat"
        value={priceToBeat !== null ? formatUsd(priceToBeat) : "—"}
        valueClassName="text-xl"
      >
        <span className="text-[11px] text-pm-muted-dim">
          window open (Chainlink)
        </span>
      </MetricCard>

      <MetricCard
        label={balanceLabel}
        value={displayBalance !== null ? formatUsd(displayBalance) : "—"}
        valueClassName={cn(
          "text-xl",
          demoMode
            ? "text-pm-amber"
            : displayBalance !== null && displayBalance > 0
              ? "text-pm-green"
              : "text-pm-text",
        )}
      >
        <span className="text-[11px] text-pm-muted-dim">
          {demoMode ? "paper USDC" : "live USDC"}
        </span>
      </MetricCard>

      <MetricCard
        label="Win Rate"
        value={winRate !== null ? `${winRate}%` : "—"}
        valueClassName={cn(
          winRate !== null && winRate >= 50 ? "text-pm-green" : "text-pm-text",
        )}
      >
        <span className="text-[11px] text-pm-muted-dim">
          {resolvedCount > 0
            ? `last ${resolvedCount} resolved`
            : "no resolved bets yet"}
        </span>
      </MetricCard>

      <MetricCard
        label="P&L (USDC)"
        value={formatSignedUsd(pnl)}
        valueClassName={pnl >= 0 ? "text-pm-green" : "text-pm-red"}
      >
        <span className="text-[11px] text-pm-muted-dim">session</span>
      </MetricCard>

      <MetricCard
        label="Next Window"
        value={countdown}
        valueClassName="tabular-nums text-[26px]"
      >
        <span className="text-[11px] text-pm-muted-dim">until resolution</span>
      </MetricCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
  children,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-pm-border bg-pm-text-quinary px-4 py-3">
      <div className="mb-1 text-[11px] tracking-widest text-pm-muted uppercase">
        {label}
      </div>
      <div
        className={cn(
          "text-[22px] font-medium",
          valueClassName ?? "text-pm-text",
        )}
      >
        {value}
      </div>
      {children && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
