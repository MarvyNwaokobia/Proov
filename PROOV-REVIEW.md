# Proov — Full Review v3
### Brutal Honesty · Gas Audit · MiniPay · Grants

> Updated: 2026-06-04  
> Reflects the current state of the codebase including v3.1 contracts, MiniPay blocker fixes (June 3), and live grant data from celopg.eco

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
**Subgraph:** Goldsky v5.1.0  
**Analytics:** Dune dashboard  
**AI Agent:** ERC-8004 registered at `0xc8BF2144e4742230c8Fd692d940032E6277883e2`

---

## 2. What Has Been Fixed Since v1 Review

Several critical issues from the first review have been addressed. This section documents progress so grant reviewers can see the trajectory.

### Fixed in v3 contracts ✓

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
| **No `/recovery` page** | `/recovery` page built (reads from Goldsky subgraph with no Supabase dependency). |
| **No Terms of Service / Privacy Policy** | `/terms` and `/privacy` pages built. |
| **All 4 contracts packed user data into one uint256 slot** | `getUserStats(address)` view returns habitCount, lastCompletionDay, currentStreak, longestStreak — all from one SLOAD. |

### Fixed in June 2–3 session ✓

| Item | Status |
|---|---|
| Safe multisig created + ownership transferred to `0x1F22b145b092177330354074CC5e9300fe049B5c` | ✓ Done |
| v3 contracts deployed to mainnet via Safe | ✓ Done |
| v3.1 contracts deployed — `verificationHash` emitted in `HabitCompleted` event | ✓ Done |
| Goldsky subgraph v5.1.0 deployed (`verificationHash` indexed) | ✓ Done |
| Frontend ABIs synced to v3.1 | ✓ Done |
| AI verification extended to all habit types — "Proov it" fires on-chain tx with proof hash | ✓ Done |
| LCP fixed (5s → <1s) — logo 650KB→20KB, fonts non-blocking, lazy WalletProvider | ✓ Done — PageSpeed 67→90+ |
| **Zero-click MiniPay connect** — `signin` calls `connectMiniPay()` on mount, no connect button shown | ✓ Done |
| **Fuel section hidden in MiniPay** — `{!miniPayUser && ...}` guard in settings | ✓ Done |
| **CELO balance hidden in MiniPay** — `user-balance.tsx` shows only cUSD when `isMiniPay()` | ✓ Done |
| **In-app support links** — Telegram (@Proovhq) + email (proovhq@gmail.com) rows in settings | ✓ Done |
| **Low-balance deeplink** — `useBackgroundTx.ts` redirects to `https://minipay.opera.com/add_cash` | ✓ Done |
| **`recordProgress` no longer sends a tx** — hook returns `Promise.resolve('0x')` immediately | ✓ Done |
| **Auto-drip removed** — fuel is now user-claimed when tank is low, once per UTC day | ✓ Done |
| **No "gas" copy in UI** — grep confirms zero user-facing "gas", "onramp", "offramp" strings | ✓ Done |

---

## 3. Brutal Honest Assessment

### 3.1 — The Core Idea Holds Up

The architecture is right. Event-log-only contracts with Supabase as the app layer and the chain as proof is the correct tradeoff for this use case. Trying to store all habit data on-chain would cost 10× more per transaction and make the app unusable at current CELO prices.

The v3 streak fix is significant. Before, the "Your discipline. Onchain. Forever." tagline was marketing. Now the streak can be verified from the chain without trusting Supabase. That's a real improvement in the core claim.

### 3.2 — The "Proof" Claim Is Now Honest and Defensible

AI verification now covers all habit categories — Fitness, Wellness, Focus, Learning, Nutrition, Creative, and Custom. Both photo and text proof modes work for every habit type. The API system prompt explicitly instructs Claude Sonnet to judge each by what makes sense for that category. The `verificationHash` (`sha256(habitId|addr|proofType|proofContent|reasoning)`) is computed server-side, returned to the frontend, and passed directly into `selfCompleteHabit` — emitted on-chain in the `HabitCompleted` event and indexed by Goldsky v5.1.0.

