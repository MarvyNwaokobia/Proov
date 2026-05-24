# Proov — Your discipline. Onchain.

> **Prove it. Every day.**  
> Habits. Streaks. Accountability. All onchain.

Proov is a habit-tracking and personal accountability dApp built on [Celo](https://celo.org). Users create habits, run focus timers, log fitness activities with AI verification, write journal entries, and build daily streaks. Friends connect to form accountability circles. When a streak breaks, the circle is automatically notified onchain. A global leaderboard ranks every user by streak.

---

## Live Demo

[https://proov-one.vercel.app](https://proov-one.vercel.app)

---

## Smart Contracts (Celo Mainnet)

All three contracts are deployed behind **UUPS upgradeable proxies**. The proxy addresses below never change — only the implementation behind them is replaced on upgrades.

| Contract | Proxy Address |
|----------|--------------|
| ProovCore | `0xdac1162E05B6BfA9e192C95fc38512bE4169eBBF` |
| SessionManager | `0x8f67A90563b102313dde309A6Cd9056a31311e76` |
| CircleManager | `0xFDd2796CFA3e94494C53F58479EF56f48EBE640f` |

> Verified on [Celoscan](https://celoscan.io)

---

## Features

### Habit Tracking
- Create habits across 6 categories: Focus, Fitness, Reading, Hydration, Sleep, Custom
- Set a target duration (optional) and daily/weekly frequency
- Every completion recorded permanently onchain — no edits, no deletes
- Deactivate habits you no longer track

### Streak System
- Consecutive daily completions build your streak — miss a day and it resets
- Longest-streak tracked separately so your best run is never lost
- Milestones at 7, 21, 30, 50, 100, 200 days emit onchain events
- Streak state derived from `block.timestamp / 86400` — fully verifiable

### Focus Timer
- 25-minute minimum session enforced at the contract level
- Start/end session stored onchain via `SessionManager`
- Timer reconstructs elapsed time from `startTimestamp` on every page load — survives tab switches, refreshes, and app restarts
- Sessions under 25 min are recorded but earn no streak credit

### AI Verification (Fitness Habits)
- Powered by **Claude Sonnet 4.6**
- Users describe their workout in plain text before submitting a completion
- Claude judges the description: accepts specific effort, rejects vague claims ("did it", "yes", "completed")
- The verification hash is stored in the transaction — the proof lives onchain
- Sunday circle reports generated automatically every week by the same agent

### Accountability Circle
- Add up to 10 friends by wallet address
- Send/accept/reject connection requests — all onchain
- Circle members see each other's streaks in real-time
- When your streak breaks, `CircleManager.notifyStreakBroken()` emits an event visible to your whole circle
- Witness a friend's habit completion onchain

### Leaderboard
- Top 50 users globally, sorted by current streak
- Gold/silver/bronze podium for top 3
- Tap any user to view their public profile: streak, habits, completions, journal count

### Journal
- Log daily entries — content stored as a `keccak256` hash onchain (private, verifiable)
- A journal entry counts as daily activity and keeps your streak alive

### Profile
- Upload a profile picture during onboarding or from settings
- Avatar shown in the dashboard header and on public profile pages
- Username and visibility settings stored onchain via `ProovCore`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | [Celo](https://celo.org) (L2, post-March 2025 migration) |
| Smart contracts | Solidity 0.8.28, Hardhat, OpenZeppelin UUPS Upgradeable |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet auth | [Web3Auth](https://web3auth.io) (social login — Google, Email OTP) |
| Smart account | [Safe Smart Account](https://safe.global) v1.4.1 via `@web3auth/account-abstraction-provider` |
| Gasless txs | [Pimlico](https://pimlico.io) bundler + paymaster (ERC-4337, sponsored policy) |
| Onchain reads/writes | [wagmi](https://wagmi.sh) v2 + [viem](https://viem.sh) v2 |
| AI verification | [Claude Sonnet 4.6](https://anthropic.com) via Anthropic API |
| AI reports | Google Gemini 2.5 Flash Lite via `@google/generative-ai` |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |

---

## Architecture

```
packages/
├── apps/contracts/              ← Hardhat workspace
│   ├── contracts/
│   │   ├── ProovCore.sol        ← habits + streaks + journal (merged)
│   │   ├── SessionManager.sol   ← focus timer sessions
│   │   └── CircleManager.sol    ← accountability circles
│   ├── scripts/
│   │   ├── deploy-upgradeable.ts ← UUPS proxy deploy (ProovCore, SessionManager, CircleManager)
│   │   ├── deploy.ts             ← legacy direct deploy (kept for reference)
│   │   └── register-agent.ts    ← ERC-8004 AI agent registration
│   └── test/                    ← 58 tests, all passing
│
└── apps/web/                   ← Next.js 14 frontend
    ├── app/
    │   ├── page.tsx             ← Onboarding / Login
    │   ├── dashboard/           ← Dashboard + streak hero
    │   ├── habits/              ← Habit manager
    │   ├── timer/               ← Focus timer with live ring
    │   ├── circle/              ← Accountability circle
    │   ├── leaderboard/         ← Global leaderboard
    │   ├── profile/[address]/   ← Public profile
    │   └── api/agent/           ← Claude AI routes (verify + report)
    ├── hooks/                  ← useHabits, useSession, useStreak, useCircle
    ├── lib/                    ← wagmi-config, aa-provider, ABIs, constants
    └── components/shared/      ← TxToast (used on every write)
```

---

## Smart Contract Details

### ProovCore.sol
The heart of Proov. Handles habits, streaks, journals, and the global user registry.

- `createHabit(name, type, duration, frequency)` — registers user on first call
- `selfCompleteHabit(habitId, verificationHash)` — direct user call for fitness/manual habits
- `completeHabit(user, habitId, hash)` — called by authorized `SessionManager` after a timer session
- `logJournalEntry(contentHash)` — logs journal; counts as daily activity for streak
- `getLeaderboard(limit)` — returns top-N users sorted by current streak
- Streak logic: consecutive days grow streak; any gap resets to 1 and emits `StreakBroken`
- `receive()` reverts — no ETH/CELO accepted

### SessionManager.sol
- `startSession(habitId)` — records `block.timestamp` onchain
- `endSession()` — computes duration; calls `ProovCore.completeHabit` if ≥ 25 min
- `abandonSession()` — records partial session, no credit
- `getActiveSession(user)` — frontend reads `startTimestamp` to reconstruct elapsed time

### CircleManager.sol
- Bidirectional connection model: both users must agree (request → accept)
- Max 10 members per circle
- `witnessHabit(user, habitId)` — circle member cosigns a habit completion onchain
- `notifyStreakBroken(user)` — emits `StreakBrokenNotified` with full circle member list

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
cp .env.example apps/web/.env.local
```

Fill in `apps/web/.env.local`:

```bash
# Web3Auth — dashboard.web3auth.io
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id

# Celo RPC — Alchemy (alchemy.com, Celo Mainnet app)
NEXT_PUBLIC_CELO_RPC_URL=https://celo-mainnet.g.alchemy.com/v2/your_key

# Pimlico — dashboard.pimlico.io (bundler + paymaster)
NEXT_PUBLIC_BUNDLER_URL=https://api.pimlico.io/v2/42220/rpc?apikey=your_key
NEXT_PUBLIC_PAYMASTER_URL=https://api.pimlico.io/v2/42220/rpc?apikey=your_key
NEXT_PUBLIC_PAYMASTER_POLICY_ID=your_sponsorship_policy_id

# Anthropic — console.anthropic.com
ANTHROPIC_API_KEY=your_anthropic_key

# Google Gemini — aistudio.google.com (free tier: 1,000 req/day)
GEMINI_API_KEY=your_gemini_api_key

# Contract addresses (fill after deploy)
NEXT_PUBLIC_PROOV_CORE_ADDRESS=0x...
NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=0x...

# 11142220 = Celo Sepolia (dev) | 42220 = Celo Mainnet (prod)
NEXT_PUBLIC_CHAIN_ID=11142220
```

Fill in `apps/contracts/.env`:

```bash
PRIVATE_KEY=your_deployer_key_no_0x
CELOSCAN_API_KEY=from_celoscan.io
```

### 3. Run the dev server

```bash
cd apps/web
pnpm dev
# → http://localhost:3000
```

---

## Deploying Contracts

Contracts use the **UUPS upgradeable proxy pattern**. The proxy address is permanent; only the implementation changes on upgrades.

```bash
cd apps/contracts

# First deploy (creates proxies)
npx hardhat run scripts/deploy-upgradeable.ts --network celo

# Future upgrades (proxy address stays the same)
npx hardhat run scripts/upgrade.ts --network celo

# Verify proxy on Celoscan
npx hardhat verify --network celo <PROXY_ADDRESS>
```

After the first deploy, update Vercel with the three proxy addresses printed by the script.

### Register the AI Agent (ERC-8004)

```bash
AGENT_PRIVATE_KEY=... AGENT_METADATA_URI=https://... \
  node -r ts-node/register scripts/register-agent.ts
```

---

## Running Tests

```bash
cd apps/contracts
./node_modules/.bin/hardhat test
```

**58 tests across 3 contract suites — all passing:**

```
CircleManager   ·  18 tests  (+ cheer, MemberAdded, UUPS upgrade)
ProovCore       ·  22 tests  (+ UUPS upgrade x2)
SessionManager  ·  18 tests  (+ SessionEnded, UUPS upgrade)
─────────────────────────────
58 passing
```

---

## Celo-Specific Implementation Notes

| Rule | Implementation |
|------|---------------|
| Gasless transactions | All user transactions sponsored via Pimlico paymaster (ERC-4337 UserOperations) — users pay zero gas |
| Smart account | Every user gets a Safe Smart Account (v1.4.1, EntryPoint v0.7) derived from their Web3Auth EOA |
| EVM version | `evmVersion: "cancun"` in `hardhat.config.ts` — required since Celo's L2 migration (March 2025) |
| Solidity version | `0.8.28` — per celopedia-skills spec |
| No ETH accepted | `receive() external payable { revert(); }` on all 3 contracts |
| Reentrancy | `nonReentrant` modifier on every state-changing function |

---

## AI Agent

The Proov agent is registered onchain via [ERC-8004](https://github.com/celo-org/CIPs/blob/main/CIPs/cip-0064.md) and performs two tasks:

1. **Fitness verification** (`POST /api/agent/verify`) — Powered by **Claude Sonnet 4.6** (Anthropic API). Claude judges user workout descriptions before they can submit a completion. Vague claims ("did it", "yes", "done") are rejected; specific, effort-filled descriptions are accepted. The verification hash is stored in the transaction.

2. **Sunday circle report** (`POST /api/agent/report`, Vercel cron `0 8 * * 0`) — Powered by **Google Gemini 2.5 Flash Lite** (free tier — 1,000 requests/day). Weekly plain-text summary for each accountability circle: who showed up, who needs encouragement, one practical tip for next week.

---

## Screens

| # | Route | Description |
|---|-------|-------------|
| 1 | `/` | Onboarding — social login via Web3Auth (Google, Email OTP) |
| 2 | `/dashboard` | Home — streak hero, today's habits, active session banner, quick nav |
| 3 | `/habits` | Habit manager — create, browse, deactivate; starter habits for new users |
| 4 | `/timer` | Focus timer — SVG ring, contract-reconstructed elapsed time, 25min enforcement |
| 5 | `/circle` | Accountability circle — requests, member streaks, habit witnessing |
| 6 | `/leaderboard` | Global leaderboard — podium + ranked list; tap for public profile |

---

## KarmaGAP Submission

- **Track:** AI Agents
- **Contracts:** Deployed and verified on Celo Mainnet (Celoscan)
- **Agent:** Registered via ERC-8004
- **Onchain activity:** 20+ real transactions on mainnet
- **Farcaster:** linked for reward payout

---

## License

MIT
