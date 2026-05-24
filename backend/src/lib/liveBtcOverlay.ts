import { getLiveChainlinkBtcUsd } from "./chainlinkPrice.js";
import { btcVsBeatPct } from "./priceToBeat.js";
import type { DashboardSignals } from "./signals.js";

export function applyLiveChainlinkOverlay(
  signals: DashboardSignals | null,
  priceToBeat: number | null,
): { signals: DashboardSignals | null; btcVsBeatPct: number | null } {
  if (!signals) return { signals, btcVsBeatPct: null };

  const live = getLiveChainlinkBtcUsd();
  if (live === null) {
    const vsBeat =
      priceToBeat !== null && priceToBeat > 0
        ? btcVsBeatPct(signals.btc, priceToBeat)
        : null;
    return { signals, btcVsBeatPct: vsBeat };
  }

  signals.btc = live;
  if (priceToBeat === null || priceToBeat <= 0) {
    return { signals, btcVsBeatPct: null };
  }

  const vsBeat = btcVsBeatPct(live, priceToBeat);
  signals.btcChange = vsBeat.toFixed(2);
  signals.isUp = live >= priceToBeat;
  return { signals, btcVsBeatPct: vsBeat };
}
