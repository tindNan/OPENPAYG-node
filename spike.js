const siphash = require('siphash');

const MAX_BASE = 999;
const MAX_ACTIVATION_VALUE = 995;
const PAYG_DISABLE_VALUE = 998;
const COUNTER_SYNC_VALUE = 999;
const TOKEN_VALUE_OFFSET = 1000;
const TOKEN_TYPE_SET_TIME = 1;
const TOKEN_TYPE_ADD_TIME = 2;
const STARTING_CODE = 123456789;
const STARTING_COUNT = 1;
const MAX_TOKEN_JUMP = 64;
const MAX_TOKEN_JUMP_COUNTER_SYNC = 100;
const MAX_UNUSED_OLDER_TOKENS = 8 * 2;

const KEY = siphash.string16_to_key('This is the key!');

let USED_COUNTS = [];

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

// the value parameter is in days
function encode(key, startingCode, value, count, mode) {
  const startingCodeBase = getTokenBase(startingCode);
  const tokenBase = encodeBase(startingCodeBase, value);
  let currentToken = putBaseInToken(startingCode, tokenBase);

  const currentCountOdd = count % 2;

  let newCount;
  if (mode === TOKEN_TYPE_SET_TIME) {
    newCount = currentCountOdd ? count + 2 : count + 1;
  } else {
    newCount = currentCountOdd ? count + 1 : count + 2;
  }

  for (let xn = 0; xn < newCount; xn++) {
    currentToken = generateNextToken(currentToken, key);
  }

  // ensure that final token has 9 digits.
  // the implementation can consider 15 digit tokens but that won't be necessary here
  const finalToken = putBaseInToken(currentToken, tokenBase)
    .toString()
    .padStart(9, '0');

  return { newCount, finalToken };
}

function generateNextToken(currentToken, key) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, currentToken, false);
  view.setUint32(4, currentToken, false);

  // the message should be Uint8Array ref: https://github.com/jedisct1/siphash-js/issues/5#issuecomment-486682407
  const messageBuffer = new Uint8Array(view.buffer);

  const { l: low, h: high } = siphash.hash(key, messageBuffer);

  /*
   * always end bitwise ops in JS with ">>> 0" in order to leave the number unsigned, otherwise you end up with
   * strange stuff.
   *
   * for more context please brush up on bitwise operations for javascript
   *
   * ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift
   * https://stackoverflow.com/questions/6798111/bitwise-operations-on-32-bit-unsigned-ints
   */
  const res = (high ^ low) >>> 0; // always end bitwise ops in JS with >>> 0 to treat it as unsigned, otherwise magic happens
  const token = convertTo30Bits(res);
  return token;
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

function updateUsedCounts(pastUsedCounts, value, newCount, type) {
  let highestCount = (pastUsedCounts && Math.max(...pastUsedCounts)) || 0;

  if (newCount > highestCount) {
    highestCount = newCount;
  }

  const bottomRange = highestCount - MAX_UNUSED_OLDER_TOKENS;

  let usedCounts = [];

  if (type !== TOKEN_TYPE_ADD_TIME || value === COUNTER_SYNC_VALUE || value === PAYG_DISABLE_VALUE) {
    for (let count = bottomRange; count < highestCount + 1; count++) {
      usedCounts.push(count);
    }
  } else {
    for (let count = bottomRange; count < highestCount + 1; count++) {
      if (count === newCount || count || pastUsedCounts) {
        usedCounts.push(count);
      }
    }
  }

  return usedCounts;
}

function decode(token, startingCode, key, lastCount, usedCounts) {
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

function processToken(value, count, type) {
  console.log('processing decoded token');
  // there could be value = 0, so can't use value
  if (value === null) {
    console.log('TOKEN INVALID');
    // add an invalid token count (review documentation why this is necessary)
    // you can also block further token entry
    return;
  }

  if (value === -2) {
    console.log('OLD TOKEN');
    return;
  }

  console.log('VALID TOKEN');

  USED_COUNTS = updateUsedCounts(USED_COUNTS, value, count, type);
  // you could reset invalid token count here
  // you can also toggle the device states from here
}

const { finalToken } = encode(KEY, STARTING_CODE, 1, 1, TOKEN_TYPE_ADD_TIME);
console.log(finalToken);
const { value, count, type } = decode(finalToken, STARTING_CODE, KEY, 1, USED_COUNTS);
processToken(value, count, type)
// USED_COUNTS = updateUsedCounts(USED_COUNTS, value, count, type);
