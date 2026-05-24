export type Direction = "UP" | "DOWN";
export type BetResult = "win" | "loss" | "pending";
export type EmaTrend = "Bullish" | "Bearish";
export type OrderBookBias = "Bid heavy" | "Ask heavy";

export interface BetEntry {
  id?: string;
  time: string;
  dir: Direction;
  amt: number;
  conf: number;
  result: BetResult;
  pnl: number;
  windowStart?: number;
  entryPrice?: number;
  demo?: boolean;
}

export interface SignalState {
  rsi: number;
  vol: number;
  marketUpPct: number;
  btc: number;
  ema: EmaTrend;
  ob: OrderBookBias;
}

export interface Signals extends SignalState {
  isUp: boolean;
  composite: number;
  btcChange: string;
  alignedSignals: number;
  totalSignals: number;
}
