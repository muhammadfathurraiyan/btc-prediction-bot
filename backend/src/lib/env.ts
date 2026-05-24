import { SignatureTypeV2 } from "@polymarket/clob-client-v2";

export interface ServerEnv {
  privateKey: `0x${string}`;
  funderAddress?: `0x${string}`;
  signatureType: SignatureTypeV2;
  polygonRpcUrl: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}

const SIGNATURE_TYPE_MAP: Record<string, SignatureTypeV2> = {
  "0": SignatureTypeV2.EOA,
  "1": SignatureTypeV2.POLY_PROXY,
  "2": SignatureTypeV2.POLY_GNOSIS_SAFE,
  "3": SignatureTypeV2.POLY_1271,
};

export function parseSignatureType(value: string | undefined): SignatureTypeV2 {
  const raw = value ?? "1";
  const parsed = SIGNATURE_TYPE_MAP[raw];
  if (parsed === undefined) {
    throw new Error(`Invalid SIGNATURE_TYPE "${raw}". Use 0, 1, 2, or 3.`);
  }
  return parsed;
}

export function loadServerEnv(requirePrivateKey = true): ServerEnv {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (requirePrivateKey && (!privateKey || privateKey.startsWith("0x0000"))) {
    throw new Error(
      "PRIVATE_KEY is missing or still set to the placeholder. Copy .env.example to .env and set your key.",
    );
  }

  const funderRaw = process.env.FUNDER_ADDRESS ?? process.env.DEPOSIT_WALLET_ADDRESS;
  const funderAddress = funderRaw ? (funderRaw as `0x${string}`) : undefined;

  return {
    privateKey: privateKey!,
    funderAddress,
    signatureType: parseSignatureType(process.env.SIGNATURE_TYPE),
    polygonRpcUrl: process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com",
    apiKey: process.env.POLYMARKET_API_KEY,
    apiSecret: process.env.POLYMARKET_API_SECRET,
    apiPassphrase: process.env.POLYMARKET_PASSPHRASE,
  };
}

export function hasApiCreds(env: ServerEnv): boolean {
  return Boolean(env.apiKey && env.apiSecret && env.apiPassphrase);
}
