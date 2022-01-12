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
} = require('./constants');

const decode = require('./decode');

module.exports = class Meter {
  constructor(
    startingCode = STARTING_CODE,
    key = KEY,
    startingCount = STARTING_COUNT,
    timeDivider,
    waitingPeriodEnabled = true,
  ) {
    this.startingCode = startingCode;
    this.key = key;
    this.timeDivider = timeDivider;
    this.paygEnabled = true;
    this.invalidTokenCount = 0;
    this.usedCounts = [];
    this.count = startingCount;
    this.waitingPeriodEnabled = waitingPeriodEnabled;
    this.expirationDate = Date.now(); // use UNIX milliseconds
  }

  enterToken(token) {
    const { value, count, type } = decode(token, this.startingCode, this.key, this.count, this.usedCounts);
    const isValidToken = this.#isValidToken(value);

    if(!isValidToken) {
      return { value, count, type };
    }

    if (count > this.count || value === COUNTER_SYNC_VALUE) {
      this.count = count;
    }

    this.#updateUsedCounts(value, count, type);
    this.invalidTokenCount = 0;
    this.#updateMeterStatus(value, type);
  }

  printStatus() {
    console.log('EXPIRATION DATE: ', new Date(this.expirationDate));
    console.log('CURRENT COUNT: ', this.count);
    console.log('PAYG Enabled: ', this.paygEnabled);
  }

  #isValidToken(tokenValue) {
    console.log('processing decoded token');                                    
    // there could be value = 0, so can't use value                             
    if (tokenValue === null) {                                                       
      console.log('TOKEN INVALID');                                             
      this.invalidTokenCount ++;
      // add an invalid token count (review documentation why this is necessary)
      // you can also block further token entry                                 
      return false;                                                                   
    }                                                                           
                                                                                
    if (tokenValue === -2) {                                                         
      console.log('OLD TOKEN');                                                 
      return false;                                                                   
    }                                                                           

    console.log('VALID TOKEN');                                                 
    return true;
  }

  #updateUsedCounts(tokenValue, newCount, tokenType) {
    let highestCount = Math.max(...this.usedCounts, 0);

    if (newCount > highestCount) {
      highestCount = newCount;
    }

    const bottomRange = highestCount - MAX_UNUSED_OLDER_TOKENS;
    let newUsedCounts = [];

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

  #updateMeterStatus(tokenValue, tokenType) {
    if (tokenValue <= MAX_ACTIVATION_VALUE) {
      if (!this.paygEnabled && tokenType === TOKEN_TYPE_SET_TIME) {
        this.paygEnabled = true;
      }
      if (this.paygEnabled) {
        this.#updateMeterExpirationDate(tokenValue, tokenType);
      }
    } else if (tokenValue === PAYG_DISABLE_VALUE) {
      this.paygEnabled = false;
    } else if (tokenValue !== COUNTER_SYNC_VALUE) {
      console.log('METER COUNTER SYNCED');
    } else {
      console.log('UNKOWN VALUE, COULD NOT UPDATE METER');
    }
  }

  #updateMeterExpirationDate(tokenValue, tokenType) {
    console.log('tokenValue: ', tokenValue);
    const now = Date.now();
    const numDays = tokenValue / this.timeDivider;
    console.log(numDays);
    const msToAdd = numDays * 24 * 60 * 60 * 1000;

    if (tokenType === TOKEN_TYPE_SET_TIME) {
      this.expirationDate = now + msToAdd;
    } else {
      this.expirationDate = this.expirationDate < now
        ? now + msToAdd
        : this.expirationDate + msToAdd;
    }
  }
}
