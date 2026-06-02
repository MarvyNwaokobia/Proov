# Proov — Full Review v2
### Brutal Honesty · Gas Audit · MiniPay · Grants

> Updated: 2026-06-02  
> Reflects the current state of the codebase including v3 contract upgrades, new pages, and live grant data from celopg.eco

---

## Table of Contents

1. [What Proov Is](#1-what-proov-is)
2. [What Has Been Fixed Since v1 Review](#2-what-has-been-fixed-since-v1-review)
3. [Brutal Honest Assessment](#3-brutal-honest-assessment)
4. [Does It Work in MiniPay?](#4-does-it-work-in-minipay)
5. [Would It Scale?](#5-would-it-scale)
6. [Gas & Cost — What Was Done, What's Left](#6-gas--cost--what-was-done-whats-left)
7. [Drop, Keep, Change, Add](#7-drop-keep-change-add)
8. [Would It Fit for Grants?](#8-would-it-fit-for-grants)
9. [Which Grants to Apply to Right Now](#9-which-grants-to-apply-to-right-now)
10. [Deployment Sequence for v3](#10-deployment-sequence-for-v3)
11. [Priority Order — What to Do Next](#11-priority-order--what-to-do-next)

---

## 1. What Proov Is

Proov is a habit-tracking and personal accountability dApp on Celo. Users create habits, run focus timers, log journal entries, and build daily streaks — every action fires an onchain event as immutable proof.

**Live on Celo Mainnet** (deployed block 68,295,054 · May 31 2026):

| Contract | Proxy Address |
|---|---|
| ProovCore | `0x6f379efDb10aFD85b233aE35Ad01164c7bc54eE2` |
| SessionManager | `0xea7d4608e9e2798D826d0DD698A7637EC83EA8d2` |
| CircleManager | `0x5366DB5a7aB63ceDE7229d15179633CA69ad076D` |
| FuelFaucet | `0x500e1c72aB3c5C5be17255fe6f66bA8f3c37E988` |

**Live app:** https://proov-one.vercel.app  
**Subgraph:** Goldsky v4.0.0  
**Analytics:** Dune dashboard  
**AI Agent:** ERC-8004 registered at `0xc8BF2144e4742230c8Fd692d940032E6277883e2`

---

## 2. What Has Been Fixed Since v1 Review

Several critical issues from the first review have been addressed. This section is here to document progress so grant reviewers (and you) can see the trajectory.

### Fixed ✓

| Issue | Fix Applied |
|---|---|
| **Streak was fully gameable** — anyone could call `recordStreakIncrement(200)` directly | ProovCore v3 moves streak tracking on-chain inside `selfCompleteHabit`. Streak is derived from `block.timestamp / 1 days`. Cannot be gamed. |
| **`selfCompleteHabit` emitted `streak: 0` always** | Now emits the actual computed streak value. |
| **Same habit could be completed multiple times in one day** | `AlreadyCompletedToday` custom error added. Per-habit-per-day guard via `_lastHabitDay` mapping. |
| **No habitId validation** — any ID worked | `NotAuthorized` error if `habitId >= user's habit count`. |
| **Redundant `timestamp` param in all events** | Removed from all events in all 4 contracts (~500 gas saved per transaction). |
| **Duplicate `editUsername` function** | Removed from ProovCore. Frontend hook routes `editUsername()` to `setUsername()`. |
| **Duplicate `cheer` alias in CircleManager** | Removed. Frontend hook routes `sendNudge()` to `sendCheer()`. |
| **`recordStreakIncrement` was separate tx (2 txs per completion)** | Now a no-op stub. Streak handled in `selfCompleteHabit`. One tx per completion instead of two. |
| **FuelFaucet used string require messages** | Replaced with 5 custom errors (`FaucetEmpty`, `ClaimTooSoon`, etc.). |
| **FuelFaucet did multiple cold SLOADs** | `dripAmount` and `minContractBalance` cached in memory at function start. |
| **No `/stats` page** | `/stats` page built. |
| **No `/recovery` page** | `/recovery` page built (343 lines, reads from Goldsky subgraph with no Supabase dependency). |
| **No Terms of Service / Privacy Policy** | `/terms` and `/privacy` pages built. |
| **All 4 contracts packed user data into one uint256 slot** | `getUserStats(address)` view returns habitCount, lastCompletionDay, currentStreak, longestStreak — all from one SLOAD. |

### Still Pending (addressed in sections below)

The v3 contracts are written and tested (48/48 tests pass), but **not yet deployed to mainnet**. The existing mainnet proxies still run v2 logic. Deploying the v3 implementations is the next concrete action.

---

## 3. Brutal Honest Assessment

### 3.1 — The Core Idea Holds Up

The architecture is right. Event-log-only contracts with Supabase as the app layer and the chain as proof is the correct tradeoff for this use case. Trying to store all habit data on-chain would cost 10× more per transaction and make the app unusable at current CELO prices.

The v3 streak fix is significant. Before, the "Your discipline. Onchain. Forever." tagline was marketing. Now the streak can be verified from the chain without trusting Supabase. That's a real improvement in the core claim.

### 3.2 — The "Proof" Claim Still Has a Partial Hole

Even with the v3 fix, there's a subtle issue: `selfCompleteHabit` does not verify that the user actually *did* the habit. It just proves they pressed a button. The AI verification (Claude Sonnet) exists for fitness habits and partially addresses this — but it runs server-side and the `verificationHash` parameter is currently ignored in the contract.

**What this means in practice:** for non-fitness habits (Focus, Hydration, Sleep, Reading, Custom), there is zero verification that the completion is real. A bot could auto-complete all habits every day.

**Fix:** Either extend AI verification to all habit types (low cost — the API call is already wired) or be upfront in the grant application that "proof" means "the user attested to completing this" rather than "this was externally verified." The second framing is honest and still valuable. The first is better.

### 3.3 — FuelFaucet Is Still a Ticking Cost

The daily drip is still 0.2 CELO/user. The contract is still owner-funded with no revenue mechanism to offset it.

| Daily Active Users | Monthly cost at $0.35/CELO |
|---|---|
| 100 | $210/month |
| 500 | $1,050/month |
| 1,000 | $2,100/month |
| 5,000 | $10,500/month |

**Fix (no code required):** Register with Divvi at `divvi.xyz`. Proov earns a share of the gas fees its users already pay. This is free revenue and partially offsets faucet costs. Divvi integration is a strong signal to grant reviewers — it means Proov is thinking about sustainability, not just grants.

### 3.4 — Single Owner Key on All 4 Contracts

All four UUPS proxies have a single EOA as owner. One compromised key = all four contracts can be upgraded to malicious code by an attacker. This is the highest-impact security risk in the project.

**Fix:** Transfer ownership to a Safe multisig (2/3) before deploying v3. Then add a `TimelockController` (48-hour minimum delay on upgrades). This is two steps:
1. Deploy Safe at `app.safe.global` — free, takes 10 minutes.
2. Call `transferOwnership(safeAddress)` on all four proxies.
3. Later: add timelock when there are real users to protect.

### 3.5 — The Goldsky Subgraph Must Be Updated Before v3 Deployment

The v3 contracts emit different event signatures — timestamps were removed from all events. The deployed Goldsky subgraph (v4.0.0) is built against the v2 ABI which includes timestamp params. When v3 contracts go live and start emitting new-format events, the subgraph will stop indexing correctly.

**Fix:** Before deploying v3 contracts to mainnet, deploy a new Goldsky subgraph version (v5.0.0) built against the v3 ABI. The handler code itself doesn't need changing (it already uses `event.block.timestamp`), only the ABI definitions in `subgraph.yaml` need updating.

### 3.6 — Frontend ABIs Are Out of Sync with v3 Contracts

`contracts.ts` and `transactions.ts` still reference the v2 ABI (with `editUsername`, `recordStreakIncrement`, `cheer`, and timestamp params in events). This is correct while v2 is on mainnet, but these files must be updated atomically when v3 deploys. Do not deploy v3 contracts without also updating the frontend ABIs and Goldsky subgraph in the same release.

### 3.7 — `_lastHabitDay` Adds Storage Cost But Is Worth It

The per-habit-per-day completion guard in v3 adds one SSTORE (~5,000 gas for a slot that was zero, ~2,900 if warm) per first daily completion per habit. This raises the cost of `selfCompleteHabit` slightly. It's worth it — it closes the "complete same habit 100 times" spam vector and protects the integrity of the on-chain data. But users who have many habits will pay slightly more gas per day.

### 3.8 — `recordProgress` in SessionManager Is a Wasted Transaction

The frontend calls `recordProgress(sessionId)` as a no-op stub that emits nothing and costs 21,000 base gas for zero value. The hook sends this transaction. 21k gas × however many sessions = pure waste.

**Fix:** Remove the `recordProgress` call from `useProovTx`. The stub in the contract can stay for ABI compat but the frontend should not call it.

---

## 4. Does It Work in MiniPay?

**Short answer: Partially.** The detection plumbing exists but the integration is incomplete.

### What's Already There

- `minipay.ts` — `isMiniPay()` detection and `connectMiniPay()` both implemented correctly.
- `withCeloFee()` helper in `constants.ts` uses the correct USDm address for CIP-64 fee abstraction.
- Contracts verified on Celoscan ✓
- `/stats` page exists ✓
- `/terms` and `/privacy` pages exist ✓

### What's Blocking MiniPay Listing

| Blocker | Status | Fix |
|---|---|---|
| Zero-click connect — no Connect Wallet button when `isMiniPay()` is true | Unknown — verify in wallet provider | When `isMiniPay()`, call `eth_requestAccounts` on mount; never render a connect button |
| FuelFaucet UI must be hidden inside MiniPay | Not verified | Wrap faucet UI in `if (!isMiniPay())` |
| CELO balance display hidden from users | Not verified | MiniPay hides CELO — remove any CELO balance from UI when in MiniPay context |
| UI copy: "gas" → "Network fee" | Not verified | Grep all UI strings: "gas", "onramp", "offramp", "crypto" |
| 360 × 640 mobile resolution | Not tested | Test in Chrome DevTools, fix any layout breaks |
| Images SVG or WebP only | Not verified | Audit `<img>` tags and CSS background-image |
| PageSpeed Insights score ≥ 90 mobile | Not captured | Run `https://pagespeed.web.dev` on production URL |
| Low-balance redirect to `https://minipay.opera.com/add_cash` | Not present | Add redirect on insufficient balance |
| In-app support link (Telegram / email) | Not present | Add in settings or footer |
| No `personal_sign` / `eth_signTypedData` in MiniPay flow | Not verified | Audit Web3Auth flow — some paths use message signing |
| Stats page shows on-chain metrics | Partial | Current `/stats` page needs tx volume per stablecoin, failed-tx rate, retention |

**Estimate:** 2–3 days of work to reach MiniPay submission readiness given the detection layer is already built.

**Do this before submitting the intake form at `https://minipay.to/mini-apps`.** MiniPay deprioritizes follow-up on half-built submissions — you typically get one good first impression.

---

## 5. Would It Scale?

**Architecture: Yes. Economics: Not without changes.**

### Technical Scaling

The hybrid architecture (event-log on chain + Supabase for app state + Goldsky for indexing) scales well. The v3 contract changes make it even cheaper per interaction:

- One SLOAD per `selfCompleteHabit` call instead of multiple (packed storage)
- Half as many transactions per habit completion (streak removed from frontend)
- ~500 gas saved per transaction (timestamps removed from events)
- `getUserStats` is a free view call — no RPC spam needed

### Economic Scaling Risk

The FuelFaucet remains the primary scaling constraint. 0.2 CELO per user per day. There is no revenue to offset this. At 1,000 DAU, that's ~$2,100/month out of pocket.

**Fix path:**
1. Register with Divvi (immediate, free) — earns gas fee revenue share from existing users
2. Reduce drip to 0.05 CELO — covers ~10 tx/day which is plenty for typical usage
3. Long-term: streak freeze and habit staking features generate stablecoin revenue that can fund the faucet

### Social Scaling Risk

CircleManager has no hard cap on circle size. The v3 contract removed the fake 10-member cap that only existed on the frontend. This is good — no more artificial limit throttling the social graph. But it means large circles are now possible and the frontend needs to handle them gracefully.

---

## 6. Gas & Cost — What Was Done, What's Left

### Done (v3 contracts, 48/48 tests passing)

| Optimization | Gas Saved |
|---|---|
| Removed `timestamp` from all events (4 contracts) | ~500 gas per tx |
| Packed user data into one uint256 slot (ProovCore) | 1 SLOAD instead of N reads per user |
| Streak computed inside `selfCompleteHabit` | Eliminates second tx entirely (~21k base gas + event gas) |
| Custom errors in FuelFaucet | ~50 gas per revert path |
| Storage var caching in FuelFaucet (`dripAmount`, `minContractBalance`) | ~2,100 gas saved on cold SLOADs |
| `editUsername` and `cheer` removed | Smaller bytecode, cleaner ABI |

### Still To Do

| Optimization | Estimated Saving | Effort |
|---|---|---|
| Remove `recordProgress` call from frontend hook | 21,000 gas per session (wasted base tx cost) | 2 lines of code |
| Extend `verificationHash` usage — store the hash in `_lastHabitDay` proof slot | Makes AI verification verifiable on-chain | Medium |
| ERC-4337 Paymaster for new-user gas sponsoring | Replaces FuelFaucet recurring cost with per-user-once model | High |
| Divvi registration | Revenue share on all user gas fees | 20 minutes |

---

## 7. Drop, Keep, Change, Add

### Drop Now

| Item | Why |
|---|---|
| `recordProgress()` call in `useProovTx` | No-op function, 21k gas wasted per call |
| Daily faucet model as the sole gas strategy | Not sustainable — needs Divvi alongside it |

### Keep

| Item | Why |
|---|---|
| Event-log-only contract architecture | Correct. Cheap and indexable. |
| UUPS upgradeable pattern | Already proved its value — v3 upgrade possible without proxy change |
| Goldsky + Dune analytics | Required by multiple grant programs |
| AI fitness verification (Claude Sonnet) | Genuine differentiator. The hash is in the tx. Expand it, don't cut it. |
| ERC-8004 agent registration | Directly relevant to Prezenti Frontier Pool (AI agent focus) |
| FuelFaucet contract | Keep it — just add Divvi revenue alongside it and reduce drip amount |
| `/recovery` page | Makes "proof is permanent" claim actually true |

### Change

| Item | What to Change |
|---|---|
| Single owner EOA on all contracts | Transfer to Safe multisig before next upgrade |
| v2 frontend ABIs | Update atomically when v3 deploys — not before |
| AI verification scope | Extend to all 6 habit types, not just Fitness |
| `/stats` page metrics | Add tx volume per stablecoin, retention cohorts, failed-tx rate — required for MiniPay listing |

### Add

| Item | Why | Effort |
|---|---|---|
| **Divvi registration** | Free revenue share from existing user gas fees | 20 min |
| **Karma GAP project profile** | Required for multiple retroactive programs. Set one up and update it monthly. | 30 min |
| **In-app support link** | Required for MiniPay listing | 1 hour |
| **Low-balance deeplink** (`https://minipay.opera.com/add_cash`) | Required for MiniPay listing | 30 min |
| **Streak freeze** (pay 0.5 USDm to protect a streak for 1 day) | First real revenue mechanism. Justifies the Web3 layer with actual stablecoin utility. | 2 days |
| **Habit staking** (stake USDm on completing a streak goal) | Strongest possible Web3 use case for a habit app. Directly answers "why blockchain?" | 3–5 days |

---

## 8. Would It Fit for Grants?

**Yes — strong fit on multiple vectors.**

### What Works in Your Favor

- **Live on Celo Mainnet** with verifiable on-chain activity. The majority of grant applicants don't have deployed contracts.
- **AI agent registered** (ERC-8004). Directly aligned with Celo's current AI agent narrative and the Prezenti Frontier Pool focus.
- **Dune + Goldsky analytics** already set up. Grant reviewers ask for this on day one.
- **`/stats`, `/recovery`, `/terms`, `/privacy` pages** exist. These are checklist items for MiniPay and Prezenti.
- **v3 contracts fix the gameable streak** — the integrity of the "proof" claim is now defensible.

### What Will Hurt Your Application If Not Fixed First

| Gap | Impact |
|---|---|
| No Karma GAP profile | Multiple programs verify progress through it |
| Single owner EOA | Signals immature security posture to technical reviewers |
| FuelFaucet has no sustainability plan | Reviewers will ask how you fund user onboarding at scale |
| No Divvi integration | Missing an obvious free revenue source — reviewers notice |
| `/stats` page incomplete for MiniPay requirements | MiniPay requires tx volume per stablecoin, retention, failed-tx rate |

### Narrative by Program

- **Prezenti Frontier Pool** — Lead with: ERC-8004 agent, Claude Sonnet AI verification, on-chain proof of habit discipline. The "AI and agent economy" framing fits perfectly. Link to the agent metadata URI and the `/api/verify-habit` route.
- **Prezenti Anchor Round** — Frame as milestone-based: M1 = v3 deploy + multisig + Divvi, M2 = MiniPay listing, M3 = streak freeze + habit staking revenue model.
- **Proof of Ship S2** — Requires MiniPay compatibility. Complete the MiniPay adaptation first, then apply.
- **Celo Builder Fund** — Investment framing. Lead with: live product, real on-chain activity, AI agent, path to revenue (Divvi + streak freeze). Email team@verda.ventures.
- **Divvi** — Not a grant but free revenue. Register your contracts, earn from existing users immediately.

---

## 9. Which Grants to Apply to Right Now

**Live data fetched from celopg.eco on 2026-06-02:**

| Grant | Amount | Deadline | Priority | Fit Score |
|---|---|---|---|---|
| **Prezenti: Frontier Pool** | up to $25K USD | 🔴 Jun 30, 2026 | Apply this week | ★★★★★ — AI agent + Claude verification is a direct match for their stated focus |
| **Prezenti: Anchor Round** | up to $25K USD | 🔴 Jun 30, 2026 | Apply this week | ★★★★☆ — Milestone-based, Proov is live, frame the v3 deploy roadmap as funded milestones |
| **Proof of Ship S2** | 20K USDT pool | Jul 31, 2026 | After MiniPay adapt | ★★★☆☆ — Monthly rewards for Mini App builders. Need MiniPay listing first. |
| **Celo Builder Fund** | $25K cUSD | Year-round | After `/stats` complete | ★★★☆☆ — Investment style. Needs DAU + retention data. |
| **Divvi (Proof of Impact)** | Revenue share | Rolling | Register today | ★★★★★ — Zero effort to register. Immediate revenue from existing users. |
| **Commons Builder Income** | Daily rewards | Rolling | Register today | ★★★☆☆ — Low barrier for active builders. |
| **Karma GAP** | (credibility) | — | Do this today | N/A — Not a grant but feeds multiple retroactive programs |

**You have 28 days until both Prezenti rounds close (June 30).** The Frontier Pool (AI agent) is the highest-priority application given the ERC-8004 registration and Claude verification already in place.

---

## 10. Deployment Sequence for v3

The v3 contracts are written and fully tested. Deploying them requires doing the following in order to avoid breaking the live app:

**Step 1 — Create a Safe multisig** (do this before anything else)
- Go to `app.safe.global`, deploy a 2/3 Safe on Celo Mainnet.
- Cost: ~0.01 CELO in gas.

**Step 2 — Deploy new Goldsky subgraph (v5.0.0)** against the v3 ABI
- The v3 events have no `timestamp` param. The v4 subgraph expects them.
- Update `subgraph.yaml` event definitions to match v3 ABI.
- Deploy as a new version: `goldsky subgraph deploy proov/5.0.0`
- Keep v4 running until v3 contracts are live.

**Step 3 — Deploy v3 implementations to mainnet**
```bash
cd apps/contracts && pnpm upgrade:celo
```
This calls `upgrades.upgradeProxy()` on all four proxies — proxy addresses stay the same, only the implementation changes.

**Step 4 — Transfer ownership to Safe**
```solidity
proovCore.transferOwnership(safeAddress);
sessionManager.transferOwnership(safeAddress);
circleManager.transferOwnership(safeAddress);
fuelFaucet.transferOwnership(safeAddress);
```

**Step 5 — Update frontend ABIs**
- In `contracts.ts` and `transactions.ts`: remove `editUsername`, `recordStreakIncrement`, `cheer`; update event definitions to remove `timestamp` params; add `getUserStats`.
- Deploy updated frontend to Vercel.

**Step 6 — Point Goldsky to v3 subgraph URL**
- Update `NEXT_PUBLIC_GOLDSKY_URL` to the v5.0.0 subgraph endpoint.

**Step 7 — Remove `recordProgress` call from `useProovTx`**
- It currently sends a no-op tx that costs 21k gas. Remove the call, not the contract stub.

---

## 11. Priority Order — What to Do Next

### This week (before June 30 grant deadline)

1. **Apply to Prezenti Frontier Pool** — takes ~2 hours. Don't wait for everything to be perfect.
2. **Apply to Prezenti Anchor Round** — same application with different framing.
3. **Set up Karma GAP profile** — takes 30 minutes, feeds multiple future programs.
4. **Register with Divvi** — 20 minutes for immediate revenue.

### Next 2 weeks (unlock MiniPay + Proof of Ship)

5. Wire `isMiniPay()` into wallet provider for zero-click connect
6. Suppress FuelFaucet + CELO UI when `isMiniPay()` is true
7. Sweep UI copy for "gas" → "Network fee"
8. Add in-app Telegram support link
9. Add low-balance deeplink redirect
10. Test at 360×640, capture PageSpeed score
11. Submit MiniPay intake form at `https://minipay.to/mini-apps`
12. Apply to Proof of Ship S2

### Next month (security + revenue)

13. Deploy Safe multisig + transfer ownership
14. Deploy v3 contracts (follows Safe setup)
15. Update Goldsky subgraph to v5.0.0 (new ABI)
16. Update frontend ABIs
17. Remove `recordProgress` call from hook
18. Build streak freeze feature (first stablecoin revenue)

### Later (product growth)

19. Habit staking (stake USDm on a streak goal)
20. Extend AI verification to all 6 habit types
21. ERC-4337 Paymaster to replace FuelFaucet recurring cost

---

*Grant data: live from celopg.eco · 2026-06-02*  
*Contract addresses: Celo Mainnet · block 68,295,054 · May 31 2026*  
*v3 contracts compiled and tested (48/48 passing) — not yet deployed to mainnet*
