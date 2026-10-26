import nacl from 'tweetnacl';

export const VIDLINK_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

/**
 * Converts a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encodes Uint8Array to URL-safe base64 string without padding
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes URL-safe base64 string to Uint8Array
 */
export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a media ID for VidLink API using XSalsa20-Poly1305.
 * Matches PyNaCl SecretBox behavior.
 */
export function encryptVidlinkToken(
  mediaId: string,
  keyHex: string = VIDLINK_KEY_HEX,
  offsetSeconds: number = 480
): string {
  const key = hexToBytes(keyHex);
  const nonce = new Uint8Array(24); // 24-byte zero nonce as used by VidLink

  const timestamp = Math.floor(Date.now() / 1000) + offsetSeconds;
  const encoder = new TextEncoder();
  const mediaIdBytes = encoder.encode(mediaId);

  // 8-byte big-endian unsigned integer (>Q)
  const tsBuffer = new ArrayBuffer(8);
  const tsView = new DataView(tsBuffer);
  tsView.setBigUint64(0, BigInt(timestamp), false); // false = big-endian
  const tsBytes = new Uint8Array(tsBuffer);

  // Concatenate mediaId + timestamp
  const message = new Uint8Array(mediaIdBytes.length + 8);
  message.set(mediaIdBytes, 0);
  message.set(tsBytes, mediaIdBytes.length);

  // tweetnacl secretbox encrypts message with key and nonce
  const encrypted = nacl.secretbox(message, nonce, key);

  // Full payload = nonce + encrypted ciphertext
  const payload = new Uint8Array(nonce.length + encrypted.length);
  payload.set(nonce, 0);
  payload.set(encrypted, nonce.length);

  return base64UrlEncode(payload);
}

/**
 * Decrypts a VidLink token and returns mediaId & timestamp.
 */
export function decryptVidlinkToken(
  token: string,
  keyHex: string = VIDLINK_KEY_HEX
): { mediaId: string; timestamp: number } | null {
  try {
    const key = hexToBytes(keyHex);
    const payload = base64UrlDecode(token);

    if (payload.length < 24 + 16 + 8) {
      return null;
    }

    const nonce = payload.subarray(0, 24);
    const ciphertext = payload.subarray(24);

    const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
    if (!decrypted || decrypted.length < 8) {
      return null;
    }

    const mediaIdBytes = decrypted.subarray(0, decrypted.length - 8);
    const tsBytes = decrypted.subarray(decrypted.length - 8);

    const decoder = new TextDecoder();
    const mediaId = decoder.decode(mediaIdBytes);

    const tsView = new DataView(tsBytes.buffer, tsBytes.byteOffset, 8);
    const timestamp = Number(tsView.getBigUint64(0, false));

    return { mediaId, timestamp };
  } catch {
    return null;
  }
}
