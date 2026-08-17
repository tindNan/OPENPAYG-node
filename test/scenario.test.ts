import { test, describe } from "node:test";
import assert from "node:assert";

import { Server, Meter, decodeExtendedToken, keyFromHex, constants } from "../src/index.ts";

// end-to-end scenarios: a server and a meter sharing only the key and starting
// code, exercising the full lifecycle the way a real deployment would
const KEY_HEX = "a29ab82edc5fbbc41ec9530f6dac86b1";
const STARTING_CODE = 123456789;
const EXT_STARTING_CODE = 123456789123;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(meter: Meter): number {
  return (meter.expirationDate - Date.now()) / DAY_MS;
}

function assertDays(meter: Meter, expected: number) {
  const days = daysLeft(meter);
  assert.ok(
    days > expected - 0.01 && days <= expected,
    `expected ~${expected} days of activation, got ${days}`,
  );
}

describe("scenario: customer lifecycle", () => {
  test("purchases, replays, corrections, repossession and re-activation", () => {
    const key = keyFromHex(KEY_HEX);
    const server = new Server({ startingCode: STARTING_CODE, key, startingCount: 0 });
    const meter = new Meter({ startingCode: STARTING_CODE, key, startingCount: 0 });

    // customer buys 30 days
    const first = server.generateTokenForValue(30, constants.TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(meter.enterToken(first).value, 30);
    assertDays(meter, 30);

    // entering the same token again must not add time
    assert.strictEqual(meter.enterToken(first).value, -2);
    assertDays(meter, 30);

    // buys 7 more days
    const second = server.generateTokenForValue(7, constants.TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(meter.enterToken(second).value, 7);
    assertDays(meter, 37);

    // support corrects the balance down to 10 days with a set time token
    const correction = server.generateTokenForValue(10, constants.TOKEN_TYPE_SET_TIME);
    assert.strictEqual(meter.enterToken(correction).value, 10);
    assertDays(meter, 10);

    // customer receives two add time tokens and enters them in reverse order
    const tokenA = server.generateTokenForValue(5, constants.TOKEN_TYPE_ADD_TIME);
    const tokenB = server.generateTokenForValue(3, constants.TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(meter.enterToken(tokenB).value, 3);
    assert.strictEqual(meter.enterToken(tokenA).value, 5);
    assertDays(meter, 18);

    // device is paid off: disable PAYG
    const disable = server.generateTokenForValue(
      constants.PAYG_DISABLE_VALUE,
      constants.TOKEN_TYPE_SET_TIME,
    );
    meter.enterToken(disable);
    assert.strictEqual(meter.paygEnabled, false);

    // device is repossessed and re-activated with a set time token
    const reactivate = server.generateTokenForValue(14, constants.TOKEN_TYPE_SET_TIME);
    assert.strictEqual(meter.enterToken(reactivate).value, 14);
    assert.strictEqual(meter.paygEnabled, true);
    assertDays(meter, 14);

    // server and meter counts stay in lockstep throughout
    assert.strictEqual(meter.count, server.count);
  });
});

describe("scenario: counter desynchronisation", () => {
  test("counter sync token recovers a meter that fell far behind", () => {
    const key = keyFromHex(KEY_HEX);
    const server = new Server({ startingCode: STARTING_CODE, key, startingCount: 0 });
    const meter = new Meter({
      startingCode: STARTING_CODE,
      key,
      startingCount: 0,
      waitingPeriodEnabled: false,
    });

    // a batch of tokens is generated but never entered, pushing the server
    // count beyond the meter's MAX_TOKEN_JUMP search window
    for (let i = 0; i < 40; i++) {
      server.generateTokenForValue(1, constants.TOKEN_TYPE_ADD_TIME);
    }

    // the next regular token is now out of reach for the meter
    const unreachable = server.generateTokenForValue(30, constants.TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(meter.enterToken(unreachable).value, null);

    // a counter sync token uses the larger search window and resyncs the count
    const sync = server.generateTokenForValue(
      constants.COUNTER_SYNC_VALUE,
      constants.TOKEN_TYPE_ADD_TIME,
    );
    const r = meter.enterToken(sync);
    assert.strictEqual(r.value, constants.COUNTER_SYNC_VALUE);
    assert.strictEqual(meter.count, server.count);

    // normal purchases work again
    const next = server.generateTokenForValue(30, constants.TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(meter.enterToken(next).value, 30);
  });
});

describe("scenario: extended tokens", () => {
  test("server issues 12 digit device data tokens the device can decode", () => {
    const key = keyFromHex(KEY_HEX);
    const server = new Server({ startingCode: EXT_STARTING_CODE, key, startingCount: 0 });
    let lastCount = 0;

    for (const value of [42, 123456, 999999]) {
      const token = server.generateExtendedTokenForValue(value);
      const r = decodeExtendedToken({ token, key, startingCode: EXT_STARTING_CODE, lastCount });
      assert.strictEqual(r.value, value);
      assert.ok(r.count !== null);
      lastCount = r.count;
    }
  });
});
