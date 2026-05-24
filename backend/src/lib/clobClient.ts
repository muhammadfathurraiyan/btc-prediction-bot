import { AssetType, Chain, ClobClient, type ApiKeyCreds } from "@polymarket/clob-client-v2";
import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { CLOB_HOST } from "../config.js";
import { hasApiCreds, type ServerEnv } from "./env.js";

export function createSigner(env: ServerEnv) {
  const account = privateKeyToAccount(env.privateKey);
  return createWalletClient({
    account,
    chain: polygon,
    transport: http(env.polygonRpcUrl),
  });
}

export function getSignerAddress(env: ServerEnv): Address {
  return privateKeyToAccount(env.privateKey).address;
}

export function createL1Client(env: ServerEnv): ClobClient {
  return new ClobClient({
    host: CLOB_HOST,
    chain: Chain.POLYGON,
    signer: createSigner(env),
    useServerTime: true,
    throwOnError: true,
  });
}

export function createTradingClient(env: ServerEnv, creds: ApiKeyCreds): ClobClient {
  const funderAddress = env.funderAddress ?? getSignerAddress(env);

  return new ClobClient({
    host: CLOB_HOST,
    chain: Chain.POLYGON,
    signer: createSigner(env),
    creds,
    signatureType: env.signatureType,
    funderAddress,
  });
}

export async function createTradingClientFromEnv(env: ServerEnv): Promise<ClobClient | null> {
  if (!hasApiCreds(env)) return null;

  return createTradingClient(env, {
    key: env.apiKey!,
    secret: env.apiSecret!,
    passphrase: env.apiPassphrase!,
  });
}

export async function fetchCollateralBalance(client: ClobClient) {
  return client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
}
