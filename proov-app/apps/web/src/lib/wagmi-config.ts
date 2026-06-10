"use client";

import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, WALLET_ADAPTERS, ADAPTER_EVENTS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { createConfig, http, mock } from "wagmi";
import { celo, celoSepolia } from "viem/chains";
import { isMiniPay } from "./minipay";

export const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "";
export const hasWeb3AuthClientId = !!clientId;

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://rpc.ankr.com/celo";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xA4EC",
  rpcTarget: CELO_RPC,
  displayName: "Celo",
  ticker: "CELO",
  tickerName: "Celo",
};

// All non-Google providers hidden — users go through our own UI for email/SMS.
export const MODAL_CONFIG = {
  [WALLET_ADAPTERS.AUTH]: {
    label: 'openlogin',
    loginMethods: {
      facebook:          { showOnModal: false },
      discord:           { showOnModal: false },
      reddit:            { showOnModal: false },
      twitter:           { showOnModal: false },
      twitch:            { showOnModal: false },
      github:            { showOnModal: false },
      wechat:            { showOnModal: false },
      kakao:             { showOnModal: false },
      linkedin:          { showOnModal: false },
      weibo:             { showOnModal: false },
      apple:             { showOnModal: false },
      line:              { showOnModal: false },
      email_passwordless:{ showOnModal: false },
      sms_passwordless:  { showOnModal: false },
    },
  },
};

// Lazy — only constructed in browser on first call
let _web3auth: Web3Auth | null = null;
let _initPromise: Promise<void> | null = null;

// The auth-adapter swallows errors from the post-redirect rehydration
// connect() — it emits ADAPTER_EVENTS.ERRORED instead of rejecting init(),
// so `web3AuthInstance.connected` just silently stays false. Capture that
// error here so callers (e.g. signin/signup) can show *why* it failed.
let _lastAdapterError: Error | null = null;

export function getLastAdapterError(): Error | null {
  return _lastAdapterError;
}

export function getWeb3Auth(): Web3Auth {
  if (_web3auth) return _web3auth;
  if (typeof window === "undefined") throw new Error("getWeb3Auth: browser only");

  // EthereumPrivateKeyProvider drives the Web3Auth auth flow (social login,
  // session caching, key derivation). The AA connector wraps it afterward to
  // derive the Safe Smart Account address from the EOA.
  const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig } });

  _web3auth = new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    privateKeyProvider,
    uiConfig: { uxMode: 'redirect' },
  });

  _web3auth.on(ADAPTER_EVENTS.ERRORED, (err: Error) => {
    _lastAdapterError = err;
  });

  return _web3auth;
}

// Shared init promise — concurrent callers get the same promise, preventing
// double-initModal races between the mount effect and button clicks.
export function initWeb3Auth(): Promise<void> {
  if (_initPromise) return _initPromise;
  const w = getWeb3Auth();
  _initPromise = w.initModal({ modalConfig: MODAL_CONFIG as any })
    .catch((e) => { _initPromise = null; throw e; });
  return _initPromise;
}

function buildConnectors() {
  if (typeof window === "undefined") {
    return [mock({ accounts: ["0x0000000000000000000000000000000000000001"] as const })];
  }
  // MiniPay injects window.ethereum — use it directly, skip Web3Auth entirely
  if (isMiniPay()) {
    const { injected } = require("wagmi/connectors");
    return [injected()];
  }
  if (!clientId) {
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
    [celo.id]: http(CELO_RPC),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
  // ssr: false — server uses mock connectors, client uses AA connector.
  // Setting ssr: true causes wagmi to attempt state reconciliation between
  // those two different connector sets, which throws on hydration.
  ssr: false,
});
