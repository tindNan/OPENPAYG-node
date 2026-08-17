const {
  MAX_BASE,
  MAX_EXTENDED_BASE,
  TOKEN_VALUE_OFFSET,
  EXTENDED_TOKEN_VALUE_OFFSET,
} = require("./constants");

function convertTo30Bits(h) {
  const mask = ((1 << (32 - 2 + 1)) - 1) << 2;
  const temp = (h & mask) >>> 2; // watched out for signed/unsinged ops

  return temp > 999999999 ? temp - 73741825 : temp;
}

// since we are dealing with > 32 bit integers, the operations here should be done using bigints
function convertTo40Bits(h) {
  const mask = ((1n << (64n - 24n + 1n)) - 1n) << 24n;
  const temp = Number((h & mask) >> 24n); // can safely cast at this point back to normal number

  return temp > 999999999999 ? temp - 99511627777 : temp;
}

function encodeBase(base, number) {
  const encoded = number + base;
  return encoded > 999 ? encoded - 1000 : encoded;
}

function encodeExtendedBase(base, number) {
  const encoded = number + base;
  return encoded > 999999 ? encoded - 1000000 : encoded;
}

function getTokenBase(token) {
  return Number(token) % TOKEN_VALUE_OFFSET;
}

function getExtendedTokenBase(token) {
  return Number(token) % EXTENDED_TOKEN_VALUE_OFFSET;
}

function putBaseInExtendedToken(token, tokenBase) {
  if (tokenBase > MAX_EXTENDED_BASE) {
    throw Error("INVALID TOKEN BASE");
  }

  return token - getExtendedTokenBase(token) + tokenBase;
}

function putBaseInToken(token, tokenBase) {
  if (tokenBase > MAX_BASE) {
    throw Error("INVALID TOKEN BASE");
  }

  return token - getTokenBase(token) + tokenBase;
}

function decodeBase(startingCodeBase, tokenBase) {
  const decodedValue = tokenBase - startingCodeBase;

  return decodedValue < 0 ? decodedValue + 1000 : decodedValue;
}

function decodeExtendedBase(startingCodeBase, tokenBase) {
  const decodedValue = tokenBase - startingCodeBase;

  return decodedValue < 0 ? decodedValue + 1000000 : decodedValue;
}

// restricted digit set mode: represent the token 2 bits at a time,
// each pair becoming a digit between 1 and 4 (30 bits -> 15 digits, 40 bits -> 20 digits)
function convertTo4DigitToken(token, bits) {
  const source = BigInt(token);
  let restricted = "";

  for (let i = bits - 2; i >= 0; i -= 2) {
    const pair = Number((source >> BigInt(i)) & 0b11n);
    restricted += String(pair + 1);
  }

  return restricted;
}

function convertFrom4DigitToken(token) {
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
 * @param {string} hex - e.g. 'a29ab82edc5fbbc41ec9530f6dac86b1'
 * @return {Uint32Array} siphash key
 */
function keyFromHex(hex) {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw Error("INVALID KEY: expected 32 hex characters (16 bytes)");
  }

  const bytes = Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16));
  const view = new DataView(bytes.buffer);
  const key = new Uint32Array(4);

  for (let i = 0; i < 4; i++) {
    key[i] = view.getUint32(i * 4, true); // little-endian per siphash-js
  }

  return key;
}

module.exports = {
  convertTo30Bits,
  convertTo40Bits,
  keyFromHex,
  convertTo4DigitToken,
  convertFrom4DigitToken,
  decodeBase,
  decodeExtendedBase,
  encodeBase,
  encodeExtendedBase,
  getTokenBase,
  getExtendedTokenBase,
  putBaseInToken,
  putBaseInExtendedToken,
};
