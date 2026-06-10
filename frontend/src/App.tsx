import { useState, useCallback } from "react";
import { AccountInfo } from "./components/AccountInfo";
import { BetHistory } from "./components/BetHistory";
import { MetricsGrid } from "./components/MetricsGrid";
import { SignalAnalysis } from "./components/SignalAnalysis";
import { TopBar } from "./components/TopBar";
import { TradingPanel } from "./components/TradingPanel";
import { WalletBar } from "./components/WalletBar";
import { useDashboard } from "./hooks/useDashboard";
import { canAffordAmount, canPlaceTrade } from "./utils/trade";

export default function BTCPredictionBot() {
  const [botActive, setBotActive] = useState(true);
  const [betSize, setBetSize] = useState(10);
  const [minConf, setMinConf] = useState(65);

  const {
    signals,
    history,
    countdown,
    balanceUsd,
    balanceError,
    tradingEnabled,
    winRate,
    sessionPnl,
    resolvedCount,
    totalBetCount,
    pendingBetCount,
    error,
    placingBet,
    placeBet,
    copyTrade,
    copying,
    priceToBeat,
    btcVsBeatPct,
    liveBtc,
    chainlinkError,
    demoMode,
    demoBalance,
    canTradeLive,
    canTradeDemo,
    wsConnected,
    account,
    toggleDemoMode,
    toggleAutoCopy,
    updateCopyBetSize,
    updateCopyMirrorPct,
    updateCopyTarget,
    copyNow,
  } = useDashboard(botActive);

  const canBet =
    signals.composite >= minConf &&
    canAffordAmount(demoMode, demoBalance, balanceUsd, betSize) &&
    canPlaceTrade(demoMode, canTradeDemo, canTradeLive);

  const handlePlaceBet = useCallback(async () => {
    if (!canBet) return;
    const direction = signals.isUp ? "UP" : "DOWN";
    await placeBet(direction, betSize, signals.composite);
  }, [signals.composite, signals.isUp, betSize, placeBet, canBet]);

  const nextCopyUsd =
    copyTrade.prediction?.scaledAmountUsd ??
    (copyTrade.pendingCount > 0
      ? copyTrade.plannedCopyUsd / copyTrade.pendingCount
      : copyTrade.settings.betSize);
  const canCopy =
    copyTrade.pendingCount > 0 &&
    canAffordAmount(demoMode, demoBalance, balanceUsd, nextCopyUsd) &&
    canPlaceTrade(demoMode, canTradeDemo, canTradeLive);

  return (
    <div className="min-h-screen bg-pm-bg px-5 py-6 space-y-3 font-mono text-pm-text">
      <TopBar botActive={botActive} onToggle={() => setBotActive((a) => !a)} />

      {chainlinkError && (
        <div className="px-4 py-2 text-xs tracking-wide text-amber-400">
          {chainlinkError}
        </div>
      )}

      {(error || copyTrade.lastAutoCopyError) && (
        <div className="px-4 py-2 text-xs tracking-wide text-red-400">
          {error ?? copyTrade.lastAutoCopyError}
        </div>
      )}

      <WalletBar
        balanceUsd={balanceUsd}
        balanceError={balanceError}
        demoMode={demoMode}
        demoBalance={demoBalance}
        wsConnected={wsConnected}
        tradingEnabled={tradingEnabled}
        onToggleDemo={toggleDemoMode}
      />

      <MetricsGrid
        btc={liveBtc}
        btcChange={signals.btcChange}
        priceToBeat={priceToBeat}
        btcVsBeatPct={btcVsBeatPct}
        chainlinkError={chainlinkError}
        balanceUsd={balanceUsd}
        demoMode={demoMode}
        demoBalance={demoBalance}
        winRate={winRate}
        resolvedCount={resolvedCount}
        totalBetCount={totalBetCount}
        pendingBetCount={pendingBetCount}
        pnl={sessionPnl}
        countdown={countdown}
      />

      <div className="grid grid-cols-2 items-stretch gap-3">
        <div className="flex min-h-full flex-col gap-3">
          <AccountInfo
            account={account}
            balanceUsd={balanceUsd}
            balanceError={balanceError}
            tradingEnabled={tradingEnabled}
            demoMode={demoMode}
            demoBalance={demoBalance}
          />
          <SignalAnalysis signals={signals} />
        </div>
        <div className="flex min-h-full">
          <TradingPanel
            signals={signals}
            betSize={betSize}
            minConf={minConf}
            placingBet={placingBet}
            canBet={canBet}
            demoMode={demoMode}
            copyTrade={copyTrade}
            canCopy={canCopy}
            copying={copying}
            onBetSizeChange={setBetSize}
            onMinConfChange={setMinConf}
            onPlaceBet={handlePlaceBet}
            onToggleAutoCopy={toggleAutoCopy}
            onCopyBetSizeChange={updateCopyBetSize}
            onCopyMirrorPctChange={updateCopyMirrorPct}
            onCopyTargetChange={updateCopyTarget}
            onCopyNow={() => copyNow(true)}
          />
        </div>
      </div>

      <BetHistory history={history} />
    </div>
  );
}
