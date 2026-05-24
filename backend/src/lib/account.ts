import { SignatureTypeV2 } from "@polymarket/clob-client-v2";
import { getSignerAddress } from "./clobClient.js";
import { hasApiCreds, loadServerEnv } from "./env.js";

export interface AccountInfo {
  signerAddress: string;
  funderAddress: string;
  signatureType: string;
  apiConfigured: boolean;
}

const SIGNATURE_LABELS: Record<number, string> = {
  [SignatureTypeV2.EOA]: "EOA (MetaMask)",
  [SignatureTypeV2.POLY_PROXY]: "POLY_PROXY (web login)",
  [SignatureTypeV2.POLY_GNOSIS_SAFE]: "Gnosis Safe",
  [SignatureTypeV2.POLY_1271]: "Deposit wallet",
};

export function getAccountInfo(): AccountInfo | null {
  try {
    const env = loadServerEnv(false);
    if (!env.privateKey || env.privateKey.startsWith("0x0000")) return null;

    const signerAddress = getSignerAddress(env);
    const funderAddress = env.funderAddress ?? signerAddress;

    return {
      signerAddress,
      funderAddress,
      signatureType: SIGNATURE_LABELS[env.signatureType] ?? `Type ${env.signatureType}`,
      apiConfigured: hasApiCreds(env),
    };
  } catch {
    return null;
  }
}
