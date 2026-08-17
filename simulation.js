const Server = require('./Server');
const Meter = require('./Meter');

// YOU CAN CHANGE THESE VARIABLES in src/constants.js file
const { STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER, EXTENDED_STARTING_CODE, TOKEN_TYPE_ADD_TIME } = require('./src/constants');

/**
 * USAGE:
 *
 * node simulation.js <number of tokens to generate>
 */

// number of tokens to generate
const numTokens = Number(process.argv[2]) || 1;

const VALUE_TO_ENCODE = 1;

// 9 DIGIT TOKENS: server generates, meter decodes
const server = new Server(STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER, false, console.log);
const meter = new Meter(STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER, true, false, console.log);

for (let i = 0; i < numTokens; i++) {
  console.log('==================');
  const token = server.generateTokenForValue(VALUE_TO_ENCODE, TOKEN_TYPE_ADD_TIME);
  console.log('token: ', token);
  meter.enterToken(token);
}
meter.printStatus();

// 12 DIGIT TOKENS (extended, no add/set time modes)
const extendedServer = new Server(EXTENDED_STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER, false, console.log);

for (let i = 0; i < numTokens; i++) {
  console.log('=================');
  const token = extendedServer.generateExtendedTokenForValue(VALUE_TO_ENCODE);
  console.log('extended token: ', token);
}
