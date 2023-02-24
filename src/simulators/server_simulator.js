const {
  MAX_ACTIVATION_VALUE,
  TOKEN_TYPE_ADD_TIME,
  TOKEN_TYPE_SET_TIME,
  PAYG_DISABLE_VALUE
} = require('../utils/constants');
const { encode } = require('../encode');

module.exports = class ServerSimulator {
  constructor (startingCode, key, startingCount = 1, restrictedDigitSet = false, timeDivider = 1) {
    this.startingCode = startingCode;
    this.key = key;
    this.count = startingCount;
    this.restrictedDigitSet = restrictedDigitSet;
    this.timeDivider = timeDivider;

    this.expirationDate = Date.now();
    this.furthestExpirationDate = Date.now();
    this.paygEnabled = true;
  }

  printStatus () {
    console.log(`
    Expiration Date: ${this.expirationDate}
    Current count: ${this.count}
    PAYG Enabled: ${this.paygEnabled}
    `);
  }

  generatePaygDisableToken () {
    const { finalToken } = encode(
      this.startingCode,
      this.key,
      PAYG_DISABLE_VALUE,
      this.count,
      TOKEN_TYPE_SET_TIME,
      this.restrictedDigitSet
    );

    return this.formatToken(finalToken);
  }

  generateCounterSyncToken () {
    const { token } = { count: 1, token: 2 };
    /** TODO
     * count, token = OPAYGOEncoder.generate_standard_token(
     *   starting_code=self.starting_code,
     *   key=self.key,
     *   value=OPAYGOShared.COUNTER_SYNC_VALUE,
     *   count=self.count,
     *    restricted_digit_set=self.restricted_digit_set
     * )
     */
    return this.formatToken(token);
  }

  generateTokenFromDate (newExpirationDate, force = false) {
    const furthestExpirationDate = this.furthestExpirationDate;

    if (newExpirationDate > this.furthestExpirationDate) {
      this.furthestExpirationDate = newExpirationDate;
    }

    if (newExpirationDate > furthestExpirationDate) {
      // if the date is strictly above the furthest date activated, use ADD
      const value = this.getValueToActivate(newExpirationDate, this.expirationDate, force);
      this.expirationDate = newExpirationDate;
      return this.generateTokenFromValue(value, TOKEN_TYPE_ADD_TIME);
    }

    // if the date is below or equal to the furthest date activated, use SET
    const value = this.getValueToActivate(newExpirationDate, Date.now(), force);
    console.log('Value to activate', value);
    this.expirationDate = newExpirationDate;
    return this.generateTokenFromValue(value, TOKEN_TYPE_SET_TIME);
  }

  generateTokenFromValue (value, mode) {
    const { finalToken, newCount } = encode(
      this.startingCode,
      this.key,
      value,
      this.count,
      mode,
      this.restrictedDigitSet
    );

    this.count = newCount;
    return this.formatToken(finalToken);
  }

  generateExtendedValueToken (value) {
    // TODO: implement this

  }

  getValueToActivate (newTime, referenceTime, forceMaximum = false) {
    if (newTime <= referenceTime) {
      return 0;
    }

    const days = Math.ceil((newTime - referenceTime) / (1000 * 3600 * 24));
    const value = days * this.timeDivider;

    if (value > MAX_ACTIVATION_VALUE) {
      if (forceMaximum) {
        return MAX_ACTIVATION_VALUE;
      }

      throw new Error('TOO_MANY_DAYS_TO_ACTIVATE');
    }

    return value; // TODO: possible shift left opportunity here
  }

  formatToken (token) {
    if (token.length < 9) {
      return token.padStart(9 - token.length);
    }
    return token;
  }
};
