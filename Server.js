const { encode, encodeExtended } = require("./src/encode");
const { convertTo4DigitToken } = require("./src/utils");

const {
  KEY,
  MAX_ACTIVATION_VALUE,
  EXTENDED_MAX_ACTIVATION_VALUE,
  PAYG_DISABLE_VALUE,
  COUNTER_SYNC_VALUE,
  TOKEN_TYPE_ADD_TIME,
  STARTING_CODE,
  STARTING_COUNT,
} = require("./src/constants");

module.exports = class Server {
  /**
   * @param {number} startingCode - starting code for the meter, defaults to 123456789
   * @param {Uint32Array|number[]} key - siphash key (4 x uint32)
   * @param {number} startingCount - starting count for the # of tokens
   * @param {number} timeDivider - time divider (check OPENPAYG documentation)
   * @param {boolean} restrictedDigitSet - emit tokens using only digits 1-4 (15/20 digits long)
   * @param {function} logger - optional log sink (e.g. console.log), silent by default
   */
  constructor(
    startingCode = STARTING_CODE,
    key = KEY,
    startingCount = STARTING_COUNT,
    timeDivider = 1,
    restrictedDigitSet = false,
    logger = () => {},
  ) {
    this.logger = logger;
    this.startingCode = startingCode;
    this.key = key;
    this.count = startingCount;
    this.timeDivider = timeDivider;
    this.restrictedDigitSet = restrictedDigitSet;
  }

  /**
   * @param {number} value - number of days to encode (0-995), or 998 to disable PAYG,
   *   or 999 for counter synchronisation. 996 and 997 are reserved by the spec.
   *   If timeDivider is > 1 then refer to OPENPAYG documentation
   * @param {(TOKEN_TYPE_ADD_TIME|TOKEN_TYPE_SET_TIME)} [mode=TOKEN_TYPE_ADD_TIME] - if token is add time or set time
   *
   * @return {string} the 9 digit token (15 digits in restricted digit set mode)
   */
  generateTokenForValue(value, mode = TOKEN_TYPE_ADD_TIME) {
    if (
      !Number.isInteger(value) ||
      (value > MAX_ACTIVATION_VALUE &&
        value !== PAYG_DISABLE_VALUE &&
        value !== COUNTER_SYNC_VALUE) ||
      value < 0
    ) {
      throw Error(
        `INVALID VALUE: must be 0-${MAX_ACTIVATION_VALUE}, ${PAYG_DISABLE_VALUE} or ${COUNTER_SYNC_VALUE}`,
      );
    }

    const printMode = mode === TOKEN_TYPE_ADD_TIME ? "ADD_TIME" : "SET_TIME";
    this.logger(
      `starting code: ${this.startingCode}, value: ${value}, token_count: ${this.count}, mode: ${printMode}`,
    );

    const { finalToken, newCount } = encode(this.key, this.startingCode, value, this.count, mode);
    this.count = newCount;

    return this.restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 30) : finalToken;
  }

  /**
   * @param {number} value - value to encode (0-999999), extended tokens carry
   *   device-specific data and have no add/set time modes
   *
   * @return {string} the 12 digit token (20 digits in restricted digit set mode)
   */
  generateExtendedTokenForValue(value) {
    if (!Number.isInteger(value) || value < 0 || value > EXTENDED_MAX_ACTIVATION_VALUE) {
      throw Error(`INVALID VALUE: must be 0-${EXTENDED_MAX_ACTIVATION_VALUE}`);
    }

    this.logger(`starting code: ${this.startingCode}, value: ${value}, token_count: ${this.count}`);

    const { finalToken, newCount } = encodeExtended(this.key, this.startingCode, value, this.count);
    this.count = newCount;

    return this.restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 40) : finalToken;
  }
};
