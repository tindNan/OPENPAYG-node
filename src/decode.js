const {
  COUNTER_SYNC_VALUE,
  EXTENDED_COUNTER_SYNC_VALUE,
  MAX_TOKEN_JUMP,
  MAX_TOKEN_JUMP_COUNTER_SYNC,
  MAX_UNUSED_OLDER_TOKENS,
  TOKEN_TYPE_ADD_TIME,
  TOKEN_TYPE_SET_TIME
} = require('./utils/constants');

const { generateNextToken, generateNextExtendedToken } = require('./utils/generateNextToken');
const { decodeBase, decodeExtendedBase, getTokenBase, putBaseInToken, getExtendedTokenBase, putBaseInExtendedToken } = require('./utils/utils');

function decode (token, startingCode, key, lastCount, restrictedDigitSet = false, usedCounts = null) {
  // TODO: typescript could help here
  token = Number(token); // token should be a number, sometimes might be passed as string

  if (restrictedDigitSet) {
    // ADD LOGIC TO HANDLE RESTRICTED DIGITS
  }

  let validOlderToken = false;

  const tokenBase = getTokenBase(token);
  let currentCode = putBaseInToken(startingCode, tokenBase);
  const startingCodeBase = getTokenBase(startingCode);

  const value = decodeBase(startingCodeBase, tokenBase);

  const maxAttempts = value === COUNTER_SYNC_VALUE
    ? lastCount + MAX_TOKEN_JUMP_COUNTER_SYNC + 1
    : lastCount + MAX_TOKEN_JUMP + 1;

  // the ideal should be the count value of the token + 30
  // assuming this is the first time we are seeing this token
  for (let count = 0; count < maxAttempts; count++) {
    const maskedToken = putBaseInToken(currentCode, tokenBase);

    const type = count % 2
      ? TOKEN_TYPE_SET_TIME
      : TOKEN_TYPE_ADD_TIME;

    if (maskedToken === token) {
      if (countIsValid(count, lastCount, value, type, usedCounts)) {
        return { value, count, type };
      } else {
        validOlderToken = true;
      }
    }

    currentCode = generateNextToken(currentCode, key);
  }

  if (validOlderToken) {
    return { value: -2, count: null, type: null };
  }

  return { value: null, count: null, type: null };
}

function decodeExtended (token, startingCode, key, lastCount, usedCounts) {
  token = Number(token);
  let validOlderToken = false;
  const tokenBase = getExtendedTokenBase(token);
  let currentCode = putBaseInExtendedToken(token, tokenBase);
  const startingCodeBase = getExtendedTokenBase(startingCode);

  // TODO: FIX BROKEN IMPORT
  const value = decodeExtendedBase(startingCodeBase, tokenBase);

  // TODO: define other constants for this
  const maxAttempts = value === EXTENDED_COUNTER_SYNC_VALUE
    ? lastCount + MAX_TOKEN_JUMP_COUNTER_SYNC + 1
    : lastCount + MAX_TOKEN_JUMP + 1;

  for (let count = 0; count < maxAttempts; count++) {
    const maskedToken = putBaseInExtendedToken(currentCode, tokenBase);

    const type = count % 2
      ? TOKEN_TYPE_SET_TIME
      : TOKEN_TYPE_ADD_TIME;

    if (maskedToken === token) {
      // TODO: what's happening with usedCounts
      if (extendedCountIsValid(count, lastCount, value, type, usedCounts)) {
        return { value, count, type };
      } else {
        validOlderToken = true;
      }
    }

    currentCode = generateNextExtendedToken(currentCode, key);
  }

  if (validOlderToken) {
    return { value: -2, count: null, type: null };
  }

  return { value: null, count: null, type: null };
}

function countIsValid (count, lastCount, value, type, usedCounts = null) {
  if (value === COUNTER_SYNC_VALUE) {
    if (count > lastCount - 30) {
      return true;
    }
  } else if (count > lastCount) {
    return true;
  } else if (MAX_UNUSED_OLDER_TOKENS > 0) {
    if (count > (lastCount - MAX_UNUSED_OLDER_TOKENS)) {
      if (!usedCounts?.includes(count) && type === TOKEN_TYPE_ADD_TIME) {
        return true;
      }
    }
  }
  return false;
}

function extendedCountIsValid (count, lastCount, value, type, usedCounts = null) {
  if (value === EXTENDED_COUNTER_SYNC_VALUE) {
    if (count > lastCount - 30) {
      return true;
    }
  } else if (count > lastCount) {
    return true;
  } else if (MAX_UNUSED_OLDER_TOKENS > 0) {
    if (count > (lastCount - MAX_UNUSED_OLDER_TOKENS)) {
      if (!usedCounts?.includes(count) && type === TOKEN_TYPE_ADD_TIME) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  decode,
  decodeExtended
};
