// Fee currency for all Celo transactions — USDm (cUSD)
// Source: celopedia-skills builder-guide.md → Allowed Fee Currencies (Mainnet)
export const FEE_CURRENCY_USDM = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`;

// Injects feeCurrency into a writeContract call.
// feeCurrency is a Celo-specific extension not in standard wagmi types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withCeloFee = <T extends object>(args: T): T & { feeCurrency: `0x${string}` } =>
  ({ ...args, feeCurrency: FEE_CURRENCY_USDM } as T & { feeCurrency: `0x${string}` });

export const CONTRACT_ADDRESSES = {
  ProovCore: (process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS || "") as `0x${string}`,
  SessionManager: (process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS || "") as `0x${string}`,
  CircleManager: (process.env.NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS || "") as `0x${string}`,
} as const;

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "11142220");

export const HabitType = {
  FOCUS: 0,
  FITNESS: 1,
  READING: 2,
  HYDRATION: 3,
  SLEEP: 4,
  CUSTOM: 5,
} as const;

export const HabitTypeLabel: Record<number, string> = {
  0: "Focus",
  1: "Fitness",
  2: "Reading",
  3: "Hydration",
  4: "Sleep",
  5: "Custom",
};

export const Frequency = {
  DAILY: 0,
  WEEKLY: 1,
} as const;

export const STREAK_MILESTONES = [7, 21, 30, 50, 100, 200];

export const MIN_SESSION_SECONDS = 1500; // 25 minutes

// Recommended starter habits shown to new users
export const STARTER_HABITS = [
  { name: "Deep Work", habitType: HabitType.FOCUS, targetDuration: 5400, frequency: Frequency.DAILY },
  { name: "Morning Run", habitType: HabitType.FITNESS, targetDuration: 1800, frequency: Frequency.DAILY },
  { name: "Read 20 Pages", habitType: HabitType.READING, targetDuration: 1200, frequency: Frequency.DAILY },
  { name: "Drink 8 Glasses of Water", habitType: HabitType.HYDRATION, targetDuration: 0, frequency: Frequency.DAILY },
  { name: "Journal Entry", habitType: HabitType.CUSTOM, targetDuration: 0, frequency: Frequency.DAILY },
] as const;
