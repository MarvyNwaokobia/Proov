# Proov — Mainnet Deployment

## Smart Contracts (Celo Mainnet — Chain ID 42220)

UUPS upgradeable proxy contracts deployed **May 31 2026** at block **68,295,054**.

All contracts use the OpenZeppelin UUPS proxy pattern. The addresses below are the **proxy** addresses — permanent. Implementations can be upgraded via `pnpm upgrade:celo` without changing these addresses.

| Contract | Proxy Address | Implementation | Celoscan |
|----------|--------------|----------------|---------|
| ProovCore | `0x6f379efDb10aFD85b233aE35Ad01164c7bc54eE2` | `0x54eefdba7db6d06e7da88f2cc6a0f3fc2464a34f` | [proxy](https://celoscan.io/address/0x6f379efDb10aFD85b233aE35Ad01164c7bc54eE2) · [impl](https://celoscan.io/address/0x54eefdba7db6d06e7da88f2cc6a0f3fc2464a34f#code) |
| SessionManager | `0xea7d4608e9e2798D826d0DD698A7637EC83EA8d2` | `0x99c3f40cef8e373878609de8cb3808ec503f4d6a` | [proxy](https://celoscan.io/address/0xea7d4608e9e2798D826d0DD698A7637EC83EA8d2) · [impl](https://celoscan.io/address/0x99c3f40cef8e373878609de8cb3808ec503f4d6a#code) |
| CircleManager | `0x5366DB5a7aB63ceDE7229d15179633CA69ad076D` | `0x46fD0b3971C718E08464E1cc6beeB40edf548C7D` | [proxy](https://celoscan.io/address/0x5366DB5a7aB63ceDE7229d15179633CA69ad076D) · [impl](https://celoscan.io/address/0x46fD0b3971C718E08464E1cc6beeB40edf548C7D#code) |
| FuelFaucet | `0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988` | `0x2ba699ac29241b6f32f43b85585bb546ecb94ec6` | [proxy](https://celoscan.io/address/0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988) · [impl](https://celoscan.io/address/0x2ba699ac29241b6f32f43b85585bb546ecb94ec6#code) |

Deployer: `0xc6A4b73030d8a9eb8166C2FAB2400B421026FD19`

---

## Upgrading Contracts

To push new logic to an existing proxy (no address change, no frontend updates needed):

```bash
cd apps/contracts

# Edit the Solidity, then:
pnpm upgrade:celo
```

`scripts/upgrade.ts` reads proxy addresses from `deployed-mainnet.json` and calls `upgrades.upgradeProxy()` for each contract. Only the owner wallet can authorize an upgrade.

To do a full fresh redeploy (new proxy addresses — requires updating env vars everywhere):

```bash
pnpm deploy:celo
```

---

## Gas

| Action | Gas | Cost at 200 Gwei |
|--------|-----|-----------------|
| createHabit | ~45,000 | ~0.009 CELO |
| completeHabit / startSession / endSession | ~25,000–28,000 | ~0.005–0.006 CELO |
| setUsername / editUsername | ~28,000 | ~0.006 CELO |
| sendCheer / acceptRequest | ~25,000 | ~0.005 CELO |
| **0.1 CELO covers** | — | **~17–20 transactions** |

---

## Faucet

Server-side drip at `/api/faucet`. Sends CELO to new users with low balance.

Faucet wallet: `0xc6A4b73030d8a9eb8166C2FAB2400B421026FD19` — keep funded with at least 5 CELO.

The on-chain `FuelFaucet` contract (`0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988`) also supports direct user claims (0.2 CELO / 24h). Fund it separately:

```bash
cast send 0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988 --value 10ether \
  --private-key $PRIVATE_KEY --rpc-url https://forno.celo.org
```

---

## AI Agent (ERC-8004)

| Key | Value |
|-----|-------|
| Agent Address | `0xc8BF2144e4742230c8Fd692d940032E6277883e2` |
| Metadata URI | https://raw.githubusercontent.com/MarvyNwaokobia/Proov/main/agent-metadata.json |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Registration Tx | [celoscan.io](https://celoscan.io/tx/0x2bd32aa8c39c4db826f7598761a93f425f25681684fbfe69ed872cad0cdc0211) |

---

## App

| Key | Value |
|-----|-------|
| Live URL | https://proov-one.vercel.app |
| Chain | Celo Mainnet (42220) |
| Contracts deployed | 2026-05-31 |

---

## Analytics & Indexing

| Source | Link |
|--------|------|
| Dune dashboard | https://dune.com/marvyy/proov |
| Goldsky subgraph v4.0.0 | https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/4.0.0/gn |
| Admin panel | https://proov-one.vercel.app/admin |

---

## Vercel Environment Variables

```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_PROOV_CORE_ADDRESS=0x6f379efDb10aFD85b233aE35Ad01164c7bc54eE2
NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=0xea7d4608e9e2798D826d0DD698A7637EC83EA8d2
NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=0x5366DB5a7aB63ceDE7229d15179633CA69ad076D
NEXT_PUBLIC_FUEL_FAUCET_ADDRESS=0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988
NEXT_PUBLIC_GOLDSKY_URL=https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/4.0.0/gn
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_EXPLORER_URL=https://celoscan.io
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
FAUCET_PRIVATE_KEY=0x_deployer_private_key
DUNE_API_KEY=
```
