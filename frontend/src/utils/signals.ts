import type { EmaTrend, OrderBookBias } from "../types";

export function getRsiColorClass(rsi: number): string {
  if (rsi > 65) return "text-pm-red";
  if (rsi < 40) return "text-pm-blue";
  return "text-pm-amber";
}

export function getRsiBarClass(rsi: number): string {
  if (rsi > 65) return "bg-pm-red";
  if (rsi < 40) return "bg-pm-blue";
  return "bg-pm-amber";
}

export const EMPTY_SIGNAL_BASE = {
  rsi: 50,
  vol: 0,
  marketUpPct: 50,
  btc: 0,
  ema: "Bearish" as EmaTrend,
  ob: "Ask heavy" as OrderBookBias,
};
