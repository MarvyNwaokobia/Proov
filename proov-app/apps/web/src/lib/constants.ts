// Fee currency for all Celo transactions — native CELO
export const FEE_CURRENCY_USDM = "0x471EcE3750Da237f93B8E339c536989b8978a438" as `0x${string}`;

// Injects feeCurrency into a writeContract call.
// feeCurrency is a Celo-specific extension not in standard wagmi types.
export const withCeloFee = <T extends object>(args: T): T & { feeCurrency: `0x${string}` } =>
  ({ ...args, feeCurrency: FEE_CURRENCY_USDM } as T & { feeCurrency: `0x${string}` });

export const CONTRACT_ADDRESSES = {
  ProovCore: (process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS || "") as `0x${string}`,
  SessionManager: (process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS || "") as `0x${string}`,
  CircleManager: (process.env.NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS || "") as `0x${string}`,
  FuelFaucet: (process.env.NEXT_PUBLIC_FUEL_FAUCET_ADDRESS || "") as `0x${string}`,
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

// Frontend minimum for timer UI — contract enforces 1500s (25 min) for streak credit
export const MIN_SESSION_SECONDS = 60; // 1 minute
export const MIN_SESSION_FOR_CREDIT = 1500; // 25 minutes (contract minimum)
export const MAX_SESSION_SECONDS = 28800; // 8 hours

// Timer preset options in seconds
export const TIMER_PRESETS = [
  { label: "5m",  seconds: 300   },
  { label: "15m", seconds: 900   },
  { label: "25m", seconds: 1500  },
  { label: "45m", seconds: 2700  },
  { label: "60m", seconds: 3600  },
  { label: "90m", seconds: 5400  },
  { label: "2h",  seconds: 7200  },
  { label: "4h",  seconds: 14400 },
] as const;

// Habit categories — stored locally alongside contract habit IDs
export const HABIT_CATEGORIES = [
  { id: "focus",     label: "Focus & Work", emoji: "🧠", color: "#6366F1" },
  { id: "fitness",   label: "Fitness",      emoji: "💪", color: "#10B981" },
  { id: "wellness",  label: "Wellness",     emoji: "🧘", color: "#F59E0B" },
  { id: "learning",  label: "Learning",     emoji: "📚", color: "#3B82F6" },
  { id: "nutrition", label: "Nutrition",    emoji: "🥗", color: "#84CC16" },
  { id: "social",    label: "Social",       emoji: "👥", color: "#EC4899" },
  { id: "creative",  label: "Creative",     emoji: "🎨", color: "#8B5CF6" },
  { id: "custom",    label: "Custom",       emoji: "⭐", color: "#6B7280" },
] as const;

export type CategoryId = (typeof HABIT_CATEGORIES)[number]["id"];

export function getCategoryById(id: string) {
  return HABIT_CATEGORIES.find((c) => c.id === id) ?? HABIT_CATEGORIES[7];
}

// Suggested habits shown during creation
export const SUGGESTED_HABITS = [
  { name: "Deep Work",          category: "focus",     duration: 90,  emoji: "🧠", description: "Focused work session, no distractions" },
  { name: "Morning Run",        category: "fitness",   duration: 30,  emoji: "🏃", description: "Get your body moving first thing" },
  { name: "Read 20 Pages",      category: "learning",  duration: 20,  emoji: "📖", description: "Daily reading builds knowledge" },
  { name: "Drink 8 Glasses",    category: "nutrition", duration: 0,   emoji: "💧", description: "Stay hydrated throughout the day" },
  { name: "Meditate",           category: "wellness",  duration: 10,  emoji: "🧘", description: "Clear your mind and reset" },
  { name: "No Phone Before 9AM",category: "wellness",  duration: 0,   emoji: "📵", description: "Start your day with intention" },
  { name: "Journal",            category: "creative",  duration: 15,  emoji: "✍️", description: "Write what's on your mind" },
  { name: "Cold Shower",        category: "fitness",   duration: 5,   emoji: "🚿", description: "Build discipline, wake up fast" },
  { name: "Learn Something New",category: "learning",  duration: 30,  emoji: "💡", description: "One new thing every day" },
  { name: "Gratitude List",     category: "wellness",  duration: 5,   emoji: "🙏", description: "3 things you're grateful for" },
] as const;

// Legacy starter habits (kept for backward compat with habit creation fallback)
export const STARTER_HABITS = [
  { name: "Deep Work",             habitType: HabitType.FOCUS,     targetDuration: 5400, frequency: Frequency.DAILY },
  { name: "Morning Run",           habitType: HabitType.FITNESS,   targetDuration: 1800, frequency: Frequency.DAILY },
  { name: "Read 20 Pages",         habitType: HabitType.READING,   targetDuration: 1200, frequency: Frequency.DAILY },
  { name: "Drink 8 Glasses",       habitType: HabitType.HYDRATION, targetDuration: 0,    frequency: Frequency.DAILY },
  { name: "Meditate",              habitType: HabitType.CUSTOM,    targetDuration: 600,  frequency: Frequency.DAILY },
  { name: "Journal",               habitType: HabitType.CUSTOM,    targetDuration: 0,    frequency: Frequency.DAILY },
  { name: "Cold Shower",           habitType: HabitType.FITNESS,   targetDuration: 300,  frequency: Frequency.DAILY },
  { name: "Gratitude List",        habitType: HabitType.CUSTOM,    targetDuration: 300,  frequency: Frequency.DAILY },
] as const;
