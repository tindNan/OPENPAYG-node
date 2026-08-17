const Server = require("./src/Server");
const Meter = require("./src/Meter");
const constants = require("./src/constants");
const siphash = require("siphash");

const { encode, encodeExtended } = require("./src/encode");
const { decode, decodeExtended } = require("./src/decode");
const { keyFromHex, convertTo4DigitToken, convertFrom4DigitToken } = require("./src/utils");

const {
  MAX_ACTIVATION_VALUE,
  EXTENDED_MAX_ACTIVATION_VALUE,
  PAYG_DISABLE_VALUE,
  COUNTER_SYNC_VALUE,
  TOKEN_TYPE_ADD_TIME,
} = constants;

function assertStandardValue(value) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    (value > MAX_ACTIVATION_VALUE && value !== PAYG_DISABLE_VALUE && value !== COUNTER_SYNC_VALUE)
  ) {
    throw Error(
      `INVALID VALUE: must be 0-${MAX_ACTIVATION_VALUE}, ${PAYG_DISABLE_VALUE} or ${COUNTER_SYNC_VALUE}`,
    );
  }
}

/**
 * Generates a standard 9 digit OpenPAYGO token
 *
 * @param {object} options
 * @param {Uint32Array|number[]} options.key - siphash key, see keyFromHex
 * @param {number} options.startingCode - the device's 9 digit starting code
 * @param {number} options.value - days of activation (0-995), 998 disables PAYG, 999 syncs the counter
 * @param {number} options.count - the current token count kept by the server
 * @param {number} [options.mode=TOKEN_TYPE_ADD_TIME] - TOKEN_TYPE_ADD_TIME or TOKEN_TYPE_SET_TIME
 * @param {boolean} [options.restrictedDigitSet=false] - emit a 15 digit token using only digits 1-4
 * @return {{ token: string, newCount: number }} the token and the count to persist
 */
function generateToken({
  key,
  startingCode,
  value,
  count,
  mode = TOKEN_TYPE_ADD_TIME,
  restrictedDigitSet = false,
}) {
  assertStandardValue(value);
  const { finalToken, newCount } = encode(key, startingCode, value, count, mode);

  return {
    token: restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 30) : finalToken,
    newCount,
  };
}

/**
 * Decodes a standard 9 digit OpenPAYGO token on the device side
 *
 * @param {object} options
 * @param {string|number} options.token - the entered token
 * @param {Uint32Array|number[]} options.key - siphash key, see keyFromHex
 * @param {number} options.startingCode - the device's 9 digit starting code
 * @param {number} options.lastCount - the device's last known token count
 * @param {number[]} [options.usedCounts=[]] - counts already used (for out-of-order add-time tokens)
 * @param {boolean} [options.restrictedDigitSet=false] - token was entered using only digits 1-4
 * @return {{ value: number|null, count: number|null, type: number|null }}
 *   value is the decoded activation value, -2 for an already used token, null if invalid
 */
function decodeToken({
  token,
  key,
  startingCode,
  lastCount,
  usedCounts = [],
  restrictedDigitSet = false,
}) {
  if (restrictedDigitSet) {
    token = convertFrom4DigitToken(token);
  }

  return decode(token, startingCode, key, lastCount, usedCounts);
}

/**
 * Generates an extended 12 digit OpenPAYGO token (device-specific data, no add/set time modes)
 *
 * @param {object} options
 * @param {Uint32Array|number[]} options.key - siphash key, see keyFromHex
 * @param {number} options.startingCode - the device's 12 digit starting code
 * @param {number} options.value - value to encode (0-999999)
 * @param {number} options.count - the current token count kept by the server
 * @param {boolean} [options.restrictedDigitSet=false] - emit a 20 digit token using only digits 1-4
 * @return {{ token: string, newCount: number }} the token and the count to persist
 */
function generateExtendedToken({ key, startingCode, value, count, restrictedDigitSet = false }) {
  if (!Number.isInteger(value) || value < 0 || value > EXTENDED_MAX_ACTIVATION_VALUE) {
    throw Error(`INVALID VALUE: must be 0-${EXTENDED_MAX_ACTIVATION_VALUE}`);
  }

  const { finalToken, newCount } = encodeExtended(key, startingCode, value, count);

  return {
    token: restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 40) : finalToken,
    newCount,
  };
}

/**
 * Decodes an extended 12 digit OpenPAYGO token on the device side
 *
 * @param {object} options
 * @param {string|number} options.token - the entered token
 * @param {Uint32Array|number[]} options.key - siphash key, see keyFromHex
 * @param {number} options.startingCode - the device's 12 digit starting code
 * @param {number} options.lastCount - the device's last known token count
 * @param {boolean} [options.restrictedDigitSet=false] - token was entered using only digits 1-4
 * @return {{ value: number|null, count: number|null }} value is null if the token is invalid or already used
 */
function decodeExtendedToken({ token, key, startingCode, lastCount, restrictedDigitSet = false }) {
  if (restrictedDigitSet) {
    token = convertFrom4DigitToken(token);
  }

  return decodeExtended(token, startingCode, key, lastCount);
}

module.exports = {
  // high-level stateful classes
  Server,
  Meter,

  // low-level spec contract primitives
  generateToken,
  generateExtendedToken,
  decodeToken,
  decodeExtendedToken,

  // key helpers
  keyFromHex,
  keyFromString16: siphash.string16_to_key,

  // spec constants
  constants,
};
