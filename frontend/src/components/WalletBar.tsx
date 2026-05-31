import { cn } from "../lib/cn";
import { formatUsd } from "../utils/formatPrice";
import { Switch } from "./ui/Switch";

interface WalletBarProps {
  balanceUsd: number | null;
  balanceError: string | null;
  demoMode: boolean;
  demoBalance: number;
  wsConnected: boolean;
  tradingEnabled: boolean;
  onToggleDemo: (enabled: boolean) => void;
}

export function WalletBar({
  balanceUsd,
  balanceError,
  demoMode,
  demoBalance,
  wsConnected,
  tradingEnabled,
  onToggleDemo,
}: WalletBarProps) {
  const liveLabel =
    balanceUsd !== null
      ? `${formatUsd(balanceUsd)} USDC`
      : balanceError
        ? "balance unavailable"
        : tradingEnabled
          ? "loading…"
          : "not connected";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pm-border bg-pm-surface px-4 py-2.5 text-[11px] tracking-wide">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-pm-muted">
          LIVE BALANCE{" "}
          {demoBalance ? (
            <span className="text-pm-amber">DEMO {formatUsd(demoBalance)}</span>
          ) : (
            <span
              className={cn(
                balanceUsd !== null && balanceUsd > 0
                  ? "text-pm-green"
                  : "text-pm-text",
              )}
            >
              {liveLabel}
            </span>
          )}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            wsConnected ? "text-pm-green" : "text-pm-muted",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              wsConnected ? "bg-pm-green" : "bg-pm-muted-faint",
            )}
          />
          {wsConnected ? "socket live" : "socket reconnecting"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-pm-muted">Demo trading</span>
        <Switch checked={demoMode} onChange={onToggleDemo} variant="amber" />
      </div>
    </div>
  );
}
