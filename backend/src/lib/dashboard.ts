import type { ClobClient } from "@polymarket/clob-client-v2";
import { createTradingClientFromEnv } from "./clobClient.js";
import { fetchBalanceUsd } from "./balance.js";
import { getCopyTradeState, maybeAutoCopy } from "./copyTrade.js";
import {
  getDemoBalance,
  isDemoActive,
  setDemoMode,
} from "./demo.js";
import { loadServerEnv } from "./env.js";
import { computeSessionStats, listHistory, resolvePendingBets } from "./history.js";
import { fetchCurrentBtc5mMarket } from "./market.js";
import { fetchPriceToBeat } from "./priceToBeat.js";
import { getPublicClient } from "./publicClient.js";
import { fetchWindowOutcome, isWindowResolvable, parseWindowStartFromSlug } from "./resolve.js";
import { buildSignals } from "./signals.js";
import { getAccountInfo, type AccountInfo } from "./account.js";
import { applyLiveChainlinkOverlay } from "./liveBtcOverlay.js";

export interface DashboardSnapshot {
  market: Awaited<ReturnType<typeof fetchCurrentBtc5mMarket>>;
  signals: Awaited<ReturnType<typeof buildSignals>> | null;
  countdownSeconds: number;
  balanceUsd: number | null;
  balanceError: string | null;
  history: ReturnType<typeof listHistory>;
  tradingEnabled: boolean;
  winRate: number | null;
  sessionPnl: number;
  resolvedCount: number;
  copyTrade: Awaited<ReturnType<typeof getCopyTradeState>>;
  priceToBeat: number | null;
  btcVsBeatPct: number | null;
  demoMode: boolean;
  demoBalance: number;
  canTradeLive: boolean;
  canTradeDemo: boolean;
  wsConnected: boolean;
  account: AccountInfo | null;
}

let cachedTradingClient: ClobClient | null | undefined;

async function getTradingClient(): Promise<ClobClient | null> {
  if (cachedTradingClient !== undefined) return cachedTradingClient;
  try {
    const env = loadServerEnv(false);
    cachedTradingClient = await createTradingClientFromEnv(env);
  } catch {
    cachedTradingClient = null;
  }
  return cachedTradingClient;
}

export async function buildDashboardSnapshot(wsConnected = false): Promise<DashboardSnapshot> {
  await resolvePendingBets(fetchWindowOutcome, isWindowResolvable, parseWindowStartFromSlug);

  const market = await fetchCurrentBtc5mMarket();
  const stats = computeSessionStats();

  let balanceUsd: number | null = null;
  let balanceError: string | null = null;
  let tradingEnabled = false;
  const tradingClient = await getTradingClient();
  tradingEnabled = tradingClient !== null;

  if (tradingClient) {
    const balance = await fetchBalanceUsd(tradingClient);
    balanceUsd = balance.balanceUsd;
    balanceError = balance.balanceError;
  }

  const demoMode = isDemoActive(balanceUsd);
  const demoBalance = getDemoBalance();
  const canTradeLive = tradingEnabled && balanceUsd !== null && balanceUsd > 0;
  const canTradeDemo = demoMode && demoBalance > 0;

  await maybeAutoCopy(tradingClient, market, balanceUsd);
  const copyTrade = await getCopyTradeState(market);

  let priceToBeat: number | null = null;
  let btcVsBeat: number | null = null;
  let countdownSeconds = 0;
  let signals: Awaited<ReturnType<typeof buildSignals>> | null = null;

  if (market) {
    priceToBeat = await fetchPriceToBeat(market.windowStart);
    countdownSeconds = Math.max(0, market.windowEnd - Math.floor(Date.now() / 1000));
    const publicClient = getPublicClient();
    const built = await buildSignals(market, publicClient);
    const overlay = applyLiveChainlinkOverlay(built, priceToBeat);
    signals = overlay.signals;
    btcVsBeat = overlay.btcVsBeatPct;
  }

  return {
    market,
    signals,
    countdownSeconds,
    balanceUsd,
    balanceError,
    history: listHistory(),
    tradingEnabled,
    winRate: stats.winRate,
    sessionPnl: stats.sessionPnl,
    resolvedCount: stats.resolvedCount,
    copyTrade,
    priceToBeat,
    btcVsBeatPct: btcVsBeat,
    demoMode,
    demoBalance,
    canTradeLive,
    canTradeDemo,
    wsConnected,
    account: getAccountInfo(),
  };
}

export function updateDemoMode(
  enabled: boolean,
  balanceUsd: number | null,
): { demoMode: boolean; demoBalance: number } {
  setDemoMode(enabled, !enabled);
  return { demoMode: isDemoActive(balanceUsd), demoBalance: getDemoBalance() };
}
