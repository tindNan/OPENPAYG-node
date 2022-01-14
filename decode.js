const {
  COUNTER_SYNC_VALUE,
  MAX_TOKEN_JUMP,
  MAX_TOKEN_JUMP_COUNTER_SYNC,
  MAX_UNUSED_OLDER_TOKENS,
  TOKEN_TYPE_ADD_TIME,
  TOKEN_TYPE_SET_TIME,
} = require('./constants');

const generateNextToken = require('./generateNextToken');
const { decodeBase, getTokenBase, putBaseInToken } = require('./utils');

module.exports = function decode(token, startingCode, key, lastCount, usedCounts) {
  token = Number(token) // token should be a number, sometimes might be passed as string

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

function countIsValid(count, lastCount, value, type, usedCounts = null) {
  if (value == COUNTER_SYNC_VALUE) {
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
