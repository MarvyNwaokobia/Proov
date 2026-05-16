import { CONTRACT_ADDRESSES } from "./constants";

export const PROOV_CORE_ABI = [
  // createHabit
  {
    name: "createHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "habitType", type: "uint8" },
      { name: "targetDuration", type: "uint256" },
      { name: "frequency", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // selfCompleteHabit
  {
    name: "selfCompleteHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "habitId", type: "uint256" },
      { name: "verificationHash", type: "bytes32" },
    ],
    outputs: [],
  },
  // deactivateHabit
  {
    name: "deactivateHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
  },
  // logJournalEntry
  {
    name: "logJournalEntry",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "contentHash", type: "bytes32" }],
    outputs: [],
  },
  // getHabits
  {
    name: "getHabits",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "habitType", type: "uint8" },
          { name: "targetDuration", type: "uint256" },
          { name: "frequency", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  // getStats
  {
    name: "getStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "currentStreak", type: "uint256" },
          { name: "longestStreak", type: "uint256" },
          { name: "totalCompletions", type: "uint256" },
          { name: "lastCompletionDay", type: "uint256" },
          { name: "journalCount", type: "uint256" },
        ],
      },
    ],
  },
  // getLeaderboard
  {
    name: "getLeaderboard",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [
      { name: "", type: "address[]" },
      { name: "", type: "uint256[]" },
    ],
  },
  // dailyCompletions
  {
    name: "dailyCompletions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "day", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Events
  {
    name: "HabitCreated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "habitType", type: "uint8", indexed: false },
    ],
  },
  {
    name: "HabitCompleted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: false },
      { name: "day", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreakUpdated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "newStreak", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreakBroken",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "oldStreak", type: "uint256", indexed: false },
    ],
  },
  {
    name: "MilestoneReached",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "milestone", type: "uint256", indexed: false },
    ],
  },
] as const;

export const SESSION_MANAGER_ABI = [
  // startSession
  {
    name: "startSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
  },
  // endSession
  {
    name: "endSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  // abandonSession
  {
    name: "abandonSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  // getActiveSession
  {
    name: "getActiveSession",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "habitId", type: "uint256" },
          { name: "startTimestamp", type: "uint256" },
          { name: "endTimestamp", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "completed", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  // getHistory
  {
    name: "getHistory",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "habitId", type: "uint256" },
          { name: "startTimestamp", type: "uint256" },
          { name: "endTimestamp", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "completed", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  // MIN_SESSION_SECONDS
  {
    name: "MIN_SESSION_SECONDS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Events
  {
    name: "SessionStarted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: false },
      { name: "startTimestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SessionCompleted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: false },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SessionAbandoned",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: false },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
] as const;

export const CIRCLE_MANAGER_ABI = [
  // sendRequest
  {
    name: "sendRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  // acceptRequest
  {
    name: "acceptRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "from", type: "address" }],
    outputs: [],
  },
  // rejectRequest
  {
    name: "rejectRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "from", type: "address" }],
    outputs: [],
  },
  // removeFromCircle
  {
    name: "removeFromCircle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  // witnessHabit
  {
    name: "witnessHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "habitId", type: "uint256" },
    ],
    outputs: [],
  },
  // notifyStreakBroken
  {
    name: "notifyStreakBroken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  // getCircle
  {
    name: "getCircle",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  // getPending
  {
    name: "getPending",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  // connected
  {
    name: "connected",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "a", type: "address" },
      { name: "b", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // Events
  {
    name: "RequestSent",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    name: "RequestAccepted",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    name: "StreakBrokenNotified",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "circleMembers", type: "address[]", indexed: false },
    ],
  },
] as const;

export { CONTRACT_ADDRESSES };