**The one honest nuance that remains:** verification is optional. Users can skip "Proov it" and self-report, or tap "Just self-report instead" after a rejection. So a determined bot could still auto-complete without verifying.

**The right grant framing:** *"Verified completions have an on-chain proof hash committed by Claude Sonnet; self-reported completions are user-attested."* Both tiers are valuable — the chain records when and how consistently a user completed, regardless of tier. This is honest and no grant reviewer can fault it.

### 3.3 — FuelFaucet Is Still a Ticking Cost (Improved Model)

The faucet was changed from auto-drip to user-triggered (claim only when tank is low, once per UTC day). This is a meaningful improvement — no one drains the faucet by accident. But the fundamental math hasn't changed.

| Daily Active Users | Monthly cost at $0.35/CELO |
|---|---|
| 100 | $210/month |
| 500 | $1,050/month |
| 1,000 | $2,100/month |
| 5,000 | $10,500/month |

**Fix (no code required):** Register with Divvi at `divvi.xyz`. Proov earns a share of the gas fees its users already pay. This is free revenue and partially offsets faucet costs. Divvi integration is a strong signal to grant reviewers — it means Proov is thinking about sustainability, not just grants.

### 3.4 — Single Owner Key Risk Is Resolved

Safe multisig at `0x1F22b145b092177330354074CC5e9300fe049B5c` is live. Ownership of all four UUPS proxies transferred. This was the highest-impact security risk; it is now closed.

**What's still missing:** a `TimelockController` (48-hour minimum delay on upgrades). This is the next security hardening step once there are real users to protect. Scripts already exist at `scripts/deploy-timelock.ts` and `scripts/timelock-add-safe.ts`.

### 3.5 — `verificationHash` Is Emitted But Not Yet Anchored

The v3.1 contract emits `verificationHash` in `HabitCompleted` and Goldsky v5.1.0 indexes it. The hash is passed from the frontend to the contract for verified completions. However, there is no on-chain way to independently re-derive that hash from the original photo — the chain stores the hash but not the image, and there's no canonical commitment scheme documented.

**This is fine for now.** The hash proves the server processed something and committed to a result before the tx confirmed. For grant purposes this is a genuine differentiator. If Proov later documents the hash scheme (e.g. `sha256(imageBytes + walletAddress + habitId + date)`), it becomes independently verifiable.

### 3.6 — `/stats` Page Metrics Are Incomplete for MiniPay

The current `/stats` page shows on-chain activity (habit completions, streaks, sessions). MiniPay listing requires tx volume per stablecoin, failed-tx rate, and retention cohorts. These are not present. This is the last substantive gap before MiniPay submission.

---

## 4. Does It Work in MiniPay?

**Short answer: Almost ready to submit.**

### What's Working ✓

| Item | Evidence |
|---|---|
| **Zero-click connect** | `signin/page.tsx:70-80` — `connectMiniPay()` called on mount when `isMiniPay()`. No connect button shown. |
| **Fuel section hidden** | `settings/page.tsx:522-570` — `{!miniPayUser && (...)}` wraps entire fuel block |
| **CELO balance hidden** | `user-balance.tsx:42-51` — shows only cUSD inside MiniPay |
| **In-app support** | Settings: Telegram (@Proovhq) + email (proovhq@gmail.com) rows with icons |
| **Low-balance deeplink** | `useBackgroundTx.ts:47,211` — `https://minipay.opera.com/add_cash` |
| **No "gas" copy** | Grep across all TSX/TS confirms zero user-facing "gas", "onramp", "offramp", "crypto" strings |
| **Contracts verified on Celoscan** | ✓ |
| **PageSpeed ≥ 90 mobile** | ✓ (67→90+ after June 2 fix) |
| **`/stats`, `/terms`, `/privacy` pages** | ✓ |
| **Fee abstraction (CIP-64)** | `withCeloFee()` in `constants.ts` uses correct USDm address |

### Remaining Before Submission

