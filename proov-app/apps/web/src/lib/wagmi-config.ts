"use client";

import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { createConfig, http, mock } from "wagmi";
import { celo, celoSepolia } from "viem/chains";

export const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "";
export const hasWeb3AuthClientId = !!clientId;

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xA4EC",
  rpcTarget: "https://forno.celo.org",
  displayName: "Celo",
  ticker: "CELO",
  tickerName: "Celo",
};

// Lazy — only constructed in browser on first call
let _web3auth: Web3Auth | null = null;

export function getWeb3Auth(): Web3Auth {
  if (_web3auth) return _web3auth;
  if (typeof window === "undefined") throw new Error("getWeb3Auth: browser only");

  // EthereumPrivateKeyProvider drives the Web3Auth auth flow (social login,
  // session caching, key derivation). The AA connector wraps it afterward to
  // derive the Safe Smart Account address.
  const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig } });

  _web3auth = new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    privateKeyProvider,
    // No uiConfig — whitelabel requires paid plan
  });

  return _web3auth;
}

function buildConnectors() {
  if (!clientId || typeof window === "undefined") {
    return [mock({ accounts: ["0x0000000000000000000000000000000000000001"] as const })];
  }
  try {
    // Lazy import to avoid SSR issues
    const { createAAConnector } = require("./aa-provider");
    return [createAAConnector({ web3AuthInstance: getWeb3Auth() })];
  } catch {
    // AA connector failed to initialise — fall back to mock so the app still loads
    return [mock({ accounts: ["0x0000000000000000000000000000000000000001"] as const })];
  }
}

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: buildConnectors(),
  transports: {
    [celo.id]: http("https://forno.celo.org"),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
  // ssr: false — server uses mock connectors, client uses AA connector.
  // Setting ssr: true causes wagmi to attempt state reconciliation between
  // those two different connector sets, which throws on hydration.
  ssr: false,
});
