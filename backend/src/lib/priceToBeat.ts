import { getChainlinkPriceAt, getLiveChainlinkBtcUsd } from "./chainlinkPrice.js";

let cachedWindowStart: number | null = null;
let cachedPriceToBeat: number | null = null;

export async function fetchPriceToBeat(windowStart: number): Promise<number | null> {
  if (cachedWindowStart === windowStart && cachedPriceToBeat !== null) {
    return cachedPriceToBeat;
  }

  const targetMs = windowStart * 1000;
  let price = getChainlinkPriceAt(targetMs);

  // Fall back to live price whenever no historical tick is available for this
  // window — not just in the first 60 s. The window is still open so the live
  // price is the best approximation we have.
  const nowSec = Math.floor(Date.now() / 1000);
  if (price === null && nowSec >= windowStart && nowSec < windowStart + 300) {
    price = getLiveChainlinkBtcUsd();
  }

  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  // Only cache once the window has fully elapsed so we don't lock in a
  // mid-window live-price approximation as the permanent open price.
  if (nowSec >= windowStart + 300) {
    cachedWindowStart = windowStart;
    cachedPriceToBeat = price;
  }

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
