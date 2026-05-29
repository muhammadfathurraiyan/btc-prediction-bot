import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeWinProfit } from "./betPnl.js";
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

/** Bets shown in the UI (newest first). Stats use the full ledger. */
const DISPLAY_LIMIT = 100;

const HISTORY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/bet-history.json",
);

const history: BetEntry[] = [];
let historyLoaded = false;

function formatTime(date = new Date()): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m < 10 ? "0" : ""}${m}`;
}

function persistHistory(): void {
  try {
    mkdirSync(dirname(HISTORY_FILE), { recursive: true });
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 0), "utf8");
  } catch {
    // Non-fatal: stats still work in memory for this process
  }
}

function parseStoredHistory(raw: unknown): BetEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: BetEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const b = row as BetEntry;
    if (
      typeof b.id === "string" &&
      (b.dir === "UP" || b.dir === "DOWN") &&
      typeof b.amt === "number" &&
      (b.result === "win" || b.result === "loss" || b.result === "pending")
    ) {
      valid.push({
        ...b,
        pnl: typeof b.pnl === "number" ? b.pnl : 0,
        conf: typeof b.conf === "number" ? b.conf : 0,
      });
    }
  }
  return valid.sort((a, b) => {
    const ta = a.windowStart ?? 0;
    const tb = b.windowStart ?? 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

/** Load persisted bets on server start (idempotent). */
export function initHistory(): void {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const raw = JSON.parse(readFileSync(HISTORY_FILE, "utf8")) as unknown;
    history.push(...parseStoredHistory(raw));
  } catch {
    // Missing or corrupt file — start empty
  }
}

export function listHistory(): BetEntry[] {
  return history.slice(0, DISPLAY_LIMIT);
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
  persistHistory();
  return bet;
}

export function updateBet(id: string, patch: Partial<Pick<BetEntry, "result" | "pnl">>): void {
  const bet = history.find((b) => b.id === id);
  if (!bet) return;
  Object.assign(bet, patch);
  persistHistory();
}

/** Win rate and net profit from every stored bet (signals + copy, demo + live). */
export function computeSessionStats(): SessionStats {
  const resolved = history.filter((b) => b.result === "win" || b.result === "loss");
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
  const pnl = won ? computeWinProfit(bet.amt, entryPrice) : -bet.amt;

  bet.result = won ? "win" : "loss";
  bet.pnl = pnl;

  if (bet.demo && won) {
    releaseDemoFunds(bet.amt, pnl);
  }

  persistHistory();
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
