export const CONTRACTS = {
  PROOV_CORE: process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS as `0x${string}`,
  SESSION_MANAGER: process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS as `0x${string}`,
  CIRCLE_MANAGER: process.env.NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS as `0x${string}`,
};

export const PROOV_CORE_ABI = [
  {
    name: 'createHabit', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'isTimed', type: 'bool' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [{ name: 'habitId', type: 'uint256' }],
  },
  {
    name: 'completeHabit', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'habitId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'removeHabit', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'habitId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'editHabit', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'habitId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'isTimed', type: 'bool' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'recordStreakIncrement', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'newStreakCount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setUsername', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'username', type: 'string' }],
    outputs: [],
  },
  {
    name: 'editUsername', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'newUsername', type: 'string' }],
    outputs: [],
  },
  {
    name: 'updateVisibility', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'visibilitySetting', type: 'string' }],
    outputs: [],
  },
] as const;

export const SESSION_MANAGER_ABI = [
  {
    name: 'startSession', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'habitId', type: 'uint256' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [{ name: 'sessionId', type: 'uint256' }],
  },
  {
    name: 'endSession', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionId', type: 'uint256' },
      { name: 'completed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'cancelSession', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'sessionId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'recordProgress', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'sessionId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'startCustomSession', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [{ name: 'sessionId', type: 'uint256' }],
  },
  {
    name: 'endCustomSession', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionId', type: 'uint256' },
      { name: 'completed', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

export const CIRCLE_MANAGER_ABI = [
  {
    name: 'sendRequest', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
  {
    name: 'acceptRequest', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'from', type: 'address' }],
    outputs: [],
  },
  {
    name: 'sendCheer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
] as const;
