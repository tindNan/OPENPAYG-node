const Server = require('./Server');

// YOU CAN CHANGE THESE VARIABLES in constants.js file
const {STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER} = require('./constants');

const server = new Server(STARTING_CODE, KEY, STARTING_COUNT, TIME_DIVIDER);

/**
 * USAGE:
 *
 * node simulation.js <number of tokens to generate>
 */

// number of tokens to generate
const numTokens = process.argv[2] || 1;

for (let i = 0; i < numTokens; i++) {
  console.log('==================');
  const token = server.generateTokenForValue(1); // defaults to ADD_TIME token
  console.log(token);
}
