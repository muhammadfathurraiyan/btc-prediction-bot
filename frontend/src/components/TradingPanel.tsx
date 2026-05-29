import { useEffect, useState, type ReactNode } from "react";
import {
  CopyTradeHowItWorksContent,
  SignalsHowItWorksContent,
} from "../content/howItWorks";
import { cn } from "../lib/cn";
import { formatUsd } from "../utils/formatPrice";
import type { Signals } from "../types";
import type { CopyTradeState } from "../types/copy";
import { Dialog } from "./Dialog";
import { Switch } from "./ui/Switch";
import { TrendDownIcon, TrendUpIcon } from "./Icons";

type Tab = "signals" | "copy";

interface TradingPanelProps {
  signals: Signals;
  betSize: number;
  minConf: number;
  placingBet?: boolean;
  canBet?: boolean;
  demoMode?: boolean;
  copyTrade: CopyTradeState;
  canCopy?: boolean;
  copying: boolean;
  onBetSizeChange: (value: number) => void;
  onMinConfChange: (value: number) => void;
  onPlaceBet: () => void;
  onToggleAutoCopy: (enabled: boolean) => void;
  onCopyBetSizeChange: (size: number) => void;
  onCopyBudgetPctChange: (pct: number) => void;
  onCopyTargetChange: (address: string) => Promise<void>;
  onCopyNow: () => void;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function TradingPanel({
  signals,
  betSize,
  minConf,
  placingBet = false,
  canBet = true,
  demoMode = false,
  copyTrade,
  canCopy = false,
  copying,
  onBetSizeChange,
  onMinConfChange,
  onPlaceBet,
  onToggleAutoCopy,
  onCopyBetSizeChange,
  onCopyBudgetPctChange,
  onCopyTargetChange,
  onCopyNow,
}: TradingPanelProps) {
  const [tab, setTab] = useState<Tab>("signals");
  const [signalsHelpOpen, setSignalsHelpOpen] = useState(false);
  const [copyHelpOpen, setCopyHelpOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const {
    settings,
    prediction,
    windowTradeCount,
    copiedCount,
    pendingCount,
    pendingTotalUsd,
    plannedCopyUsd,
    sizeScalePct,
    lastAutoCopyError,
  } = copyTrade;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetInput(settings.targetAddress);
  }, [settings.targetAddress]);
  const copyDir = prediction?.direction;
  const copyIsUp = copyDir === "UP";
  const targetAction =
    prediction &&
    `${prediction.side} ${prediction.outcome.toLowerCase() === "up" ? "UP" : "DOWN"}`;

  async function applyTarget() {
    const trimmed = targetInput.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setTargetError("Enter a valid address (0x + 40 hex characters)");
      return;
    }
    if (trimmed.toLowerCase() === settings.targetAddress.toLowerCase()) return;

