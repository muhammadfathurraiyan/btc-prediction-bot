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
  betSize: number;
  mirrorPct: number;
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
  accountRatioPct: number | null;
  yourAccountUsd: number | null;
  targetAccountUsd: number | null;
  targetAccountSource: "auto" | "inferred" | null;
  batchScalePct: number | null;
  lastAutoCopyError: string | null;
}

export interface CopyExecuteResponse {
  bets: import("../types").BetEntry[];
  copied: number;
  skipped: number;
  bet?: import("../types").BetEntry;
}
