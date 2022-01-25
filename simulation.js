const Server = require('./Server');

// YOU CAN CHANGE THESE VARIABLES in constants.js file
const {STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER, EXTENDED_STARTING_CODE} = require('./constants');

const server = new Server(STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER);

/**
 * USAGE:
 *
 * node simulation.js <number of tokens to generate>
 */

// number of tokens to generate
const numTokens = process.argv[2] || 1;

const VALUE_TO_ENCODE = 1;
/**
for (let i = 0; i < numTokens; i++) {
  console.log('==================');
  const token = server.generateTokenForValue(VALUE_TO_ENCODE); // defaults to ADD_TIME token
  console.log(token);
}

*/

// 12 DIGIT TOKENS
const extendedServer = new Server(EXTENDED_STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER);

for (let i = 0; i < numTokens; i++) {
  console.log('=================');
  const token = extendedServer.generateExtendedTokenForValue(VALUE_TO_ENCODE);
  console.log(token);
}