| Item | Gap | Effort |
|---|---|---|
| **360×640 layout test** | Not tested — may have overflow or truncation at mobile resolution | 2 hours |
| **SVG/WebP image audit** | MiniPay requires SVG or WebP only — `<img>` tags not audited | 1 hour |
| **`personal_sign` / `eth_signTypedData` audit** | Web3Auth sign flows must not appear in MiniPay paths | 1 hour |
| **`/stats` stablecoin metrics** | MiniPay requires tx volume per stablecoin, retention, failed-tx rate | 1 day |

**Revised estimate:** ~1–2 days to full submission readiness. The blockers from the previous review are resolved. What remains is polish and testing.

**Submit the intake form at `https://minipay.to/mini-apps` after the 360×640 test passes.** MiniPay deprioritizes follow-up on half-built submissions — you get one good first impression.

---

## 5. Would It Scale?

**Architecture: Yes. Economics: Not without changes.**

### Technical Scaling

The hybrid architecture (event-log on chain + Supabase for app state + Goldsky for indexing) scales well. The v3 contract changes make it even cheaper per interaction:

- One SLOAD per `selfCompleteHabit` call instead of multiple (packed storage)
- One transaction per habit completion (streak integrated, no second tx)
- ~500 gas saved per transaction (timestamps removed from events)
- `getUserStats` is a free view call — no RPC spam needed

### Economic Scaling Risk

The FuelFaucet remains the primary scaling constraint. 0.2 CELO per user per day, user-triggered. There is no revenue to offset this. At 1,000 DAU, that's ~$2,100/month out of pocket.

**Fix path:**
1. Register with Divvi (immediate, free) — earns gas fee revenue share from existing users
2. Reduce drip to 0.05 CELO — covers ~10 tx/day which is plenty for typical usage
3. Long-term: streak freeze and habit staking features generate stablecoin revenue that can fund the faucet

### Social Scaling Risk

CircleManager has no hard cap on circle size. The v3 contract removed the fake 10-member cap that only existed on the frontend. This is good — no more artificial limit throttling the social graph. But it means large circles are now possible and the frontend needs to handle them gracefully.

---

## 6. Gas & Cost — What Was Done, What's Left

### Done

| Optimization | Gas Saved |
|---|---|
| Removed `timestamp` from all events (4 contracts) | ~500 gas per tx |
| Packed user data into one uint256 slot (ProovCore) | 1 SLOAD instead of N reads per user |
| Streak computed inside `selfCompleteHabit` | Eliminates second tx (~21k base gas + event gas) |
| Custom errors in FuelFaucet | ~50 gas per revert path |
| Storage var caching in FuelFaucet (`dripAmount`, `minContractBalance`) | ~2,100 gas saved on cold SLOADs |
| `editUsername` and `cheer` removed | Smaller bytecode, cleaner ABI |
| `recordProgress` returns immediately without sending tx | 21,000 gas saved per session |
| Auto-drip removed — user-triggered faucet | No passive CELO drain for idle users |

### Still To Do

| Optimization | Estimated Saving | Effort |
|---|---|---|
| Extend `verificationHash` anchoring — document the hash scheme | Makes AI verification independently auditable | Medium |
| ERC-4337 Paymaster for new-user gas sponsoring | Replaces FuelFaucet recurring cost with per-user-once model | High |
| Divvi registration | Revenue share on all user gas fees | 20 minutes |
| Reduce drip from 0.2 → 0.05 CELO | 75% faucet cost reduction | 10 minutes |

---

## 7. Drop, Keep, Change, Add

### Drop Now

| Item | Why |
|---|---|
| Auto-drip faucet model as the *sole* gas strategy | Not sustainable — needs Divvi alongside it (already removed auto-drip ✓) |

### Keep

| Item | Why |
|---|---|
| Event-log-only contract architecture | Correct. Cheap and indexable. |
| UUPS upgradeable pattern | Already proved its value — v3 upgrade possible without proxy change |
| Goldsky + Dune analytics | Required by multiple grant programs |
| AI fitness verification (Claude Sonnet) | Genuine differentiator. The hash is on-chain. Expand it, don't cut it. |
| ERC-8004 agent registration | Directly relevant to Prezenti Frontier Pool (AI agent focus) |
| FuelFaucet contract | Keep it — add Divvi revenue alongside it and reduce drip amount |
| `/recovery` page | Makes "proof is permanent" claim actually true |
| User-triggered fuel claim | Better UX and economics than auto-drip |

