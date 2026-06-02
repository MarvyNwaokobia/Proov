import { CONTRACT_ADDRESSES } from "./constants";

export const PROOV_CORE_ABI = [
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
  {
    name: "deactivateHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "reactivateHabit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "recordStreakIncrement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newStreak", type: "uint256" }],
    outputs: [],
  },
  {
    name: "setUsername",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "username", type: "string" }],
    outputs: [],
  },
  {
    name: "editUsername",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newUsername", type: "string" }],
    outputs: [],
  },
  {
    name: "updateVisibility",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "visibilitySetting", type: "string" }],
    outputs: [],
  },
  {
    name: "logJournalEntry",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "contentHash", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "HabitCreated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "habitType", type: "uint8", indexed: false },
      { name: "targetDuration", type: "uint256", indexed: false },
      { name: "frequency", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "HabitCompleted",
    type: "event",
    inputs: [
      { name: "user",             type: "address", indexed: true  },
      { name: "habitId",          type: "uint256", indexed: true  },
      { name: "streak",           type: "uint256", indexed: false },
      { name: "verificationHash", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "HabitDeactivated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "HabitReactivated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreakUpdated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "newStreak", type: "uint256", indexed: false },
      { name: "longestStreak", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreakBroken",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "oldStreak", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "MilestoneReached",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "milestone", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "UsernameSet",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "username", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "VisibilityUpdated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "visibilitySetting", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JournalLogged",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "contentHash", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const SESSION_MANAGER_ABI = [
  {
    name: "startSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "habitId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "endSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "habitId", type: "uint256" },
      { name: "durationSeconds", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "abandonSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "habitId", type: "uint256" },
      { name: "durationSeconds", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "SessionStarted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "startTimestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SessionCompleted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SessionAbandoned",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "habitId", type: "uint256", indexed: true },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
] as const;

export const CIRCLE_MANAGER_ABI = [
  {
    name: "sendRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    name: "acceptRequest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "from", type: "address" }],
    outputs: [],
  },
  {
    name: "sendCheer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    name: "cheer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    name: "removeFromCircle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  {
    name: "CircleRequestSent",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "MemberAdded",
    type: "event",
    inputs: [
      { name: "circleOwner", type: "address", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CheerSent",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "RemovedFromCircle",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "removed", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export { CONTRACT_ADDRESSES };
