import type { BetEntry } from "../types";
import { HistoryRow } from "./HistoryRow";

interface BetHistoryProps {
  history: BetEntry[];
}

export function BetHistory({ history }: BetHistoryProps) {
  return (
    <div className="card">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="card-title !mb-0">Prediction History</div>
        <span className="text-[11px] tracking-wide text-pm-muted-faint">
          Recent predictions · stats use full ledger
        </span>
      </div>
      {history.length > 0 ? (
        history.map((entry, i) => (
          <HistoryRow
            key={entry.id ?? `${entry.time}-${entry.dir}-${i}`}
            entry={entry}
            isLast={i === history.length - 1}
          />
        ))
      ) : (
        <div className="text-center text-xs text-pm-muted-faint py-2">
          No predictions yet in this session
        </div>
      )}
    </div>
  );
}
