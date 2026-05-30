# Proov — Mainnet Deployment

## Smart Contracts (Celo Mainnet — Chain ID 42220)

Event-log v2 contracts deployed **May 30 2026** at block **68,262,187**.

| Contract | Address | Celoscan |
|----------|---------|---------|
| ProovCore | `0xef6Bf51246A4B6972383632e66C87250Fc759922` | [view](https://celoscan.io/address/0xef6Bf51246A4B6972383632e66C87250Fc759922) |
| SessionManager | `0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb` | [view](https://celoscan.io/address/0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb) |
| CircleManager | `0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E` | [view](https://celoscan.io/address/0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E) |

Deployer: `0xc6A4b73030d8a9eb8166C2FAB2400B421026FD19`

## Gas

| Action | Gas | Cost at 200 Gwei |
|--------|-----|-----------------|
| createHabit (first call) | ~45,000 | ~0.009 CELO |
| completeHabit / startSession / endSession | ~25,000–28,000 | ~0.005–0.006 CELO |
| setUsername / editUsername | ~28,000 | ~0.006 CELO |
| sendCheer / acceptRequest | ~25,000 | ~0.005 CELO |
| **0.1 CELO covers** | — | **~17–20 transactions** |
| **0.5 CELO faucet drip covers** | — | **~80–100 transactions** |

## Faucet

Server-side drip at `/api/faucet`. Sends **0.5 CELO** to new users with < 0.1 CELO balance.

Faucet wallet: `0xc6A4b73030d8a9eb8166C2FAB2400B421026FD19` — keep funded with at least 5 CELO.

## AI Agent (ERC-8004)

| Key | Value |
|-----|-------|
| Agent Address | `0xc8BF2144e4742230c8Fd692d940032E6277883e2` |
| Metadata URI | https://raw.githubusercontent.com/MarvyNwaokobia/Proov/main/agent-metadata.json |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Registration Tx | [celoscan.io](https://celoscan.io/tx/0x2bd32aa8c39c4db826f7598761a93f425f25681684fbfe69ed872cad0cdc0211) |

## App

| Key | Value |
|-----|-------|
| Live URL | https://proov-one.vercel.app |
| Chain | Celo Mainnet (42220) |
| Contracts deployed | 2026-05-30 |

## Analytics & Indexing

| Source | Link |
|--------|------|
| Dune dashboard | https://dune.com/marvyy/proov |
| Goldsky subgraph v2.0.0 | https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/2.0.0/gn |
| Admin panel | https://proov-one.vercel.app/admin |

## Vercel Environment Variables

```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_PROOV_CORE_ADDRESS=0xef6Bf51246A4B6972383632e66C87250Fc759922
NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb
NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E
NEXT_PUBLIC_GOLDSKY_URL=https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/2.0.0/gn
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_EXPLORER_URL=https://celoscan.io
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
FAUCET_PRIVATE_KEY=0x_deployer_private_key
DUNE_API_KEY=
```
