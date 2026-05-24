import { cn } from "../lib/cn";
import { formatUsd } from "../utils/formatPrice";
import type { AccountInfo as AccountInfoType } from "../types/api";

interface AccountInfoProps {
  account: AccountInfoType | null;
  balanceUsd: number | null;
  balanceError: string | null;
  tradingEnabled: boolean;
  demoMode: boolean;
  demoBalance: number;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-pm-border-subtle py-1.5 text-[11px]">
      <span className="shrink-0 tracking-wide text-pm-muted">{label}</span>
      <span
        className={cn("text-right break-all text-pm-text-secondary", mono && "font-mono")}
        title={mono ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function AccountInfo({
  account,
  balanceUsd,
  balanceError,
  tradingEnabled,
  demoMode,
  demoBalance,
}: AccountInfoProps) {
  const apiStatus = !account
    ? "Not configured"
    : account.apiConfigured
      ? "Connected"
      : "Missing API keys";

  const liveBalance =
    balanceUsd !== null ? formatUsd(balanceUsd) : balanceError ? "Unavailable" : "—";

  return (
    <div className="card">
      <div className="card-title">Account</div>

      {!account ? (
        <p className="m-0 text-xs text-pm-muted">
          Set <code className="text-pm-text-tertiary">PRIVATE_KEY</code> and API credentials in{" "}
          <code className="text-pm-text-tertiary">backend/.env</code>, then restart the server.
        </p>
      ) : (
        <>
          <Row label="Signer" value={shortAddress(account.signerAddress)} mono />
          <Row label="Funder" value={shortAddress(account.funderAddress)} mono />
          <Row label="Wallet type" value={account.signatureType} />
          <div className="flex justify-between gap-3 border-b border-pm-border-subtle py-1.5 text-[11px]">
            <span className="tracking-wide text-pm-muted">API</span>
            <span
              className={cn(
                "font-medium",
                account.apiConfigured ? "text-pm-green" : "text-pm-amber",
              )}
            >
              {apiStatus}
            </span>
          </div>
          <Row label="Live balance" value={liveBalance} />
          {demoMode && <Row label="Demo balance" value={formatUsd(demoBalance)} />}
          <Row
            label="Trading"
            value={
              demoMode
                ? "Demo (paper)"
                : tradingEnabled && account.apiConfigured
                  ? "Live"
                  : "Disabled"
            }
          />
          <p className="mt-3 mb-0 text-[10px] leading-relaxed text-pm-muted-dim">
            Signer signs orders; funder holds USDC on Polymarket. Full addresses:{" "}
            <span className="text-pm-text-tertiary">{account.funderAddress}</span>
          </p>
        </>
      )}
    </div>
  );
}
