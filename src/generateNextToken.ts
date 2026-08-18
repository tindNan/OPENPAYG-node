import siphash from "siphash";
import { convertTo30Bits, convertTo40Bits } from "./utils.ts";
import type { SipHashKey } from "./constants.ts";

export function generateNextToken(currentToken: number, key: SipHashKey): number {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, currentToken, false);
  view.setUint32(4, currentToken, false);

  // the message should be an Uint8Array
  // ref: https://github.com/jedisct1/siphash-js/issues/5#issuecomment-486682407
  const messageBuffer = new Uint8Array(view.buffer);

  const { l: low, h: high } = siphash.hash(key, messageBuffer);

  /*
   * always end bitwise ops in JS with ">>> 0" in order to leave the number unsigned, otherwise
   * you end up with unexpected numbers
   *
   * for more context please brush up on bitwise operations for javascript
   *
   * ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift
   * https://stackoverflow.com/questions/6798111/bitwise-operations-on-32-bit-unsigned-ints
   */
  const res = (high ^ low) >>> 0;
  return convertTo30Bits(res);
}

/**
 * Derives a deterministic 9 digit starting code from the secret key by hashing
 * the 16 raw key bytes with the key itself (current OpenPAYGO ecosystem
 * behaviour, used when a device has no explicitly assigned starting code)
 */
export function generateStartingCode(key: SipHashKey): number {
  // reconstruct the 16 key bytes from the 4 little-endian uint32 words,
  // matching the layout produced by keyFromHex
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) {
    view.setUint32(i * 4, (key[i] ?? 0) >>> 0, true);
  }

  const { l: low, h: high } = siphash.hash(key, bytes);
  const res = (high ^ low) >>> 0;
  return convertTo30Bits(res);
}

export function generateNextExtendedToken(currentToken: number, key: SipHashKey): number {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(currentToken), false);

  const msgBuffer = new Uint8Array(view.buffer);

  const { l: low, h: high } = siphash.hash(key, msgBuffer);
  const fullHash = (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);

  return convertTo40Bits(fullHash);
}
