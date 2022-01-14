const encode = require('./encode');

const { KEY, TOKEN_TYPE_ADD_TIME, STARTING_CODE, STARTING_COUNT } = require('./constants');

module.exports = class Server {
  /**
   * @param {number} startingCode - starting code for the meter, defaults to 123456789
   * @param {*} key
   * @param {number} startingCount - starting count for the # of tokens
   * @param {number} timeDivider - time divider (check OPENPAYG documentation
   */
  constructor(startingCode = STARTING_CODE, key = KEY, startingCount = STARTING_COUNT, timeDivider = 1) {
    this.startingCode = startingCode;
    this.key = key;
    this.count = startingCount;
    this.timeDivider = timeDivider;
  }

  /**
   * @param {number} value - number of days to encode, if timeDivider is > 1 then refer to OPENPAYG documenation
   * @param {(TOKEN_TYPE_ADD_TIME|TOKEN_TYPE_SET_TIME)} [mode=TOKEN_TYPE_ADD_TIME] - if token is add time or set time
   *
   * @return {{ finalToken: number, newCount: number }} obj
   */
  generateTokenForValue(value, mode = TOKEN_TYPE_ADD_TIME) {
    console.log('generating Token: ');
    const printMode = mode === TOKEN_TYPE_ADD_TIME ? 'ADD_TIME' : 'SET_TIME';
    console.log(`starting code: ${this.startingCode}, value: ${value}, token_count: ${this.count}, mode: ${printMode}`);

    const { finalToken, newCount } = encode(this.key, this.startingCode, value, this.count, mode);
    this.count = newCount;
    return finalToken;
  }
}