### Change

| Item | What to Change |
|---|---|
| `/stats` page metrics | Add tx volume per stablecoin, retention cohorts, failed-tx rate — required for MiniPay listing |
| Faucet drip amount | Reduce from 0.2 → 0.05 CELO — 75% cost reduction, still covers typical usage |
| `verificationHash` scheme | Document how the hash is derived so it's independently verifiable |

### Add

| Item | Why | Effort |
|---|---|---|
| **Divvi registration** | Free revenue share from existing user gas fees | 20 min |
| **Karma GAP project profile** | Required for multiple retroactive programs. Set one up and update it monthly. | 30 min |
| **TimelockController** | Next security hardening step after Safe (scripts already exist) | 1 hour |
| **Streak freeze** (pay 0.5 USDm to protect a streak for 1 day) | First real revenue mechanism. Justifies the Web3 layer with actual stablecoin utility. | 2 days |
| **Habit staking** (stake USDm on completing a streak goal) | Strongest possible Web3 use case for a habit app. Directly answers "why blockchain?" | 3–5 days |

---

## 8. Would It Fit for Grants?

**Yes — strong fit on multiple vectors.**

### What Works in Your Favor

- **Live on Celo Mainnet** with verifiable on-chain activity. The majority of grant applicants don't have deployed contracts.
- **AI agent registered** (ERC-8004). Directly aligned with Celo's current AI agent narrative and the Prezenti Frontier Pool focus.
- **`verificationHash` on-chain** — Claude Sonnet verification result committed to the chain for all habit types.
- **Dune + Goldsky analytics** already set up. Grant reviewers ask for this on day one.
- **`/stats`, `/recovery`, `/terms`, `/privacy` pages** exist. These are checklist items for MiniPay and Prezenti.
- **Safe multisig ownership** — signals mature security posture to technical reviewers.
- **v3 contracts fix the gameable streak** — the integrity of the "proof" claim is now defensible.
- **MiniPay-ready** — all major blockers resolved. Submission is days away.

### What Will Hurt Your Application If Not Fixed First

| Gap | Impact |
|---|---|
| No Karma GAP profile | Multiple programs verify progress through it |
| FuelFaucet has no sustainability plan | Reviewers will ask how you fund user onboarding at scale |
| No Divvi integration | Missing an obvious free revenue source — reviewers notice |
| `/stats` page incomplete for MiniPay requirements | MiniPay requires tx volume per stablecoin, retention, failed-tx rate |

### Narrative by Program

- **Prezenti Frontier Pool** — Lead with: ERC-8004 agent, Claude Sonnet AI verification with on-chain `verificationHash`, immutable habit proof. The "AI and agent economy" framing fits perfectly. Link to the agent metadata URI and the `/api/verify-habit` route.
- **Prezenti Anchor Round** — Frame as milestone-based: M1 = MiniPay listing, M2 = streak freeze + habit staking revenue model, M3 = Paymaster replacing FuelFaucet.
- **Proof of Ship S2** — Requires MiniPay compatibility. Submit intake form after 360×640 test, then apply.
- **Celo Builder Fund** — Investment framing. Lead with: live product, real on-chain activity, AI agent, path to revenue (Divvi + streak freeze). Email team@verda.ventures.
- **Divvi** — Not a grant but free revenue. Register your contracts, earn from existing users immediately.

---

## 9. Which Grants to Apply to Right Now

**Live data fetched from celopg.eco on 2026-06-04:**

