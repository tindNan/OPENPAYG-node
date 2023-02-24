const { TOKEN_TYPE_SET_TIME } = require('./utils/constants');
const { encodeBase, getTokenBase, putBaseInToken, getExtendedTokenBase, encodeExtendedBase, putBaseInExtendedToken } = require('./utils/utils');
const { generateNextToken, generateNextExtendedToken } = require('./utils/generateNextToken');

function encode (startingCode, key, value, count, mode = TOKEN_TYPE_SET_TIME, restrictedDigitSet = false) {
  const startingCodeBase = getTokenBase(startingCode);
  const tokenBase = encodeBase(startingCodeBase, value);
  let currentToken = putBaseInToken(startingCode, tokenBase);

  const newCount = getNextCount(count, mode);

  for (let xn = 0; xn < newCount; xn++) {
    currentToken = generateNextToken(currentToken, key);
  }

  // ensure that final token has 9 digits.
  // the implementation can consider 15 digit tokens but that won't be necessary here
  const finalToken = putBaseInToken(currentToken, tokenBase).toString();

  if (!restrictedDigitSet) {
    return { newCount, finalToken: finalToken.padStart(9, '0') };
  } else {
    // TODO: implement logic for restricted digit set
  }

  return { newCount, finalToken };
}

function encodeExtended (key, startingCode, value, count, mode) {
  const startingCodeBase = getExtendedTokenBase(startingCode);
  const tokenBase = encodeExtendedBase(startingCodeBase, value);
  let currentToken = putBaseInExtendedToken(startingCode, tokenBase);

  const newCount = getNextCount(count, mode);

  for (let xn = 0; xn < newCount; xn++) {
    currentToken = generateNextExtendedToken(currentToken, key);
  }

  const finalToken = putBaseInExtendedToken(currentToken, tokenBase)
    .toString()
    .padStart(12, '0');

  return { newCount, finalToken };
}

function getNextCount (count, mode) {
  const currentCountOdd = count % 2;

  if (mode === TOKEN_TYPE_SET_TIME) {
    return currentCountOdd ? count + 2 : count + 1;
  }

  return currentCountOdd ? count + 1 : count + 2;
}

module.exports = { encode, encodeExtended };
