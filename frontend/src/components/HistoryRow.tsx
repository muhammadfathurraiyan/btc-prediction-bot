import { cn } from "../lib/cn";
import { formatSignedUsd, formatUsd } from "../utils/formatPrice";
import type { BetEntry } from "../types";

interface HistoryRowProps {
  entry: BetEntry;
  isLast: boolean;
}

function formatBetResult(entry: BetEntry): string {
  if (entry.result === "pending") return "Pending…";
  if (entry.result === "win") {
    const payout = Math.round((entry.amt + entry.pnl) * 100) / 100;
    return `${formatSignedUsd(entry.pnl)} → ${formatUsd(payout)}`;
  }
  return formatSignedUsd(entry.pnl);
}

export function HistoryRow({ entry, isLast }: HistoryRowProps) {
  const isUp = entry.dir === "UP";

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-5 py-1.5 text-xs",
        !isLast && "border-b border-pm-border-subtle",
      )}
    >
      <span className="min-w-10 text-pm-muted-dim">{entry.time}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium w-fit",
          isUp ? "bg-pm-green/15 text-pm-green" : "bg-pm-red/15 text-pm-red",
        )}
      >
        {isUp ? "↑ UP" : "↓ DOWN"}
      </span>
      <span className="text-pm-muted text-right">
        {formatUsd(entry.amt)} @ {entry.conf}%
        {entry.demo && <span className="ml-1.5 text-[10px] text-pm-amber">DEMO</span>}
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium w-fit ml-auto",
          entry.result === "win" && "bg-pm-green/15 text-pm-green",
          entry.result === "loss" && "bg-pm-red/15 text-pm-red",
          entry.result === "pending" && "bg-pm-amber/15 text-pm-amber",
        )}
      >
        {formatBetResult(entry)}
      </span>
    </div>
  );
}