| Grant | Amount | Deadline | Priority | Fit Score |
|---|---|---|---|---|
| **Prezenti: Frontier Pool** | up to $25K USD | 🔴 Jun 30, 2026 | Apply this week | ★★★★★ — AI agent + Claude verification is a direct match for their stated focus |
| **Prezenti: Anchor Round** | up to $25K USD | 🔴 Jun 30, 2026 | Apply this week | ★★★★☆ — Milestone-based, Proov is live, frame MiniPay listing + streak freeze as funded milestones |
| **Proof of Ship S2** | 20K USDT pool | Jul 31, 2026 | After MiniPay listing | ★★★☆☆ — Monthly rewards for Mini App builders. Need MiniPay listing first. |
| **Celo Builder Fund** | $25K cUSD | Year-round | After `/stats` complete | ★★★☆☆ — Investment style. Needs DAU + retention data. |
| **Divvi (Proof of Impact)** | Revenue share | Rolling | Register today | ★★★★★ — Zero effort to register. Immediate revenue from existing users. |
| **Commons Builder Income** | Daily rewards | Rolling | Register today | ★★★☆☆ — Low barrier for active builders. |
| **Karma GAP** | (credibility) | — | Do this today | N/A — Not a grant but feeds multiple retroactive programs |

**You have 26 days until both Prezenti rounds close (June 30).** The Frontier Pool (AI agent) is the highest-priority application given the ERC-8004 registration and Claude verification already in place.

---

## 10. Deployment Sequence — COMPLETED ✓

All steps below were executed during the June 2–3 session.

| Step | Status | Details |
|---|---|---|
| Safe multisig created | ✓ | `0x1F22b145b092177330354074CC5e9300fe049B5c` |
| Ownership transferred to Safe | ✓ | `transfer-ownership.ts` — 4 txs confirmed |
| Goldsky subgraph v5.0.0 deployed | ✓ | v3 ABI, no timestamps |
| v3 contracts deployed via Safe | ✓ | `upgrade-via-safe.ts` — all 4 proxies upgraded |
| Goldsky subgraph v5.1.0 deployed | ✓ | Added `verificationHash` to `HabitCompleted` |
| v3.1 contracts deployed via Safe | ✓ | ProovCore emits `verificationHash` |
| Frontend ABIs updated | ✓ | `contracts.ts`, `transactions.ts` — synced to v3.1 |
| `.env.local` Goldsky URL | ✓ | Points to v5.1.0 |
| MiniPay blockers resolved | ✓ | Zero-click connect, fuel gate, deeplink, support links, CELO balance hidden |
| PageSpeed 67→90+ | ✓ | Logo compressed, fonts non-blocking, lazy WalletProvider |

**Remaining:** Update `NEXT_PUBLIC_GOLDSKY_URL` in Vercel to v5.1.0 if not already done, and confirm production deploy reflects all June 3 changes.

---

## 11. Priority Order — What to Do Next

### This week — unlock grants (before June 30)

1. **Apply to Prezenti Frontier Pool** — takes ~2 hours. Lead with ERC-8004, `verificationHash`, Claude Sonnet. Don't wait for everything to be perfect.
2. **Apply to Prezenti Anchor Round** — same application, milestone framing.
3. **Set up Karma GAP profile** — 30 minutes, feeds multiple future programs.
4. **Register with Divvi** — 20 minutes for immediate revenue.

### Next 1–2 days — complete MiniPay submission

5. Test at 360×640 — fix any layout overflow or truncation
6. Audit `<img>` and CSS background-image — convert PNG/JPG to WebP
7. Verify no `personal_sign` / `eth_signTypedData` in MiniPay code paths
8. Add tx volume per stablecoin, retention, failed-tx rate to `/stats` page
9. Submit MiniPay intake form at `https://minipay.to/mini-apps`
10. Apply to Proof of Ship S2

### Next week — hardening

11. Reduce FuelFaucet drip from 0.2 → 0.05 CELO
12. Deploy TimelockController and connect to Safe (48-hour upgrade delay)
13. Document `verificationHash` scheme for independent auditability

### Next month — revenue

14. Build streak freeze feature (first stablecoin revenue — 0.5 USDm per freeze)
15. Build habit staking (stake USDm on a streak goal)
16. ERC-4337 Paymaster to replace FuelFaucet recurring cost

---

*Grant data: live from celopg.eco · 2026-06-04*  
*Contract addresses: Celo Mainnet · block 68,295,054 · May 31 2026*  
*v3.1 contracts live on mainnet · Goldsky v5.1.0 · PageSpeed ≥ 90*
