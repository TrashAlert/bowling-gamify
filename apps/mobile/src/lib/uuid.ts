import { getRandomBytes } from 'expo-crypto';

/**
 * A UUIDv7: 48 bits of Unix milliseconds, then random bits. IDs sort by
 * creation time, which keeps the server's indexes tidy when sessions sync.
 */
export function uuidv7(now: number = Date.now(), random: Uint8Array = getRandomBytes(10)): string {
  const bytes = new Uint8Array(16);
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes.set(random.subarray(0, 10), 6);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
