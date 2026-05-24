export function computeRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export function computeEma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Compare volume vs trailing 5m average.
 * @param windowElapsedRatio 0–1 fraction of the current 5m candle elapsed (for live in-progress bar).
 *   Uses pro-rated expected volume so early-candle reads are not stuck at 0%.
 */
export function computeVolumeSpikePct(volumes: number[], windowElapsedRatio?: number): number {
  if (volumes.length < 2) return 0;

  const completed = volumes.slice(0, -1);
  const current = volumes[volumes.length - 1];
  if (completed.length === 0) return 0;

  const avgCompleted = completed.reduce((sum, v) => sum + v, 0) / completed.length;
  if (avgCompleted === 0) return 0;

  let pct: number;

  if (windowElapsedRatio !== undefined && windowElapsedRatio > 0 && windowElapsedRatio < 1) {
    const expectedSoFar = avgCompleted * Math.max(0.1, windowElapsedRatio);
    pct = ((current / expectedSoFar) - 1) * 100;
  } else {
    const lastClosed = completed[completed.length - 1]!;
    const prior = completed.slice(0, -1);
    const baseline =
      prior.length > 0 ? prior.reduce((sum, v) => sum + v, 0) / prior.length : avgCompleted;
    if (baseline === 0) return 0;
    pct = ((lastClosed / baseline) - 1) * 100;
  }

  return Math.round(Math.max(-100, Math.min(100, pct)));
}
