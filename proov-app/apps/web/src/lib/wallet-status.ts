/**
 * Tracks the outcome of the most recent Web3Auth session-restoration attempt
 * (the wagmi `reconnect()` that runs on app mount for returning users).
 *
 * `useBackgroundTx` reads this to turn a generic "wallet not connected" failure
 * into a message that matches what actually went wrong, instead of always
 * blaming the wallet.
 */

export type WalletRestoreState =
  | 'pending'        // no reconnect attempt has finished yet
  | 'restored'       // session restored successfully, wallet connected
  | 'expired'        // Web3Auth session is gone — user needs to sign in again
  | 'restore-failed' // restoration attempt errored or timed out (likely transient)
  | 'account-error'; // session is valid but the embedded wallet account couldn't be loaded

let state: WalletRestoreState = 'pending';
let lastError: string | null = null;

export function setWalletRestoreState(next: WalletRestoreState, error?: string): void {
  state = next;
  lastError = error ?? null;
}

export function getWalletRestoreState(): { state: WalletRestoreState; lastError: string | null } {
  return { state, lastError };
}
