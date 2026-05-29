/** Net profit on a binary market win (USDC staked, price in 0–1). */
export function computeWinProfit(amountUsd: number, entryPrice: number): number {
  const price = entryPrice > 0 && entryPrice < 1 ? entryPrice : 0.5;
  return Math.round(amountUsd * ((1 / price) - 1) * 100) / 100;
}

export function computeWinPayout(amountUsd: number, entryPrice: number): number {
  return Math.round((amountUsd + computeWinProfit(amountUsd, entryPrice)) * 100) / 100;
}
