const siphash = require('siphash');

module.exports = {
  MAX_BASE: 999,
  MAX_EXTENDED_BASE: 999999,
  MAX_ACTIVATION_VALUE: 995,
  EXTENDED_MAX_ACTIVATION_VALUE: 999995,
  PAYG_DISABLE_VALUE: 998,
  EXTENDED_PAYG_DISABLE_VALUE: 999998,
  COUNTER_SYNC_VALUE: 999,
  EXTENDED_COUNTER_SYNC_VALUE: 999999,
  TOKEN_VALUE_OFFSET: 1000,
  EXTENDED_TOKEN_VALUE_OFFSET: 1000000,
  TOKEN_TYPE_SET_TIME: 1,
  TOKEN_TYPE_ADD_TIME: 2,
  STARTING_CODE: 123456789,
  EXTENDED_STARTING_CODE: 123456789123,
  STARTING_COUNT: 1,
  MAX_TOKEN_JUMP: 64,
  MAX_TOKEN_JUMP_COUNTER_SYNC: 100,
  MAX_UNUSED_OLDER_TOKENS: 8 * 2,
  KEY: siphash.string16_to_key('This is the key!'), // <--------- you can replace 'This is the key'
  TIME_DIVIDER: 1
};