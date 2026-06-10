import { btcVsBeatPct } from "./priceToBeat.js";
import type { DashboardSignals } from "./signals.js";

export function applyLiveChainlinkOverlay(
  signals: DashboardSignals | null,
  priceToBeat: number | null,
  liveBtc: number | null,
): { signals: DashboardSignals | null; btcVsBeatPct: number | null } {
  if (!signals || liveBtc === null) {
    return { signals, btcVsBeatPct: null };
  }

  if (priceToBeat === null || priceToBeat <= 0) {
    return { signals, btcVsBeatPct: null };
  }

  signals.btc = liveBtc;
  const vsBeat = btcVsBeatPct(liveBtc, priceToBeat);
  signals.btcChange = vsBeat.toFixed(2);
  signals.isUp = liveBtc >= priceToBeat;
  return { signals, btcVsBeatPct: vsBeat };
}
