const tap = require('tap');
const ServerSimulator = require('../../src/simulators/server_simulator');
const DeviceSimulator = require('../../src/simulators/device_simulator');

const deviceKey = '\xa2\x9a\xb8.\xdc_\xbb\xc4\x1e\xc9S\x0fm\xac\x86\xb1';
const deviceStartingCode = 123456789;
const restrictedDigitSet = false;

// the tests in this suite are run in order
tap.test('Simple Scenario', (childTest) => {
  let serverSimulator, deviceSimulator;
  childTest.before(() => {
    console.log('Creating Server and Device Simulators');
    deviceSimulator = new DeviceSimulator(deviceStartingCode, deviceKey, 0, restrictedDigitSet);
    serverSimulator = new ServerSimulator(deviceStartingCode, deviceKey, 0, restrictedDigitSet);
  });

  childTest.test('When entering an invalid token the status should remain inactive', (t) => {
    deviceSimulator.enterToken('123456789');
    t.notOk(deviceSimulator.isActive());
    t.end();
  });

  childTest.test('When adding a valid token for 1 day', (t) => {
    const oneDayFromNow = Date.now() + (24 * 60 * 60 * 1000);
    const firstToken = serverSimulator.generateTokenFromDate(oneDayFromNow);
    deviceSimulator.enterToken(firstToken);

    t.test('Adding the token for the first time should update the expiry date', (t) => {
      t.ok(deviceSimulator.count === serverSimulator.count);
      t.strictSame(deviceSimulator.expirationDate, oneDayFromNow);
      t.end();
    });

    t.test('Adding the same token agan should not update the expiry date', (t) => {
      t.ok(deviceSimulator.count === serverSimulator.count);
      t.strictSame(deviceSimulator.expirationDate, oneDayFromNow);
      t.end();
    });
  });
});
