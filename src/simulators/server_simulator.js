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
    const { token } = { count: 1, token: 2 };
    /** TODO
     * count, token = OPAYGOEncoder.generate_standard_token( 24             starting_code=self.starting_code, 25             key=self.key,
     *    value=OPAYGOShared.PAYG_DISABLE_VALUE,
     *    count=self.count,
     *    restricted_digit_set=self.restricted_digit_set
     *  )
     */

    return this.formatToken(token); // TODO: convert to static method
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
      return this.generateTokenFromValue(value, 1 /* TODO: use OPAYGOShared.TOKEN_TYPE_ADD_TIME */);
    }

    // if the date is below or equal to the furthes date activated, use SET
    const value = this.getValueToActivate(newExpirationDate, Date.now(), force);
    this.expirationDate = newExpirationDate;
    return this.generateTokenFromValue(value, 1 /* TODO; use OPAYGOShared.TOKEN_TYPE_SET_TIME */);
  }

  generateTokenFromValue (value, mode) {
    const { token } = { count: 1, token: 2 };
    /**
     * TODO:
     * count, token = OPAYGOEncoder.generate_standard_token(
     *   starting_code=self.starting_code,
     *   key=self.key,
     *   value=value,
     *   count=self.count,
     *   mode=mode,
     *   restricted_digit_set=self.restricted_digit_set
     * )
     */

    return this.formatToken(token);
  }

  generateExtendedValueToken (value) {
    // TODO: implement this

  }

  getValueToActivate (newTime, referenceTime, forceMaximum = false) {
    if (newTime <= referenceTime) {
      return 0;
    }

    const days = Math.ceil((newTime - referenceTime) / (1000 * 3600 * 24));
    const value = Math.round(days * this.timeDivider);

    if (value > 2 /* TODO relace with OPAYGOShared.MAX_ACTIVATION_VALUE */) {
      if (forceMaximum) {
        return 2; // TODO: replace OPAYGOShared.MAX_ACTIVATION_VALUE
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
