const tap = require('tap');
const ServerSimulator = require('../../src/simulators/server_simulator');
const DeviceSimulator = require('../../src/simulators/device_simulator');

// byte represenation of the following string: \xa2\x9a\xb8.\xdc_\xbb\xc4\x1e\xc9S\x0fm\xac\x86\xb1
const deviceKey = Buffer.from([0xa2, 0x9a, 0xb8, '.'.charCodeAt(0), 0xdc, '_'.charCodeAt(0), 0xbb, 0xc4, 0x1e, 0xc9, 'S'.charCodeAt(0), 0x0f, 'm'.charCodeAt(0), 0xac, 0x86, 0xb1]);
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

  childTest.skip('When adding a valid token for 1 day', (t) => {
    const oneDayFromNow = new Date(Date.now() + (24 * 60 * 60 * 1000));
    const firstToken = serverSimulator.generateTokenFromDate(oneDayFromNow.getTime());
    deviceSimulator.enterToken(firstToken);

    t.test('Adding the token for the first time should update the expiry date', (t) => {
      t.ok(deviceSimulator.count === serverSimulator.count, `Expected device count ${deviceSimulator.count} to match ${serverSimulator.count}`);

      console.log('one day from now: ', oneDayFromNow);
      oneDayFromNow.setSeconds(0, 0);
      const deviceDate = new Date(deviceSimulator.expirationDate);
      console.log(deviceDate);
      deviceDate.setSeconds(0, 0);

      t.strictSame(deviceDate.getTime(), oneDayFromNow.getTime(), `Expected device expiration date ${deviceSimulator.expirationDate} to match the expiration date ${oneDayFromNow}`);
      t.end();
    });

    t.skip('Adding the same token agan should not update the expiry date', (t) => {
      t.ok(deviceSimulator.count === serverSimulator.count);
      t.strictSame(deviceSimulator.expirationDate, oneDayFromNow);
      t.end();
    });
  });
});
