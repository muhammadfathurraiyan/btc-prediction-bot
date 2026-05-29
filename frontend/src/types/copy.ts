import type { Direction } from "../types";

export interface CopyPrediction {
  direction: Direction;
  side: "BUY" | "SELL";
  outcome: string;
  pseudonym: string;
  transactionHash: string;
  timestamp: number;
  size: number;
  price: number;
  amountUsd: number;
  scaledAmountUsd: number;
  alreadyCopied: boolean;
}

export interface CopySettings {
  enabled: boolean;
  /** Max USDC per mirrored trade (target size scaled up to this cap). */
  betSize: number;
  /** % of spendable balance for copy batch (10–100). */
  budgetPct: number;
  targetAddress: string;
}

export interface CopyTradeState {
  settings: CopySettings;
  prediction: CopyPrediction | null;
  windowTradeCount: number;
  copiedCount: number;
  pendingCount: number;
  pendingTotalUsd: number;
  plannedCopyUsd: number;
  sizeScalePct: number | null;
  lastAutoCopyError: string | null;
}

export interface CopyExecuteResponse {
  bets: import("../types").BetEntry[];
  copied: number;
  skipped: number;
  bet?: import("../types").BetEntry;
}
