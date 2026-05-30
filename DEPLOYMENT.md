# Proov — Mainnet Deployment

## Smart Contracts (Celo Mainnet — Chain ID 42220)

| Contract | Address | Verified |
|----------|---------|---------|
| ProovCore | 0xA08Bc6EDd1A09500Dea6bc810A8fCE24a458B617 | [celoscan.io](https://celoscan.io/address/0xA08Bc6EDd1A09500Dea6bc810A8fCE24a458B617#code) |
| SessionManager | 0x5f121712C0dBE853b9B079BE25100e0604AA7AcF | [celoscan.io](https://celoscan.io/address/0x5f121712C0dBE853b9B079BE25100e0604AA7AcF#code) |
| CircleManager | 0xe61b662C0e2C0855A9d14E8fF2BF1f5065F072A7 | [celoscan.io](https://celoscan.io/address/0xe61b662C0e2C0855A9d14E8fF2BF1f5065F072A7#code) |

## AI Agent (ERC-8004)

| Key | Value |
|-----|-------|
| Agent Address | 0xc8BF2144e4742230c8Fd692d940032E6277883e2 |
| Metadata URI | https://raw.githubusercontent.com/MarvyNwaokobia/Proov/main/agent-metadata.json |
| ERC-8004 Registry | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 |
| Registration Tx | [celoscan.io](https://celoscan.io/tx/0x2bd32aa8c39c4db826f7598761a93f425f25681684fbfe69ed872cad0cdc0211) |

## App

| Key | Value |
|-----|-------|
| Live URL | https://proov-one.vercel.app |
| Deployed | 2026-05-16 |
| Chain | Celo Mainnet (42220) |

## Analytics

| Source | Link |
|--------|------|
| Dune dashboard (onchain) | https://dune.com/marvyy/proov |
| Admin panel | https://proov-one.vercel.app/admin |

## Admin Panel Env Vars (Vercel)

```
NEXT_PUBLIC_ADMIN_ADDRESS=0xYourWalletAddress
CELOSCAN_API_KEY=from_celoscan.io/myapikey          # optional but prevents rate-limiting
DUNE_API_KEY=from_dune.com/settings/api             # optional — only needed for Dune sections
DUNE_QUERY_TOTAL_TXS=query_id
DUNE_QUERY_UNIQUE_USERS=query_id
DUNE_QUERY_DAILY_TXS=query_id
DUNE_QUERY_CONTRACT_ACTIVITY=query_id
DUNE_QUERY_RECENT_TXS=query_id
```

The Supabase and Celoscan sections work without Dune keys. Only add Dune vars if you want the Dune chart sections to appear.
