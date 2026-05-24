import { SignatureTypeV2, type ApiKeyCreds } from "@polymarket/clob-client-v2";
import {
  createL1Client,
  createTradingClient,
  fetchCollateralBalance,
  getSignerAddress,
} from "../lib/clobClient.js";
import { deriveApiCredentials } from "../lib/l1Auth.js";
import { loadBackendEnv } from "../lib/dotenv.js";
import { hasApiCreds, loadServerEnv } from "../lib/env.js";
import { fetchCurrentBtc5mMarket } from "../lib/market.js";

loadBackendEnv();

const SIGNATURE_LABELS: Record<SignatureTypeV2, string> = {
  [SignatureTypeV2.EOA]: "EOA (0)",
  [SignatureTypeV2.POLY_PROXY]: "POLY_PROXY (1)",
  [SignatureTypeV2.POLY_GNOSIS_SAFE]: "GNOSIS_SAFE (2)",
  [SignatureTypeV2.POLY_1271]: "DEPOSIT_WALLET / POLY_1271 (3)",
};

function formatUsdc(raw: string): string {
  const value = Number(raw) / 1e6;
  return `$${value.toFixed(2)}`;
}

function printSection(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

function printNetworkHint(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("internetpositif") ||
    lower.includes("certificate") ||
    lower.includes("altnames") ||
    lower.includes("fetch failed")
  ) {
    console.log("\n  ⚠ Network may be blocking Polymarket (TLS/DNS intercept or firewall).");
    console.log("    If you are in Indonesia, Internet Positif often blocks these domains.");
    console.log("    Connect to a VPN, then re-run: pnpm setup:polymarket");
  }
}

async function checkReadOnlyMarket() {
  printSection("Read-only market check (no API key needed)");
  try {
    const market = await fetchCurrentBtc5mMarket();
    if (!market) {
      console.log("  No active BTC 5m market found for the current window.");
      console.log("  This can happen briefly between windows — try again in a minute.");
      return;
    }
    console.log(`  Slug:     ${market.slug}`);
    console.log(`  Question: ${market.question ?? "—"}`);
    console.log(`  UP token: ${market.upTokenId ?? "—"}`);
    console.log(`  DOWN token: ${market.downTokenId ?? "—"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  Failed: ${message}`);
    printNetworkHint(message);
  }
}

async function main() {
  console.log("Polymarket setup — derive credentials & verify wallet\n");

  await checkReadOnlyMarket();

  const env = loadServerEnv(true);
  const signerAddress = getSignerAddress(env);
  const funderAddress = env.funderAddress ?? signerAddress;

  printSection("Wallet config");
  console.log(`  Signer:          ${signerAddress}`);
  console.log(`  Funder:          ${funderAddress}`);
  console.log(`  Signature type:  ${SIGNATURE_LABELS[env.signatureType]}`);

  if (env.signatureType === SignatureTypeV2.POLY_PROXY && env.funderAddress) {
    console.log("\n  Web login: signer EOA signs, funder (Polymarket proxy) holds funds.");
  }

  if (env.signatureType === SignatureTypeV2.POLY_1271 && !env.funderAddress) {
    console.log("\n  ⚠ SIGNATURE_TYPE=3 but FUNDER_ADDRESS is not set.");
    console.log("    Set FUNDER_ADDRESS to your Polymarket deposit wallet address.");
  }

  printSection("CLOB connectivity (L1)");
  const l1Client = createL1Client(env);
  try {
    await l1Client.getOk();
    console.log("  CLOB API: OK");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  CLOB API unreachable: ${message}`);
    printNetworkHint(message);
    process.exit(1);
  }

  printSection("Deriving API credentials");
  let creds: ApiKeyCreds;
  try {
    creds = await deriveApiCredentials(l1Client);
    console.log("  API credentials derived successfully.\n");
    console.log("  Add these to your .env file:\n");
    console.log(`  POLYMARKET_API_KEY=${creds.key}`);
    console.log(`  POLYMARKET_API_SECRET=${creds.secret}`);
    console.log(`  POLYMARKET_API_PASSPHRASE=${creds.passphrase}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  Failed to derive credentials:\n${message}`);
    printNetworkHint(message);
    process.exit(1);
  }

  printSection("Balance & allowance (L2)");
  const tradingClient = createTradingClient(env, creds);
  try {
    const { balance, allowances } = await fetchCollateralBalance(tradingClient);
    console.log(`  Collateral balance: ${formatUsdc(balance)}`);

    const allowanceEntries = Object.entries(allowances);
    if (allowanceEntries.length === 0) {
      console.log("  Allowances: none set");
    } else {
      for (const [contract, amount] of allowanceEntries) {
        console.log(`  Allowance ${contract.slice(0, 10)}…: ${formatUsdc(amount)}`);
      }
    }

    const balanceNum = Number(balance) / 1e6;
    if (balanceNum <= 0) {
      console.log("\n  ⚠ No pUSD balance. Fund your funder wallet before live trading.");
      console.log("    See: https://docs.polymarket.com/trading/bridge/deposit");
    }

    const maxAllowance = Math.max(...allowanceEntries.map(([, a]) => Number(a)), 0);
    if (balanceNum > 0 && maxAllowance <= 0) {
      console.log("\n  ⚠ Balance exists but allowance may be missing.");
      console.log("    Approve the exchange contract before placing orders.");
      console.log("    See: https://docs.polymarket.com/trading/deposit-wallets");
    }
  } catch (err) {
    console.log(`  Could not fetch balance: ${err instanceof Error ? err.message : String(err)}`);
    if (env.signatureType === SignatureTypeV2.POLY_1271 && !env.funderAddress) {
      console.log("  Hint: set FUNDER_ADDRESS to your deposit wallet and re-run.");
    }
  }

  if (hasApiCreds(env)) {
    printSection("Existing .env credentials");
    console.log("  POLYMARKET_API_KEY is already set in .env.");
    console.log("  If balance check failed, replace with the freshly derived values above.");
  }

  printSection("How to run");
  console.log("  • Backend API:          pnpm dev:backend   (from repo root)");
  console.log("  • Frontend dashboard:   pnpm dev:frontend");
  console.log("  • Both together:        pnpm dev");
  console.log("  • Setup / verify wallet: pnpm setup:polymarket");
  console.log("");
  printSection("Next steps");
  console.log("  1. Save the API credentials above into .env");
  console.log("  2. Fund FUNDER_ADDRESS with pUSD on Polygon");
  console.log("  3. Complete token approvals (one-time)");
  console.log("  4. Wire the backend to your React app (never expose PRIVATE_KEY to the browser)");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
