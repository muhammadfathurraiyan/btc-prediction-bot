import { useCallback, useEffect, useRef, useState } from "react";
import {
  executeCopyTradeApi,
  fetchDashboard,
  getWsUrl,
  placeBetApi,
  setDemoModeApi,
  updateCopySettingsApi,
} from "../lib/api";
import type { BetEntry, Signals } from "../types";
import type { AccountInfo, DashboardResponse, WsMessage } from "../types/api";
import type { CopyTradeState } from "../types/copy";
import { EMPTY_SIGNAL_BASE } from "../utils/signals";
import { btcVsBeatPct, formatCountdown, getCountdownSeconds } from "../utils/time";

const HTTP_FALLBACK_MS = 10000;

const DEFAULT_COPY_TRADE: CopyTradeState = {
  settings: {
    enabled: false,
    betSize: 100,
    budgetPct: 50,
    targetAddress: "0xb17a1076a5ce053bd117a6eb51b309678d26f7e6",
  },
  prediction: null,
  windowTradeCount: 0,
  copiedCount: 0,
  pendingCount: 0,
  pendingTotalUsd: 0,
  plannedCopyUsd: 0,
  sizeScalePct: null,
  lastAutoCopyError: null,
};

export function useDashboard(active: boolean) {
  const [signals, setSignals] = useState<Signals>({
    ...EMPTY_SIGNAL_BASE,
    isUp: false,
    composite: 0,
    btcChange: "0.00",
    alignedSignals: 0,
    totalSignals: 5,
  });
  const [history, setHistory] = useState<BetEntry[]>([]);
  const [countdown, setCountdown] = useState("0:00");
  const [windowEnd, setWindowEnd] = useState<number | null>(null);
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [sessionPnl, setSessionPnl] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalBetCount, setTotalBetCount] = useState(0);
  const [pendingBetCount, setPendingBetCount] = useState(0);
  const [placingBet, setPlacingBet] = useState(false);
  const [copyTrade, setCopyTrade] = useState<CopyTradeState>(DEFAULT_COPY_TRADE);
  const [copying, setCopying] = useState(false);
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null);
  const [btcVsBeatPctState, setBtcVsBeatPct] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBalance, setDemoBalance] = useState(1000);
  const [canTradeLive, setCanTradeLive] = useState(false);
  const [canTradeDemo, setCanTradeDemo] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const applyDashboard = useCallback((data: DashboardResponse) => {
    if (data.signals) setSignals(data.signals);
    setHistory(data.history);
    setCountdown(formatCountdown(data.countdownSeconds));
    setWindowEnd(data.market?.windowEnd ?? null);
    setBalanceUsd(data.balanceUsd);
    setBalanceError(data.balanceError);
    setTradingEnabled(data.tradingEnabled);
    setWinRate(data.winRate);
    setSessionPnl(data.sessionPnl);
    setResolvedCount(data.resolvedCount);
    setTotalBetCount(data.totalBetCount ?? data.history.length);
    setPendingBetCount(data.pendingBetCount ?? 0);
    if (data.copyTrade) setCopyTrade(data.copyTrade);
    setPriceToBeat(data.priceToBeat);
    priceToBeatRef.current = data.priceToBeat;
    setBtcVsBeatPct(data.btcVsBeatPct);
    setDemoMode(data.demoMode);
    setDemoBalance(data.demoBalance);
    setCanTradeLive(data.canTradeLive);
    setCanTradeDemo(data.canTradeDemo);
    setWsConnected(data.wsConnected);
    setAccount(data.account ?? null);
    setError(null);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const priceToBeatRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          if (msg.type === "dashboard") {
            applyDashboard(msg.data);
          } else if (msg.type === "tick") {
            const beat = priceToBeatRef.current;
            if (beat !== null && beat > 0) {
              const pct = btcVsBeatPct(msg.btc, beat);
              setBtcVsBeatPct(pct);
              setSignals((prev) => ({
                ...prev,
                btc: msg.btc,
                btcChange: pct.toFixed(2),
                isUp: msg.btc >= beat,
              }));
            } else {
              setSignals((prev) => ({ ...prev, btc: msg.btc }));
            }
          } else if (msg.type === "connected") {
            setWsConnected(true);
          } else if (msg.type === "error") {
            setError(msg.message);
          }
        } catch {
          // ignore bad frames
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          setWsConnected(false);
          setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    fallbackTimer = setInterval(async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const data = await fetchDashboard();
        if (!cancelled) applyDashboard(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to reach backend");
        }
      }
    }, HTTP_FALLBACK_MS);

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [active, applyDashboard]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setCountdown(formatCountdown(getCountdownSeconds(windowEnd)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, windowEnd]);

  const placeBet = useCallback(
    async (direction: "UP" | "DOWN", amount: number, confidence: number) => {
      setPlacingBet(true);
      setError(null);
      try {
        const result = await placeBetApi(direction, amount, confidence);
        setHistory((prev) => [result.bet, ...prev]);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bet failed";
        setError(message);
        throw err;
      } finally {
        setPlacingBet(false);
      }
    },
    [],
  );

  const toggleDemoMode = useCallback(async (enabled: boolean) => {
    try {
      const result = await setDemoModeApi(enabled);
      setDemoMode(result.demoMode);
      setDemoBalance(result.demoBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update demo mode");
    }
  }, []);

  const toggleAutoCopy = useCallback(async (enabled: boolean) => {
    try {
      const { settings } = await updateCopySettingsApi({ enabled });
      setCopyTrade((prev) => ({ ...prev, settings }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update copy settings");
    }
  }, []);

  const updateCopyBetSize = useCallback(async (betSize: number) => {
    setCopyTrade((prev) => ({ ...prev, settings: { ...prev.settings, betSize } }));
    try {
      await updateCopySettingsApi({ betSize });
    } catch {
      // Re-sync on next dashboard message
    }
  }, []);

  const updateCopyBudgetPct = useCallback(async (budgetPct: number) => {
    setCopyTrade((prev) => ({ ...prev, settings: { ...prev.settings, budgetPct } }));
    try {
      await updateCopySettingsApi({ budgetPct });
    } catch {
      // Re-sync on next dashboard message
    }
  }, []);

  const updateCopyTarget = useCallback(async (targetAddress: string) => {
    try {
      const { settings } = await updateCopySettingsApi({ targetAddress });
      setCopyTrade((prev) => ({
        ...prev,
        settings,
        prediction: null,
        lastAutoCopyError: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update copy target";
      setError(message);
      throw err;
    }
  }, []);

  const copyNow = useCallback(async (force = false) => {
    setCopying(true);
    setError(null);
    try {
      const result = await executeCopyTradeApi(copyTrade.settings.betSize, force);
      if (result.bets.length > 0) {
        setHistory((prev) => [...result.bets, ...prev]);
      }
      setCopyTrade((prev) => ({
        ...prev,
        lastAutoCopyError: null,
        copiedCount: prev.copiedCount + result.copied,
        pendingCount: Math.max(0, prev.pendingCount - result.copied),
      }));
      const data = await fetchDashboard();
      applyDashboard(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Copy trade failed";
      setError(message);
      setCopyTrade((prev) => ({ ...prev, lastAutoCopyError: message }));
    } finally {
      setCopying(false);
    }
  }, [applyDashboard, copyTrade.settings.betSize]);

  return {
    signals,
    history,
    countdown,
    balanceUsd,
    balanceError,
    tradingEnabled,
    error,
    placingBet,
    winRate,
    sessionPnl,
    resolvedCount,
    totalBetCount,
    pendingBetCount,
    copyTrade,
    copying,
    priceToBeat,
    btcVsBeatPct: btcVsBeatPctState,
    demoMode,
    demoBalance,
    canTradeLive,
    canTradeDemo,
    wsConnected,
    account,
    placeBet,
    toggleDemoMode,
    toggleAutoCopy,
    updateCopyBetSize,
    updateCopyBudgetPct,
    updateCopyTarget,
    copyNow,
  };
}
