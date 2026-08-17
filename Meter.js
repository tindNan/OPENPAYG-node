const {
  STARTING_CODE,
  STARTING_COUNT,
  KEY,
  COUNTER_SYNC_VALUE,
  MAX_UNUSED_OLDER_TOKENS,
  TOKEN_TYPE_ADD_TIME,
  PAYG_DISABLE_VALUE,
  MAX_ACTIVATION_VALUE,
  TOKEN_TYPE_SET_TIME,
  TIME_DIVIDER
} = require('./src/constants');

const { decode } = require('./src/decode');
const { convertFrom4DigitToken } = require('./src/utils');

// waiting period after invalid tokens: 1 minute doubling up to 512 minutes (~8h)
const WAITING_PERIOD_BASE_MINUTES = 1;
const WAITING_PERIOD_MAX_MINUTES = 512;

module.exports = class Meter {
  constructor (
    startingCode = STARTING_CODE,
    key = KEY,
    startingCount = STARTING_COUNT,
    timeDivider = TIME_DIVIDER,
    waitingPeriodEnabled = true,
    restrictedDigitSet = false
  ) {
    this.startingCode = startingCode;
    this.key = key;
    this.timeDivider = timeDivider;
    this.paygEnabled = true;
    this.invalidTokenCount = 0;
    this.usedCounts = [];
    this.count = startingCount;
    this.waitingPeriodEnabled = waitingPeriodEnabled;
    this.restrictedDigitSet = restrictedDigitSet;
    this.tokenEntryLockedUntil = 0; // UNIX ms until which token entry is refused
    this.expirationDate = Date.now(); // use UNIX milliseconds
  }

  enterToken (token) {
    if (this.#isLocked()) {
      const minutesLeft = Math.ceil((this.tokenEntryLockedUntil - Date.now()) / 60000);
      console.log(`TOKEN ENTRY LOCKED, TRY AGAIN IN ${minutesLeft} MINUTE(S)`);
      return { value: null, count: null, type: null };
    }

    if (this.restrictedDigitSet) {
      token = convertFrom4DigitToken(token);
    }

    const { value, count, type } = decode(token, this.startingCode, this.key, this.count, this.usedCounts);
    const isValidToken = this.#isValidToken(value);

    if (!isValidToken) {
      return { value, count, type };
    }

    if (count > this.count || value === COUNTER_SYNC_VALUE) {
      this.count = count;
    }

    this.#updateUsedCounts(value, count, type);
    this.invalidTokenCount = 0;
    this.tokenEntryLockedUntil = 0;
    this.#updateMeterStatus(value, type);
    return { value, count, type };
  }

  printStatus () {
    console.log('EXPIRATION DATE: ', new Date(this.expirationDate));
    console.log('CURRENT COUNT: ', this.count);
    console.log('PAYG Enabled: ', this.paygEnabled);
  }

  #isLocked () {
    return this.waitingPeriodEnabled && Date.now() < this.tokenEntryLockedUntil;
  }

  #isValidToken (tokenValue) {
    console.log('processing decoded token');
    // there could be value = 0, so can't use value
    if (tokenValue === null) {
      console.log('TOKEN INVALID');
      this.invalidTokenCount++;
      this.#startWaitingPeriod();
      return false;
    }

    if (tokenValue === -2) {
      console.log('OLD TOKEN');
      return false;
    }

    console.log('VALID TOKEN');
    return true;
  }

  #startWaitingPeriod () {
    if (!this.waitingPeriodEnabled) {
      return;
    }

    const minutes = Math.min(
      WAITING_PERIOD_BASE_MINUTES * 2 ** (this.invalidTokenCount - 1),
      WAITING_PERIOD_MAX_MINUTES
    );
    this.tokenEntryLockedUntil = Date.now() + minutes * 60 * 1000;
  }

  #updateUsedCounts (tokenValue, newCount, tokenType) {
    let highestCount = Math.max(...this.usedCounts, 0);

    if (newCount > highestCount) {
      highestCount = newCount;
    }

    const bottomRange = highestCount - MAX_UNUSED_OLDER_TOKENS;
    const newUsedCounts = [];

    if (tokenType !== TOKEN_TYPE_ADD_TIME || tokenValue === COUNTER_SYNC_VALUE || tokenValue === PAYG_DISABLE_VALUE) {
      // if it is not an add time token, we mark all the past tokens as used in the range
      for (let count = bottomRange; count < highestCount + 1; count++) {
        newUsedCounts.push(count);
      }
    } else {
      for (let count = bottomRange; count < highestCount + 1; count++) {
        if (count === newCount || this.usedCounts.includes(count)) {
          newUsedCounts.push(count);
        }
      }
    }

    this.usedCounts = newUsedCounts;
  }

  #updateMeterStatus (tokenValue, tokenType) {
    if (tokenValue <= MAX_ACTIVATION_VALUE) {
      if (!this.paygEnabled && tokenType === TOKEN_TYPE_SET_TIME) {
        this.paygEnabled = true;
      }
      if (this.paygEnabled) {
        this.#updateMeterExpirationDate(tokenValue, tokenType);
      }
    } else if (tokenValue === PAYG_DISABLE_VALUE) {
      this.paygEnabled = false;
    } else if (tokenValue === COUNTER_SYNC_VALUE) {
      // count was already synced in enterToken
      console.log('METER COUNTER SYNCED');
    } else {
      // values 996 and 997 are reserved for future extensions
      console.log('RESERVED VALUE, NO STATUS CHANGE');
    }
  }

  #updateMeterExpirationDate (tokenValue, tokenType) {
    const now = Date.now();
    const numDays = tokenValue / this.timeDivider;
    const msToAdd = numDays * 24 * 60 * 60 * 1000;

    if (tokenType === TOKEN_TYPE_SET_TIME) {
      this.expirationDate = now + msToAdd;
    } else {
      this.expirationDate = this.expirationDate < now
        ? now + msToAdd
        : this.expirationDate + msToAdd;
    }
  }
};
