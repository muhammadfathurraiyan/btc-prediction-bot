import type { BetEntry, Signals } from "../types";
import type { CopyTradeState } from "../types/copy";

export interface AccountInfo {
  signerAddress: string;
  funderAddress: string;
  signatureType: string;
  apiConfigured: boolean;
}

export interface MarketInfo {
  slug: string;
  windowStart: number;
  windowEnd: number;
  question?: string;
  upTokenId?: string;
  downTokenId?: string;
}

export interface DashboardResponse {
  market: MarketInfo | null;
  signals: Signals | null;
  countdownSeconds: number;
  balanceUsd: number | null;
  balanceError: string | null;
  history: BetEntry[];
  tradingEnabled: boolean;
  winRate: number | null;
  sessionPnl: number;
  resolvedCount: number;
  totalBetCount: number;
  pendingBetCount: number;
  copyTrade: CopyTradeState;
  priceToBeat: number | null;
  btcVsBeatPct: number | null;
  demoMode: boolean;
  demoBalance: number;
  canTradeLive: boolean;
  canTradeDemo: boolean;
  wsConnected: boolean;
  account: AccountInfo | null;
}

export interface PlaceBetResponse {
  bet: BetEntry;
  orderResponse: unknown;
  demo?: boolean;
}

export type WsMessage =
  | { type: "connected" }
  | { type: "tick"; btc: number; ts: number }
  | { type: "dashboard"; data: DashboardResponse }
  | { type: "error"; message: string };
