import type { Direction } from "../types";

export interface CopyPrediction {
  direction: Direction;
  pseudonym: string;
  transactionHash: string;
  timestamp: number;
  size: number;
  price: number;
  alreadyCopied: boolean;
}

export interface CopySettings {
  enabled: boolean;
  betSize: number;
  targetAddress: string;
}

export interface CopyTradeState {
  settings: CopySettings;
  prediction: CopyPrediction | null;
  lastAutoCopyError: string | null;
}
