import { Chain, ClobClient } from "@polymarket/clob-client-v2";
import { CLOB_HOST } from "../config.js";

let client: ClobClient | null = null;

export function getPublicClient(): ClobClient {
  if (!client) {
    client = new ClobClient({
      host: CLOB_HOST,
      chain: Chain.POLYGON,
    });
  }
  return client;
}
