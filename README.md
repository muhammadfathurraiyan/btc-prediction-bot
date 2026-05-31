# Polymarket BTC 5m Prediction Bot

A full-stack dashboard for trading [Polymarket BTC 5-minute Up/Down markets](https://polymarket.com). It combines live signal analysis, optional copy trading, demo (paper) mode, and real-time Chainlink BTC/USD pricing aligned with Polymarket settlement rules.

## Features

- **Signal-based betting** — Composite score from five live indicators (RSI, EMA cross, volume spike, order book depth, market UP %)
- **Copy trading** — Mirror another wallet's latest BTC 5m trade (BUY or SELL) on the current window, with manual or auto-copy
- **Chainlink pricing** — Live BTC, price-to-beat, and bet resolution use Polymarket's Chainlink BTC/USD feed (not Binance spot)
- **Demo mode** — Paper trading with $1,000 simulated USDC when live balance is insufficient or demo is toggled on
- **Real-time dashboard** — WebSocket updates for BTC ticks and dashboard snapshots; HTTP fallback when disconnected
- **Session analytics** — Win rate, P&L, and bet history with automatic resolution after each 5m window

## Architecture

```
polymarket-btc-5m-prediction/
├── frontend/     React 19 + Vite + Tailwind v4  →  :3000
├── backend/      Node HTTP + WebSocket           →  :3001
└── pnpm-workspace.yaml
```

| Layer | Stack |
|-------|-------|
| Frontend | React, TypeScript, Tailwind CSS v4, Vite dev proxy |
| Backend | Node.js, `@polymarket/clob-client-v2`, viem, ws |
| Data | Polymarket Gamma/CLOB/Data APIs, Binance (indicators only), Polymarket RTDS (Chainlink) |

The frontend never sees your private key. All signing and API calls run on the backend.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- A Polymarket account with a funded wallet (for live trading), or use demo mode

## Quick start

```bash
# Install dependencies
pnpm install

# Configure backend secrets
cp backend/.env.example backend/.env
# Edit backend/.env with your wallet details

# Derive API credentials and verify connectivity
pnpm setup:polymarket

# Run frontend + backend together
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The Vite dev server proxies `/api`, `/health`, and `/ws` to the backend on port 3001.

## Wallet setup

### 1. Create `backend/.env`

Copy from `backend/.env.example` and fill in:

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Signer wallet private key (never commit, never expose to frontend) |
| `FUNDER_ADDRESS` | Address holding USDC for trading (Polymarket proxy for web login) |
| `SIGNATURE_TYPE` | `0` EOA · `1` POLY_PROXY (web login) · `2` Gnosis Safe · `3` deposit wallet |
| `POLYMARKET_API_KEY` | Derived via setup script |
| `POLYMARKET_API_SECRET` | Derived via setup script |
| `POLYMARKET_PASSPHRASE` | Derived via setup script |

### 2. Run the setup script

```bash
pnpm setup:polymarket
```

This script will:

- Verify read-only market access (Gamma API)
- Print signer, funder, and signature type
- Check CLOB connectivity
- Derive API credentials (paste into `.env`)
- Show collateral balance and allowance status

### 3. Fund and approve

Live trading requires USDC on your funder wallet and token approvals on Polymarket. See [Polymarket deposit docs](https://docs.polymarket.com/trading/bridge/deposit).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start frontend and backend in parallel |
| `pnpm dev:frontend` | Frontend only (`:3000`) |
| `pnpm dev:backend` | Backend only (`:3001`) |
| `pnpm build` | Build frontend for production |
| `pnpm setup:polymarket` | Derive API keys and verify wallet |
| `pnpm --filter backend typecheck` | Typecheck backend |

## API reference

Base URL: `http://localhost:3001` (proxied as `/api` in dev)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/market` | Current BTC 5m market for this window |
| `GET` | `/api/dashboard` | Full dashboard snapshot |
| `POST` | `/api/bet` | Place signal bet `{ direction, amount, confidence }` |
| `POST` | `/api/demo` | Toggle demo mode `{ enabled }` |
| `POST` | `/api/copy/settings` | Update copy settings `{ enabled, betSize, targetAddress }` |
| `POST` | `/api/copy/execute` | Manual copy `{ betSize?, force? }` |
| `WS` | `/ws` | Real-time dashboard + BTC tick stream |

### WebSocket messages

```json
{ "type": "connected" }
{ "type": "dashboard", "data": { ... } }
{ "type": "tick", "btc": 76898.55, "ts": 1710000000000 }
{ "type": "error", "message": "..." }
```

## How it works

### Price sources

| Data | Source |
|------|--------|
| Live BTC price | Chainlink BTC/USD via [Polymarket RTDS](https://docs.polymarket.com) |
| Price to beat | Chainlink at 5m window open |
| Bet settlement | Chainlink at window end vs start |
| RSI, EMA, volume | Binance BTCUSDT candles |

UP wins if Chainlink BTC/USD at window end is **≥** the price at window start — matching Polymarket's resolution rules.

### The 5 signals

1. **RSI (14)** on Binance 1m candles — favors UP when 45–70
2. **EMA 9/21 cross** — bullish vs bearish trend
3. **5m volume spike** — pro-rated vs trailing average
4. **Order book depth** — bid-heavy vs ask-heavy on Polymarket
5. **Market UP %** — midpoint of UP token

When ≥3 signals align, the composite score reflects conviction. predictions require your **min confidence** slider threshold.

### Copy trading

Set a target wallet address (Polymarket proxy/profile address). The bot follows their latest **BUY or SELL** on the current BTC 5m slug (Data API, `takerOnly=false`). BUY Up → you buy UP; SELL Up → you buy DOWN. Auto-copy runs on each dashboard refresh (once per transaction hash).

Default copy target can be set with `COPY_TARGET_ADDRESS` in `.env`.

### Demo mode

- Auto-enables when live balance is below bet size (unless opted out)
- Can be toggled manually in the UI
- Uses $1,000 paper USDC; predictions resolve the same way as live
- Session state (history, demo balance, copy settings) is in-memory and resets on backend restart

## Project structure

```
backend/src/
├── index.ts              HTTP routes + server entry
├── config.ts             Hosts, slug prefix, RTDS URL
├── lib/
│   ├── chainlinkPrice.ts # Polymarket RTDS Chainlink feed
│   ├── signals.ts        # Indicator composition
│   ├── betting.ts        # Live vs demo bet routing
│   ├── copyTrade.ts      # Copy target + execution
│   ├── dashboard.ts      # Snapshot builder
│   ├── realtime.ts       # WebSocket broadcast
│   └── ...
└── scripts/setup.ts      # Wallet setup CLI

frontend/src/
├── App.tsx               # Layout shell
├── hooks/useDashboard.ts # API + WebSocket state
├── components/           # UI (MetricsGrid, TradingPanel, …)
├── lib/api.ts            # HTTP client
└── utils/                # formatPrice, time, trade helpers
```

## Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Polygon RPC |
| `CLOB_HOST` | `https://clob.polymarket.com` | CLOB API |
| `GAMMA_HOST` | `https://gamma-api.polymarket.com` | Market metadata |
| `DATA_API_HOST` | `https://data-api.polymarket.com` | Copy trade trades |
| `RTDS_WS` | `wss://ws-live-data.polymarket.com` | Chainlink price feed |
| `COPY_TARGET_ADDRESS` | — | Default copy target wallet |
| `VITE_API_URL` | `""` (same origin) | Frontend API base (production) |
| `VITE_WS_URL` | auto | Frontend WebSocket URL (production) |

## Security

- **Never** commit `backend/.env` or put `PRIVATE_KEY` in frontend env vars (`VITE_*`)
- The backend holds signing credentials; the browser only talks to your local API
- Use demo mode to test without risking funds

## Disclaimer

This software is for educational and research purposes. Prediction markets involve financial risk. Past performance of signals or copy targets does not guarantee future results. You are responsible for compliance with applicable laws and Polymarket's terms of service.

## License

Private project — not published to npm.
