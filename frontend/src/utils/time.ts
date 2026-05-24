export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function btcVsBeatPct(btc: number, priceToBeat: number): number {
  return ((btc - priceToBeat) / priceToBeat) * 100;
}
