const tap = require('tap')

const deviceData = {
  serialNumber: 'XXX',
  startingCode: 516959010,
  key: 'bc41ec9530f6dac86b1a29ab82edc5fb',
  restrictedDigitSet: False,
  timeDivider: 1,
  tokenCount: 1
};

tap.test('Core token test', (suite) => {
  suite.test('Entering an invalid token', (t) => {
    const token = '123 456 789';
    // device
  })
})

tap.pass('this is fine')
