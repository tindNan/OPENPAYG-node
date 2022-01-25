const { MAX_BASE, MAX_EXTENDED_BASE, TOKEN_VALUE_OFFSET, EXTENDED_TOKEN_VALUE_OFFSET } = require('./constants');

function convertTo30Bits(h) {
  const mask = ((1 << (32 - 2 + 1)) - 1) << 2;
  const temp = (h & mask) >>> 2; // watched out for signed/unsinged ops

  return temp > 999999999 ? temp - 73741825 : temp;
}

// since we are dealing with > 32 bit integers, the operations here should be done using bigints
function convertTo40Bits(h){      
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
  if(tokenBase > MAX_EXTENDED_BASE) {
    throw Error('INVALID TOKEN BASE');
  }

  return token - getExtendedTokenBase(token) + tokenBase;
}

function putBaseInToken(token, tokenBase) {
  if (tokenBase > MAX_BASE) {
    throw Error('INVALID TOKEN BASE');
  }

  return token - getTokenBase(token) + tokenBase;
}

function decodeBase(startingCodeBase, tokenBase) {
  const decodedValue = tokenBase - startingCodeBase;

  return decodedValue < 0
    ? decodedValue + 1000
    : decodedValue;
}

module.exports = {
  convertTo30Bits,
  convertTo40Bits,
  decodeBase,
  encodeBase,
  encodeExtendedBase,
  getTokenBase,
  getExtendedTokenBase,
  putBaseInToken,
  putBaseInExtendedToken,
}
