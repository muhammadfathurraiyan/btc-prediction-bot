import { getChainlinkPriceAt, getLiveChainlinkBtcUsd } from "./chainlinkPrice.js";

let cachedWindowStart: number | null = null;
let cachedPriceToBeat: number | null = null;
/** First Chainlink price captured for each 5m window (windowStart → price). */
const windowOpenPrices = new Map<number, number>();

export function recordWindowOpenPrice(windowStart: number, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return;
  if (!windowOpenPrices.has(windowStart)) {
    windowOpenPrices.set(windowStart, Math.round(price * 100) / 100);
  }
  // Keep map small — only recent windows matter.
  if (windowOpenPrices.size > 12) {
    const oldest = [...windowOpenPrices.keys()].sort((a, b) => a - b)[0];
    if (oldest !== undefined) windowOpenPrices.delete(oldest);
  }
}

export async function fetchPriceToBeat(windowStart: number): Promise<number | null> {
  const recorded = windowOpenPrices.get(windowStart);
  if (recorded !== undefined) return recorded;

  if (cachedWindowStart === windowStart && cachedPriceToBeat !== null) {
    return cachedPriceToBeat;
  }

  const targetMs = windowStart * 1000;
  const nowSec = Math.floor(Date.now() / 1000);
  const inWindow = nowSec >= windowStart && nowSec < windowStart + 300;

  // Prefer historical tick at window open; allow up to full window when still live.
  let price = getChainlinkPriceAt(targetMs, inWindow ? 300_000 : 120_000);

  if (price === null && inWindow) {
    price = getLiveChainlinkBtcUsd();
  }

  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  if (inWindow) {
    recordWindowOpenPrice(windowStart, price);
    return price;
  }

  // Window closed — cache permanently.
  cachedWindowStart = windowStart;
  cachedPriceToBeat = price;
  recordWindowOpenPrice(windowStart, price);
  return price;
}

export function clearPriceToBeatCache(): void {
  cachedWindowStart = null;
  cachedPriceToBeat = null;
}

export function btcVsBeatPct(btc: number, priceToBeat: number): number {
  if (priceToBeat <= 0) return 0;
  return ((btc - priceToBeat) / priceToBeat) * 100;
}
