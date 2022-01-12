const Server = require('./Server');
const Meter = require('./Meter');
const {STARTING_CODE, KEY, STARTING_COUNT} = require('./constants');


const server = new Server(STARTING_CODE, KEY, STARTING_COUNT, 1);
const meter = new Meter(STARTING_CODE, KEY, STARTING_COUNT, 1, true);

// STEP 1: ENTER AN INVALID TOKEN
meter.enterToken(STARTING_CODE);
meter.printStatus();


// STEP 2: ADD 1 DAY OF ACTIVATION
const token = server.generateTokenForValue(1);
meter.enterToken(token);
meter.printStatus();


meter.enterToken(123987654);
