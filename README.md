# Proov — Your discipline. Onchain.

> **Prove it. Every day.**  
> Habits. Streaks. Accountability. All onchain.

Proov is a habit-tracking and personal accountability dApp built on [Celo](https://celo.org). Users create habits, run focus timers, log activities with AI verification, write journal entries, and build daily streaks. Friends connect to form accountability circles. Every action fires an onchain transaction — the proof is permanent and publicly verifiable.

---

## Live Demo

[https://proov-one.vercel.app](https://proov-one.vercel.app)

## Analytics

| Dashboard | Link |
|-----------|------|
| Dune (onchain) | [dune.com/marvyy/proov](https://dune.com/marvyy/proov) |
| Goldsky subgraph | [API v2.0.0](https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/2.0.0/gn) |
| Admin panel (owner only) | `/admin` |

---

## Smart Contracts (Celo Mainnet)

Lightweight event-log contracts — every user action emits an onchain event at ~0.005–0.009 CELO per transaction. Data is stored in Supabase; the chain is the immutable proof layer indexed by Dune and Goldsky.

| Contract | Address | Celoscan |
|----------|---------|---------|
| ProovCore | `0xef6Bf51246A4B6972383632e66C87250Fc759922` | [view](https://celoscan.io/address/0xef6Bf51246A4B6972383632e66C87250Fc759922) |
| SessionManager | `0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb` | [view](https://celoscan.io/address/0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb) |
| CircleManager | `0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E` | [view](https://celoscan.io/address/0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E) |

Deployed at block **68,262,187** · May 30 2026

---

## Features

### Habit Tracking
- Create habits across 6 categories: Focus, Fitness, Reading, Hydration, Sleep, Custom
- Every creation, completion, and archive fires an onchain transaction
- AI verification (Claude Sonnet 4.6) for fitness habits — proof hash stored in the tx
- Deactivate habits you no longer track

### Streak System
- Consecutive daily completions build your streak — miss a day and it resets
- Milestones at 7, 21, 30, 50, 100, 200 days emit `MilestoneReached` onchain events
- Streak data kept in Supabase; milestone proof lives onchain

### Focus Timer
- Start/end sessions recorded onchain via `SessionManager`
- Timer reconstructs elapsed time from local state — survives tab switches and refreshes

### AI Verification (Fitness Habits)
- Powered by **Claude Sonnet 4.6**
- Users describe their workout before submitting a completion
- Claude judges the description — vague claims rejected, specific effort accepted
- Verification hash stored in the transaction

### Accountability Circle
- Add up to 10 friends by wallet address or username
- Accepting a circle request emits `MemberAdded` onchain (proof of the bond)
- Cheers and nudges sent onchain

### Leaderboard
- Top 50 users globally, sorted by current streak
- Gold/silver/bronze podium for top 3
- Tap any user to view their public profile

### Journal
- Log daily entries — content stored as a `keccak256` hash onchain (private, verifiable)
- Counts as daily activity and keeps your streak alive

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | [Celo](https://celo.org) (L2, post-March 2025 migration) |
| Smart contracts | Solidity 0.8.28, Hardhat |
| Frontend | Next.js 14, TypeScript |
| Wallet auth | [Web3Auth](https://web3auth.io) (social login — Google, Email OTP) |
| Onchain reads/writes | [wagmi](https://wagmi.sh) v2 + [viem](https://viem.sh) v2 |
| Database | [Supabase](https://supabase.com) (Postgres — app state) |
| Indexing | [Goldsky](https://goldsky.com) subgraph v2.0.0 |
| Analytics | [Dune](https://dune.com) |
| AI verification | [Claude Sonnet 4.6](https://anthropic.com) via Anthropic API |
| AI reports | Google Gemini 2.5 Flash via `@google/generative-ai` |
| Animations | [Framer Motion](https://www.framer.com/motion/) |

---

## Architecture

```
proov-app/
├── apps/contracts/              ← Hardhat workspace
│   ├── contracts/
│   │   ├── ProovCore.sol        ← habits + streaks + journal (event-log v2)
│   │   ├── SessionManager.sol   ← focus timer sessions (event-log v2)
│   │   └── CircleManager.sol    ← accountability circles (event-log v2)
│   ├── goldsky/                 ← Goldsky subgraph (v2.0.0)
│   └── scripts/
│       ├── deploy.ts            ← mainnet deploy
│       └── register-agent.ts   ← ERC-8004 AI agent registration
│
└── apps/web/                   ← Next.js 14 frontend
    ├── app/
    │   ├── page.tsx             ← Landing page
    │   ├── signup/ signin/      ← Web3Auth social login
    │   ├── dashboard/           ← Streak hero + today's habits
    │   ├── habits/              ← Habit manager
    │   ├── timer/               ← Focus timer with live ring
    │   ├── circle/              ← Accountability circle
    │   ├── leaderboard/         ← Global leaderboard
    │   └── api/
    │       ├── faucet/          ← Server-side CELO drip for new users
    │       └── verify-habit/    ← Claude AI verification
    ├── hooks/                  ← useProovTx, useBackgroundTx, useSession
    └── lib/                    ← wagmi-config, transactions ABIs, auth, fuel
```

---

## Smart Contract Design

All three contracts are **event-log only** — no complex storage, just events. This keeps gas at ~0.005–0.009 CELO per transaction (~17–20 txs per 0.1 CELO at current Celo mainnet gas prices).

### ProovCore.sol
- `createHabit(name, type, duration, frequency)` → emits `HabitCreated`
- `selfCompleteHabit(habitId, hash)` → emits `HabitCompleted`
- `deactivateHabit(habitId)` → emits `HabitDeactivated`
- `recordStreakIncrement(count)` → emits `StreakUpdated` + `MilestoneReached` on milestone days
- `setUsername / editUsername` → emits `UsernameSet`
- `logJournalEntry(hash)` → emits `JournalLogged`

### SessionManager.sol
- `startSession(habitId)` → emits `SessionStarted`
- `endSession(habitId, durationSeconds)` → emits `SessionCompleted`
- `abandonSession(habitId, durationSeconds)` → emits `SessionAbandoned`

### CircleManager.sol
- `acceptRequest(from)` → emits `MemberAdded` (proof of circle bond)
- `sendCheer(to)` → emits `CheerSent`
- `removeFromCircle(member)` → emits `RemovedFromCircle`

---

## Getting Started

### Prerequisites

```bash
node >= 18
pnpm >= 8
```

### 1. Clone & install

```bash
git clone https://github.com/MarvyNwaokobia/Proov.git
cd Proov/proov-app
pnpm install
```

### 2. Configure environment

```bash
cp apps/web/.env.template apps/web/.env.local
```

Fill in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_PROOV_CORE_ADDRESS=0xef6Bf51246A4B6972383632e66C87250Fc759922
NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=0x0bA82bb8de521d2D0BD63e0fa4ec2beF6ad9C1fb
NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=0xD5E46dE0fF1Cfd88ABe4bE5641650376516A7a5E
NEXT_PUBLIC_GOLDSKY_URL=https://api.goldsky.com/api/public/project_cmpdqb2n5s8s801x0h45a2npf/subgraphs/proov/2.0.0/gn
ANTHROPIC_API_KEY=your_key
GEMINI_API_KEY=your_key
FAUCET_PRIVATE_KEY=0x_your_faucet_wallet_key
```

### 3. Run dev server

```bash
cd apps/web && pnpm dev
# → http://localhost:3000
```

---

## Deploying Contracts

```bash
cd apps/contracts
npx hardhat run scripts/deploy.ts --network celo
```

The script prints the 3 new addresses. Update them in Vercel and `apps/web/.env.local`.

---

## AI Agent (ERC-8004)

| Key | Value |
|-----|-------|
| Agent Address | `0xc8BF2144e4742230c8Fd692d940032E6277883e2` |
| Metadata URI | https://raw.githubusercontent.com/MarvyNwaokobia/Proov/main/agent-metadata.json |

1. **Fitness verification** — Claude Sonnet 4.6 judges workout descriptions before accepting a habit completion.
2. **Sunday circle reports** — Gemini generates weekly plain-text summaries for each accountability circle.

---

## KarmaGAP Submission

- **Track:** AI Agents
- **Contracts:** Deployed and verified on Celo Mainnet
- **Agent:** Registered via ERC-8004
- **Onchain activity:** 20+ real transactions on mainnet

---

## License

MIT
