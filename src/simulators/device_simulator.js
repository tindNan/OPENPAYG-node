const { decode } = require('../decode');
const {
  COUNTER_SYNC_VALUE,
  TOKEN_TYPE_SET_TIME,
  PAYG_DISABLE_VALUE,
  MAX_ACTIVATION_VALUE
} = require('../utils/constants');

module.exports = class DeviceSimulator {
  constructor (startingCode, key, startingCount = 1, restrictedDigitSet = false, waitingPeriodEnabled = true, timeDivider = 1) {
    this.startingCode = startingCode;
    this.key = key;
    this.timeDivider = timeDivider;
    this.restrictedDigitSet = restrictedDigitSet;
    this.waitingPeriodEnabled = waitingPeriodEnabled;

    this.paygEnabled = true;
    this.count = startingCount;
    this.expirationDate = Date.now();
    this.invalidTokenCount = 0;
    this.tokenEntryBlockedUntil = Date.now();
    this.usedCounts = [];
  }

  printStatus () {
    console.log(`
      =========================
      Expiration Date: ${this.expirationDate}
      Current count: ${this.currentCount}
      PAYG enabled: ${this.paygEnabled}
      Active: ${this.isActive()}
    `);
  }

  isActive () {
    return this.expirationDate > Date.now();
  }

  enterToken (token, showResults = true) {
    if (token.length === 9) {
      console.log('9 digit token');
      return this.updateDeviceStatusFromToken(token, showResults);
    }

    return this.updateDeviceStatusFromExtendedToken(token, showResults);
  }

  getDaysRemaining () {
    if (this.paygEnabled) {
      const millisecondsDifference = this.expirationDate - Date.now();
      return Math.ceil(millisecondsDifference / (1000 * 3600 * 24)); // convert milliseconds to days;
    }
    return 'infinite';
  }

  updateDeviceStatusFromToken (token, showResults = true) {
    if (this.tokenEntryBlockedUntil > Date.now() && this.waitingPeriodEnabled) {
      if (showResults) {
        console.log('TOKEN_ENTRY_BLOCKED');
      }
      return false;
    }
    console.log('about to decode');
    const { value: tokenValue, count: tokenCount, type: tokenType } = decode(
      token,
      this.startingCode,
      this.key,
      this.count,
      this.restrictedDigitSet,
      this.usedCounts
    );

    console.log('token value: ', tokenValue);
    if (tokenValue === null) {
      console.log('INVALID TOKEN DETECTED');
      if (showResults) {
        console.log('TOKEN_INVALID');
      }

      this.invalidTokenCount++;
      const milliSecondsToAdd = Math.pow(2, this.invalidTokenCount) * 60 * 1000;
      this.tokenEntryBlockedUntil += milliSecondsToAdd;
      return -1;
    }

    if (tokenValue === -2) {
      if (showResults) {
        console.log('OLD TOKEN');
      }
      return -2;
    }

    if (showResults) {
      console.log(`TOKEN VALID | Value: ${tokenValue}`);
    }

    if (tokenCount > this.count || tokenValue === COUNTER_SYNC_VALUE) {
      this.count = tokenCount;
    }

    this.usedCounts = 1; // TODO: replace with updated_used_counts
    this.invalidTokenCount = 0;
    this.updateDeviceStatusFromTokenValue(tokenValue, tokenType);
    return 1;
  }

  updateDeviceStatusFromExtendedToken (token, showResults = false) {
    if (this.tokenEntryBlockedUntil > Date.now() || this.waitingPeriodEnabled) {
      if (showResults) {
        console.log('TOKEN_ENTRY_BLOCKED');
      }
      return false;
    }
    // TODO: implement use case for update device status from extended token
    const { tokenValue, tokenCount } = { tokenValue: 1, tokenCount: 2 };

    if (tokenValue === null || tokenValue === undefined) {
      if (showResults) {
        console.log('TOKEN_INVALID');
      }

      this.invalidTokenCount++;
      const milliSecondsToAdd = Math.pow(2, this.invalidTokenCount) * 60 * 1000;
      this.tokenEntryBlockedUntil += milliSecondsToAdd;
      return -1;
    }

    if (tokenValue === -2) {
      if (showResults) {
        console.log('OLD TOKEN');
      }
      return -2;
    }

    if (showResults) {
      console.log(`TOKEN VALID | Value: ${tokenValue}`);
    }

    if (tokenCount > this.count || tokenValue === COUNTER_SYNC_VALUE) {
      this.count = tokenCount;
    }

    this.usedCounts = 1; // TODO: replace with updated_used_counts
    this.invalidTokenCount = 0;
    this.updateDeviceStatusFromTokenValue(tokenValue); // TODO: what's tokentype here, needs to match python impl?
    return 1;
  }

  updateDeviceStatusFromTokenValue (tokenValue, tokenType) {
    if (tokenValue <= MAX_ACTIVATION_VALUE) {
      this.paygEnabled = !this.paygEnabled && tokenType === TOKEN_TYPE_SET_TIME;
      if (this.paygEnabled) {
        this.updateExpirationDateFromValue(tokenValue, tokenType);
      }
    } else if (tokenValue === PAYG_DISABLE_VALUE) {
      this.paygEnabled = false;
    } else if (tokenValue !== COUNTER_SYNC_VALUE) {
      // We do nothing if its the sync counter value, the counter has been synced already
      console.log('COUNTER_SYNCED');
    } else {
      // If it's another value we also do nothing, as they are not defined
      console.log('UNKNOWN_COMMAND');
    }
  }

  updateExpirationDateFromValue (tokenValue, tokenType) {
    const numDays = tokenValue / this.timeDivider;
    console.log('NUM DAYS VALUE: ', numDays);
    const numDaysMilliseconds = numDays * 24 * 60 * 60 * 1000;
    if (tokenType === TOKEN_TYPE_SET_TIME) {
      this.expirationDate = Date.now() + numDaysMilliseconds;
    } else {
      if (this.expirationDate < Date.now()) {
        this.expiration_date = Date.now();
      }
      this.expirationDate += numDaysMilliseconds;
    }
  }
};
