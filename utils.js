const MAX_BASE = 999;
const TOKEN_VALUE_OFFSET = 1000;

function convertTo30Bits(h) {
  const mask = ((1 << (32 - 2 + 1)) - 1) << 2;
  let temp = (h & mask) >>> 2; // watched out for signed/unsinged ops
  if (temp > 999999999) {
      temp = temp - 73741825;
  }
  return temp;
}

function encodeBase(base, number) {
  const encoded = number + base;
  return encoded > 999 ? encoded - 1000 : encoded;
}

function getTokenBase(token) {
  return Number(token) % TOKEN_VALUE_OFFSET;
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
  decodeBase,
  encodeBase,
  getTokenBase,
  putBaseInToken,
}
