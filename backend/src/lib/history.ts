import { releaseDemoFunds } from "./demo.js";

export type BetDirection = "UP" | "DOWN";
export type BetResult = "win" | "loss" | "pending";

export interface BetEntry {
  id: string;
  time: string;
  dir: BetDirection;
  amt: number;
  conf: number;
  result: BetResult;
  pnl: number;
  orderId?: string;
  slug?: string;
  windowStart?: number;
  entryPrice?: number;
  demo?: boolean;
}

export interface SessionStats {
  winRate: number | null;
  sessionPnl: number;
  resolvedCount: number;
  pendingCount: number;
  totalCount: number;
}

const MAX_ENTRIES = 50;
const history: BetEntry[] = [];

function formatTime(date = new Date()): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m < 10 ? "0" : ""}${m}`;
}

export function listHistory(): BetEntry[] {
  return [...history];
}

export function addBet(
  entry: Omit<BetEntry, "id" | "time" | "result" | "pnl"> & Partial<Pick<BetEntry, "orderId">>,
): BetEntry {
  const bet: BetEntry = {
    id: crypto.randomUUID(),
    time: formatTime(),
    result: "pending",
    pnl: 0,
    ...entry,
  };
  history.unshift(bet);
  if (history.length > MAX_ENTRIES) history.pop();
  return bet;
}

export function updateBet(id: string, patch: Partial<Pick<BetEntry, "result" | "pnl">>): void {
  const bet = history.find((b) => b.id === id);
  if (!bet) return;
  Object.assign(bet, patch);
}

export function computeSessionStats(): SessionStats {
  const resolved = history.filter((b) => b.result !== "pending");
  const pending = history.filter((b) => b.result === "pending");
  const wins = resolved.filter((b) => b.result === "win").length;
  const sessionPnl = Math.round(resolved.reduce((sum, b) => sum + b.pnl, 0) * 100) / 100;

  return {
    winRate: resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : null,
    sessionPnl,
    resolvedCount: resolved.length,
    pendingCount: pending.length,
    totalCount: history.length,
  };
}

export function settleBet(bet: BetEntry, outcome: BetDirection): BetEntry {
  if (bet.result !== "pending") return bet;
  const won = bet.dir === outcome;
  const entryPrice = bet.entryPrice && bet.entryPrice > 0 ? bet.entryPrice : 0.5;
  const pnl = won
    ? Math.round(bet.amt * ((1 / entryPrice) - 1) * 100) / 100
    : -bet.amt;

  bet.result = won ? "win" : "loss";
  bet.pnl = pnl;

  if (bet.demo && won) {
    releaseDemoFunds(bet.amt, pnl);
  }

  return bet;
}

export async function resolvePendingBets(
  fetchOutcome: (windowStart: number) => Promise<BetDirection>,
  isReady: (windowStart: number) => boolean,
  parseWindowStart: (slug?: string) => number | null,
): Promise<void> {
  for (const bet of history) {
    if (!bet.windowStart && bet.slug) {
      bet.windowStart = parseWindowStart(bet.slug) ?? undefined;
    }
  }

  const pending = history.filter((b) => b.result === "pending");
  const seen = new Set<number>();

  for (const bet of pending) {
    const windowStart = bet.windowStart ?? parseWindowStart(bet.slug);
    if (windowStart === null || seen.has(windowStart)) continue;
    if (!isReady(windowStart)) continue;

    seen.add(windowStart);
    try {
      const outcome = await fetchOutcome(windowStart);
      for (const b of history) {
        if (b.result !== "pending") continue;
        const ws = b.windowStart ?? parseWindowStart(b.slug);
        if (ws === windowStart) settleBet(b, outcome);
      }
    } catch {
      // Skip until Chainlink price data is available
    }
  }
}
