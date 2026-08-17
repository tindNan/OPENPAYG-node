import {
  MAX_BASE,
  MAX_EXTENDED_BASE,
  TOKEN_VALUE_OFFSET,
  EXTENDED_TOKEN_VALUE_OFFSET,
} from "./constants.ts";

export function convertTo30Bits(h: number): number {
  const mask = ((1 << (32 - 2 + 1)) - 1) << 2;
  const temp = (h & mask) >>> 2; // watched out for signed/unsinged ops

  return temp > 999999999 ? temp - 73741825 : temp;
}

// since we are dealing with > 32 bit integers, the operations here should be done using bigints
export function convertTo40Bits(h: bigint): number {
  const mask = ((1n << (64n - 24n + 1n)) - 1n) << 24n;
  const temp = Number((h & mask) >> 24n); // can safely cast at this point back to normal number

  return temp > 999999999999 ? temp - 99511627777 : temp;
}

export function encodeBase(base: number, number: number): number {
  const encoded = number + base;
  return encoded > 999 ? encoded - 1000 : encoded;
}

export function encodeExtendedBase(base: number, number: number): number {
  const encoded = number + base;
  return encoded > 999999 ? encoded - 1000000 : encoded;
}

export function getTokenBase(token: number): number {
  return token % TOKEN_VALUE_OFFSET;
}

export function getExtendedTokenBase(token: number): number {
  return token % EXTENDED_TOKEN_VALUE_OFFSET;
}

export function putBaseInExtendedToken(token: number, tokenBase: number): number {
  if (tokenBase > MAX_EXTENDED_BASE) {
    throw Error("INVALID TOKEN BASE");
  }

  return token - getExtendedTokenBase(token) + tokenBase;
}

export function putBaseInToken(token: number, tokenBase: number): number {
  if (tokenBase > MAX_BASE) {
    throw Error("INVALID TOKEN BASE");
  }

  return token - getTokenBase(token) + tokenBase;
}

export function decodeBase(startingCodeBase: number, tokenBase: number): number {
  const decodedValue = tokenBase - startingCodeBase;

  return decodedValue < 0 ? decodedValue + 1000 : decodedValue;
}

export function decodeExtendedBase(startingCodeBase: number, tokenBase: number): number {
  const decodedValue = tokenBase - startingCodeBase;

  return decodedValue < 0 ? decodedValue + 1000000 : decodedValue;
}

// restricted digit set mode: represent the token 2 bits at a time,
// each pair becoming a digit between 1 and 4 (30 bits -> 15 digits, 40 bits -> 20 digits)
export function convertTo4DigitToken(token: number, bits: number): string {
  const source = BigInt(token);
  let restricted = "";

  for (let i = bits - 2; i >= 0; i -= 2) {
    const pair = Number((source >> BigInt(i)) & 0b11n);
    restricted += String(pair + 1);
  }

  return restricted;
}

export function convertFrom4DigitToken(token: string | number): number {
  let result = 0n;

  for (const digit of String(token)) {
    result = (result << 2n) | BigInt(Number(digit) - 1);
  }

  return Number(result);
}

/**
 * Converts a 16 byte (32 hex character) secret key, as distributed in the
 * OpenPAYGO device CSV sheets, into the siphash key format (4 x little-endian uint32)
 *
 * @param hex - e.g. 'a29ab82edc5fbbc41ec9530f6dac86b1'
 */
export function keyFromHex(hex: string): Uint32Array {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw Error("INVALID KEY: expected 32 hex characters (16 bytes)");
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const key = new Uint32Array(4);

  for (let i = 0; i < 4; i++) {
    key[i] = view.getUint32(i * 4, true); // little-endian per siphash-js
  }

  return key;
}
