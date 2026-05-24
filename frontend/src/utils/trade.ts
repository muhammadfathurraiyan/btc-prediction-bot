export function canAffordAmount(
  demoMode: boolean,
  demoBalance: number,
  balanceUsd: number | null,
  amount: number,
): boolean {
  return demoMode ? demoBalance >= amount : (balanceUsd ?? 0) >= amount;
}

export function canPlaceTrade(
  demoMode: boolean,
  canTradeDemo: boolean,
  canTradeLive: boolean,
): boolean {
  return demoMode ? canTradeDemo : canTradeLive;
}
