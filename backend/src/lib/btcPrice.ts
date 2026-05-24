export interface BtcCandle {
  open: number;
  close: number;
  volume: number;
}

type BinanceKline = [
  number, string, string, string, string, string, ...unknown[],
];

async function fetchKlines(interval: "1m" | "5m", limit: number): Promise<BtcCandle[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Binance kline error ${res.status}`);
  const klines = (await res.json()) as BinanceKline[];
  return klines.map((k) => ({
    open: Number(k[1]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export async function fetchBtcMarketData(): Promise<{
  price: number;
  changePct: string;
  closes1m: number[];
  volumes5m: number[];
}> {
  const [tickerRes, candles1m, candles5m] = await Promise.all([
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
    fetchKlines("1m", 60),
    fetchKlines("5m", 24),
  ]);

  if (!tickerRes.ok) throw new Error(`Binance price error ${tickerRes.status}`);

  const ticker = (await tickerRes.json()) as { price: string };
  const price = Number(ticker.price);
  const open5m = candles5m.at(-1)?.open ?? price;
  const changePct = open5m > 0 ? (((price - open5m) / open5m) * 100).toFixed(2) : "0.00";

  return {
    price,
    changePct,
    closes1m: candles1m.map((c) => c.close),
    volumes5m: candles5m.map((c) => c.volume),
  };
}
