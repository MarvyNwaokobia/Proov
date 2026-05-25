import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, hexToBytes, bytesToHex, stringToBytes } from 'viem';

export interface SessionKeyInfo {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  expiresAt: string; // ISO string
}

const LOCAL_STORAGE_KEY = 'proov_session_key_v1';

// Derive a 256-bit AES key from the signature of the seed message
async function getEncryptionKey(signature: string): Promise<CryptoKey> {
  const sigBytes = new Uint8Array(hexToBytes(signature as `0x${string}`));
  // Hash the signature bytes with SHA-256 to get exactly 256 bits
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', sigBytes);

  return window.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a private key using a derived key from the user's master signature.
 */
export async function encryptSessionKey(
  privateKey: string,
  signature: string
): Promise<string> {
  const key = await getEncryptionKey(signature);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(privateKey);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const ivHex = bytesToHex(iv);
  const ciphertextHex = bytesToHex(new Uint8Array(ciphertext));

  return `${ivHex}:${ciphertextHex}`;
}

/**
 * Decrypts a private key using a derived key from the user's master signature.
 */
export async function decryptSessionKey(
  encryptedBlob: string,
  signature: string
): Promise<string> {
  const [ivHex, ciphertextHex] = encryptedBlob.split(':');
  if (!ivHex || !ciphertextHex) throw new Error('Invalid encrypted session key format');

  const key = await getEncryptionKey(signature);
  const iv = new Uint8Array(hexToBytes(ivHex as `0x${string}`));
  const ciphertext = new Uint8Array(hexToBytes(ciphertextHex as `0x${string}`));

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generates a new local ephemeral session key pair, with a 24-hour expiration.
 */
export function generateLocalSessionKey(): SessionKeyInfo {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const info: SessionKeyInfo = {
    privateKey: pk,
    address: account.address,
    expiresAt,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info));
  }

  return info;
}

/**
 * Retrieves the local session key from localStorage if it exists and has not expired.
 */
export function getLocalSessionKey(): SessionKeyInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const info: SessionKeyInfo = JSON.parse(raw);
    if (new Date(info.expiresAt).getTime() < Date.now()) {
      // Expired! Clean up.
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
    return info;
  } catch {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return null;
  }
}

/**
 * Saves a decrypted session key info object into local storage.
 */
export function saveLocalSessionKey(info: SessionKeyInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info));
}

/**
 * Clears the local session key.
 */
export function clearLocalSessionKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Derives a deterministic ephemeral session private key mathematically from a master signature.
 * This guarantees the exact same key is recreated on any device using the same account.
 */
export function deriveDeterministicSessionKey(signature: string): SessionKeyInfo {
  const seed = keccak256(stringToBytes(`Proov Session Private Key Seed v1:${signature}`));
  const account = privateKeyToAccount(seed);
  // Using a 30-day session key window for derived social logins
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    privateKey: seed,
    address: account.address,
    expiresAt,
  };
}
