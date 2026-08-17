const { test, describe } = require("node:test");
const assert = require("node:assert");

const {
  Server,
  Meter,
  generateToken,
  generateExtendedToken,
  decodeToken,
  decodeExtendedToken,
  keyFromHex,
  keyFromString16,
  constants,
} = require("..");

// official test key and starting code from the OpenPAYGO example documentation (scenario 1)
const OFFICIAL_KEY_HEX = "a29ab82edc5fbbc41ec9530f6dac86b1";
const STARTING_CODE = 123456789;
const EXT_STARTING_CODE = 123456789123;

describe("public API", () => {
  test("exposes classes, primitives, key helpers and constants", () => {
    assert.strictEqual(typeof Server, "function");
    assert.strictEqual(typeof Meter, "function");
    assert.strictEqual(typeof keyFromString16, "function");
    assert.strictEqual(constants.TOKEN_TYPE_ADD_TIME, 2);
    assert.strictEqual(constants.PAYG_DISABLE_VALUE, 998);
    assert.strictEqual(constants.COUNTER_SYNC_VALUE, 999);
  });

  test("keyFromHex + generateToken reproduces the official test vector", () => {
    const { token, newCount } = generateToken({
      key: keyFromHex(OFFICIAL_KEY_HEX),
      startingCode: STARTING_CODE,
      value: 1,
      count: 0,
      mode: constants.TOKEN_TYPE_ADD_TIME,
    });
    assert.strictEqual(token, "662486790");
    assert.strictEqual(newCount, 2);
  });

  test("keyFromHex rejects malformed keys", () => {
    assert.throws(() => keyFromHex("abc"));
    assert.throws(() => keyFromHex("zz9ab82edc5fbbc41ec9530f6dac86b1"));
    assert.throws(() => keyFromHex(123));
  });

  test("decodeToken round-trips through the options API", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    const { token } = generateToken({
      key,
      startingCode: STARTING_CODE,
      value: 7,
      count: 0,
      mode: constants.TOKEN_TYPE_SET_TIME,
    });
    const r = decodeToken({ token, key, startingCode: STARTING_CODE, lastCount: 0 });
    assert.strictEqual(r.value, 7);
    assert.strictEqual(r.type, constants.TOKEN_TYPE_SET_TIME);
  });

  test("round-trips in restricted digit set mode", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    const { token } = generateToken({
      key,
      startingCode: STARTING_CODE,
      value: 3,
      count: 0,
      restrictedDigitSet: true,
    });
    assert.strictEqual(token.length, 15);
    assert.match(token, /^[1-4]+$/);
    const r = decodeToken({
      token,
      key,
      startingCode: STARTING_CODE,
      lastCount: 0,
      restrictedDigitSet: true,
    });
    assert.strictEqual(r.value, 3);
  });

  test("rejects reserved values 996 and 997", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    assert.throws(() => generateToken({ key, startingCode: STARTING_CODE, value: 996, count: 0 }));
    assert.throws(() => generateToken({ key, startingCode: STARTING_CODE, value: 997, count: 0 }));
  });

  test("extended tokens round-trip through the options API", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    const { token, newCount } = generateExtendedToken({
      key,
      startingCode: EXT_STARTING_CODE,
      value: 123456,
      count: 0,
    });
    assert.strictEqual(token.length, 12);
    assert.strictEqual(newCount, 1);
    const r = decodeExtendedToken({ token, key, startingCode: EXT_STARTING_CODE, lastCount: 0 });
    assert.strictEqual(r.value, 123456);
  });

  test("classes are silent by default and accept a logger", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    const messages = [];
    const silent = new Server({ startingCode: STARTING_CODE, key, startingCount: 0 });
    const chatty = new Server({
      startingCode: STARTING_CODE,
      key,
      startingCount: 0,
      logger: (msg) => messages.push(msg),
    });
    silent.generateTokenForValue(1);
    assert.strictEqual(messages.length, 0);
    chatty.generateTokenForValue(1);
    assert.strictEqual(messages.length, 1);
  });

  test("Server and Meter interoperate through the public entry point", () => {
    const key = keyFromHex(OFFICIAL_KEY_HEX);
    const server = new Server({ startingCode: STARTING_CODE, key, startingCount: 0 });
    const meter = new Meter({ startingCode: STARTING_CODE, key, startingCount: 0 });
    const token = server.generateTokenForValue(5, constants.TOKEN_TYPE_SET_TIME);
    const r = meter.enterToken(token);
    assert.strictEqual(r.value, 5);
    assert.strictEqual(meter.count, server.count);
  });
});