    setTargetSaving(true);
    setTargetError(null);
    try {
      await onCopyTargetChange(trimmed);
    } catch (err) {
      setTargetError(
        err instanceof Error ? err.message : "Failed to update target",
      );
    } finally {
      setTargetSaving(false);
    }
  }

  return (
    <div className="card flex min-h-full w-full flex-1 flex-col box-border">
      <p
        className={cn(
          "mb-2.5 text-[10px] tracking-widest uppercase",
          demoMode ? "text-pm-amber" : "text-pm-muted",
        )}
      >
        {demoMode
          ? "Demo mode · paper USDC only"
          : "Live mode · live USDC only"}
      </p>

      <div className="mb-3.5 flex w-full shrink-0 gap-1 rounded-lg border border-pm-card-border bg-pm-inset p-0.5">
        <TabButton active={tab === "signals"} onClick={() => setTab("signals")}>
          Signals
        </TabButton>
        <TabButton active={tab === "copy"} onClick={() => setTab("copy")}>
          Copy trade
        </TabButton>
      </div>

      {tab === "signals" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col justify-center rounded-[10px] p-4 text-center",
              signals.isUp ? "pred-box-up !mb-0" : "pred-box-down !mb-0",
            )}
          >
            <div
              className={cn(
                "mb-1 text-[30px] font-medium flex items-center gap-3 justify-center",
                signals.isUp ? "text-pm-green" : "text-pm-red",
              )}
            >
              {signals.isUp ? (
                <>
                  <TrendUpIcon className="size-8" />
                  UP
                </>
              ) : (
                <>
                  <TrendDownIcon className="size-8" />
                  DOWN
                </>
              )}
            </div>
            <div className="text-xs text-pm-muted">
              Signal score: {signals.composite}%
            </div>
            <div className="my-2.5 h-1.5 w-full overflow-hidden rounded-sm bg-pm-surface">
              <div
                className={cn(
                  "h-full rounded-sm transition-[width] duration-1000",
                  signals.isUp ? "bg-pm-green" : "bg-pm-red",
                )}
                style={{ width: `${signals.composite}%` }}
              />
            </div>
            <div className="text-[10px] tracking-wide text-pm-muted-dim">
              SIGNALS ALIGNED: {signals.alignedSignals}/{signals.totalSignals}
            </div>
          </div>

          <BetControls className="mt-auto shrink-0">
            <SliderRow
              label="Bet size (USDC)"
              value={betSize}
              min={1}
              max={100}
              display={formatUsd(betSize)}
              onChange={onBetSizeChange}
            />
            <SliderRow
              label="Min confidence"
              value={minConf}
              min={50}
              max={90}
              display={`${minConf}%`}
              onChange={onMinConfChange}
            />
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSignalsHelpOpen(true)}
              >
                How it works
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!canBet || placingBet}
                onClick={onPlaceBet}
              >
                {placingBet
                  ? "Placing…"
                  : demoMode
                    ? "Place demo bet"
                    : "Place bet"}
              </button>
            </div>
          </BetControls>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2.5 shrink-0">
            <label
              htmlFor="copy-target-address"
              className="mb-1 block text-[10px] tracking-widest text-pm-muted-dim uppercase"
            >
              Copy target wallet
            </label>
            <div className="flex gap-2">
              <input
                id="copy-target-address"
                type="text"
                className="input-field flex-1"
                placeholder="0x…"
                value={targetInput}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => {
                  setTargetInput(e.target.value.trim());
                  setTargetError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyTarget();
                  }
                }}
              />
              <button
                type="button"
                className="btn-ghost !flex-none shrink-0 px-3"
                disabled={
                  targetSaving ||
                  targetInput.trim().toLowerCase() ===
                    settings.targetAddress.toLowerCase()
                }
                onClick={() => void applyTarget()}
              >
                {targetSaving ? "…" : "Apply"}
              </button>
            </div>
            {targetError && (
              <p className="mt-1 text-[10px] text-pm-red">{targetError}</p>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {prediction ? (
              <div
                className={cn(
                  "flex flex-1 flex-col justify-center rounded-[10px] border p-4 text-center",
                  copyIsUp
                    ? "border-pm-green-border bg-pm-green-dim"
                    : "border-pm-red-border bg-pm-red-dim",
                )}
              >
                <div className="mb-1.5 text-[11px] text-pm-muted">
                  {prediction.pseudonym} · {targetAction}
                </div>
                <div
                  className={cn(
                    "mb-1 text-[26px] font-medium flex items-center gap-3 justify-center",
                    copyIsUp ? "text-pm-green" : "text-pm-red",
                  )}
                >
                  {copyDir === "UP" ? (
                    <>
                      <TrendUpIcon className="size-8" />
                      UP
                    </>
                  ) : (
                    <>
                      <TrendDownIcon className="size-8" />
                      DOWN
                    </>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-pm-muted-dim">
                  Target {formatUsd(prediction.amountUsd)}
                  {prediction.scaledAmountUsd < prediction.amountUsd && (
                    <> · copy {formatUsd(prediction.scaledAmountUsd)}</>
                  )}
                  {" → "}
                  buy {copyDir} @ {(prediction.price * 100).toFixed(0)}¢
                  {prediction.alreadyCopied && " · latest already copied"}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center px-4 py-3 text-center text-xs text-pm-muted-dim">
                No BTC 5m trade from this wallet in the current window yet.
              </div>
            )}
          </div>

          {windowTradeCount > 0 && (
            <p className="my-2 shrink-0 text-center text-[10px] text-pm-muted-dim">
              {windowTradeCount} target trade{windowTradeCount === 1 ? "" : "s"}{" "}
              · {copiedCount} copied · {pendingCount} pending
              {pendingTotalUsd > 0 && (
                <>
                  {" "}
                  · target {formatUsd(pendingTotalUsd)}
                  {plannedCopyUsd > 0 && plannedCopyUsd < pendingTotalUsd && (
                    <> → yours {formatUsd(plannedCopyUsd)}</>
                  )}
                </>
              )}
              {sizeScalePct !== null && sizeScalePct < 100 && (
                <> · sizing {sizeScalePct.toFixed(0)}%</>
              )}
            </p>
          )}

          {lastAutoCopyError && (
            <p className="mb-2.5 shrink-0 text-[11px] text-pm-red">
              {lastAutoCopyError}
            </p>
          )}

          <BetControls className="mt-auto shrink-0">
            <SliderRow
              label="Max per copy (USDC)"
              value={settings.betSize}
              min={1}
              max={500}
              display={formatUsd(settings.betSize)}
              onChange={onCopyBetSizeChange}
            />
            <SliderRow
              label="Copy budget (% balance)"
              value={settings.budgetPct}
              min={10}
              max={100}
              display={`${settings.budgetPct}%`}
              onChange={onCopyBudgetPctChange}
            />
            <div className="flex items-center justify-between gap-5 mb-1">
              <span className="shrink-0 text-[11px] tracking-wide whitespace-nowrap text-pm-muted !w-auto">
                Auto-copy
              </span>
              <Switch checked={settings.enabled} onChange={onToggleAutoCopy} />
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCopyHelpOpen(true)}
              >
                How it works
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!canCopy || copying}
                onClick={onCopyNow}
              >
                {copying
                  ? "Copying…"
                  : pendingCount > 0
                    ? `Copy ${pendingCount} trade${pendingCount === 1 ? "" : "s"}`
                    : "Copy now"}
              </button>
            </div>
          </BetControls>
        </div>
      )}

      <Dialog
        open={signalsHelpOpen}
        title="Signals — how it works"
        onClose={() => setSignalsHelpOpen(false)}
      >
        <SignalsHowItWorksContent />
      </Dialog>
      <Dialog
        open={copyHelpOpen}
        title="Copy trade — how it works"
        onClose={() => setCopyHelpOpen(false)}
      >
        <CopyTradeHowItWorksContent />
      </Dialog>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-0 flex-1 cursor-pointer rounded-md border-none py-2 text-[11px] font-medium tracking-widest uppercase transition-colors",
        active ? "bg-white/8 text-pm-text" : "bg-transparent text-pm-muted-dim",
      )}
    >
      {children}
    </button>
  );
}

function BetControls({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-t border-pm-border-subtle pt-3.5", className)}>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-5">
      <span className="w-[150px] shrink-0 text-[11px] tracking-wide whitespace-nowrap text-pm-muted">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="min-w-0 text-[13px] font-medium text-pm-text-secondary">{display}</span>
    </div>
  );
}
