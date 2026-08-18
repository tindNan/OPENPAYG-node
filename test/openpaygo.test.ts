import { test, describe } from "node:test";
import assert from "node:assert";

import { encode, encodeExtended } from "../src/encode.ts";
import { decode, decodeExtended } from "../src/decode.ts";
import {
  encodeBase,
  decodeBase,
  encodeExtendedBase,
  decodeExtendedBase,
  convertTo4DigitToken,
  convertFrom4DigitToken,
} from "../src/utils.ts";
import { TOKEN_TYPE_ADD_TIME, TOKEN_TYPE_SET_TIME, type TokenType } from "../src/constants.ts";
import { Meter } from "../src/Meter.ts";
import { Server } from "../src/Server.ts";

// official test key from the OpenPAYGO example implementation documentation (scenario 1)
// bytes: a2 9a b8 2e dc 5f bb c4 1e c9 53 0f 6d ac 86 b1 as 4 little-endian uint32
const TEST_KEY = [0x2eb89aa2, 0xc4bb5fdc, 0x0f53c91e, 0xb186ac6d];
const TEST_STARTING_CODE = 123456789;

// official scenario 1 vectors: (value, mode) -> expected token, starting from count 0
const OFFICIAL_VECTORS: { value: number; mode: TokenType; token: string }[] = [
  { value: 1, mode: TOKEN_TYPE_ADD_TIME, token: "662486790" },
  { value: 29, mode: TOKEN_TYPE_ADD_TIME, token: "927706818" },
  { value: 7, mode: TOKEN_TYPE_SET_TIME, token: "942433796" },
  { value: 998, mode: TOKEN_TYPE_SET_TIME, token: "650975787" },
  { value: 0, mode: TOKEN_TYPE_SET_TIME, token: "592185789" },
];

describe("base encoding (utils)", () => {
  test("encodes value into starting code base per spec example", () => {
    // spec: starting code 123456789, value 50 -> code base 839
    assert.strictEqual(encodeBase(789, 50), 839);
  });

  test("wraps around above 999", () => {
    assert.strictEqual(encodeBase(789, 300), 89);
    assert.strictEqual(decodeBase(789, 89), 300);
  });

  test("decodes spec example base", () => {
    // spec: received base 829 - starting base 789 = value 40
    assert.strictEqual(decodeBase(789, 829), 40);
  });

  test("extended base round-trips with 1000000 wraparound", () => {
    assert.strictEqual(encodeExtendedBase(789123, 500000), 289123);
    assert.strictEqual(decodeExtendedBase(789123, 289123), 500000);
  });
});

describe("standard 9 digit tokens (official vectors)", () => {
  test("encode produces the official scenario 1 tokens", () => {
    let count = 0;
    for (const v of OFFICIAL_VECTORS) {
      const { finalToken, newCount } = encode(TEST_KEY, TEST_STARTING_CODE, v.value, count, v.mode);
      assert.strictEqual(finalToken, v.token, `value ${v.value}`);
      count = newCount;
    }
  });

  test("decode recovers value, count and type from official tokens", () => {
    let deviceCount = 0;
    const usedCounts: number[] = [];
    for (const v of OFFICIAL_VECTORS) {
      const r = decode(v.token, TEST_STARTING_CODE, TEST_KEY, deviceCount, usedCounts);
      assert.strictEqual(r.value, v.value);
      assert.strictEqual(r.type, v.mode);
      assert.ok(r.count !== null);
      deviceCount = r.count;
      usedCounts.push(r.count);
    }
  });

  test("rejects an already used token as old (-2)", () => {
    const { finalToken } = encode(TEST_KEY, TEST_STARTING_CODE, 1, 0, TOKEN_TYPE_ADD_TIME);
    const first = decode(finalToken, TEST_STARTING_CODE, TEST_KEY, 0, []);
    assert.strictEqual(first.value, 1);
    assert.ok(first.count !== null);
    const replay = decode(finalToken, TEST_STARTING_CODE, TEST_KEY, first.count, [first.count]);
    assert.strictEqual(replay.value, -2);
  });

  test("rejects a token for a different starting code as invalid (null)", () => {
    const { finalToken } = encode(TEST_KEY, 987654321, 1, 0, TOKEN_TYPE_ADD_TIME);
    const r = decode(finalToken, TEST_STARTING_CODE, TEST_KEY, 0, []);
    assert.strictEqual(r.value, null);
  });

  test("allows unused older add-time tokens out of order", () => {
    const first = encode(TEST_KEY, TEST_STARTING_CODE, 1, 0, TOKEN_TYPE_ADD_TIME); // count 2
    const second = encode(TEST_KEY, TEST_STARTING_CODE, 2, first.newCount, TOKEN_TYPE_ADD_TIME); // count 4
    // enter the second token first
    const r2 = decode(second.finalToken, TEST_STARTING_CODE, TEST_KEY, 0, []);
    assert.strictEqual(r2.value, 2);
    assert.ok(r2.count !== null);
    // the older, unused add-time token is still accepted
    const r1 = decode(first.finalToken, TEST_STARTING_CODE, TEST_KEY, r2.count, [r2.count]);
    assert.strictEqual(r1.value, 1);
  });
});

describe("extended 12 digit tokens", () => {
  const EXT_STARTING_CODE = 123456789123;

  test("round-trips values through encode/decode", () => {
    let serverCount = 0;
    let deviceCount = 0;
    for (const value of [0, 1, 500, 999999]) {
      const { finalToken, newCount } = encodeExtended(
        TEST_KEY,
        EXT_STARTING_CODE,
        value,
        serverCount,
      );
      assert.strictEqual(finalToken.length, 12);
      serverCount = newCount;
      const r = decodeExtended(finalToken, EXT_STARTING_CODE, TEST_KEY, deviceCount);
      assert.strictEqual(r.value, value);
      assert.ok(r.count !== null);
      deviceCount = r.count;
    }
  });

  test("counts follow the add/set parity scheme like standard tokens", () => {
    // add time tokens sit on even counts, set time tokens on odd counts
    assert.strictEqual(encodeExtended(TEST_KEY, EXT_STARTING_CODE, 1, 5).newCount, 6);
    assert.strictEqual(encodeExtended(TEST_KEY, EXT_STARTING_CODE, 1, 6).newCount, 8);
    assert.strictEqual(
      encodeExtended(TEST_KEY, EXT_STARTING_CODE, 1, 5, TOKEN_TYPE_SET_TIME).newCount,
      7,
    );
    assert.strictEqual(
      encodeExtended(TEST_KEY, EXT_STARTING_CODE, 1, 6, TOKEN_TYPE_SET_TIME).newCount,
      7,
    );
  });

  test("rejects a replayed extended token as old (-2)", () => {
    const { finalToken } = encodeExtended(TEST_KEY, EXT_STARTING_CODE, 42, 0);
    const first = decodeExtended(finalToken, EXT_STARTING_CODE, TEST_KEY, 0);
    assert.strictEqual(first.value, 42);
    assert.ok(first.count !== null);
    const replay = decodeExtended(finalToken, EXT_STARTING_CODE, TEST_KEY, first.count, [
      first.count,
    ]);
    assert.strictEqual(replay.value, -2);
  });
});

describe("restricted digit set mode", () => {
  test("converts the spec worked example token", () => {
    // spec: token 662486790 -> 324244134441123
    assert.strictEqual(convertTo4DigitToken(662486790, 30), "324244134441123");
    assert.strictEqual(convertFrom4DigitToken("324244134441123"), 662486790);
  });

  test("round-trips 30 and 40 bit tokens", () => {
    assert.strictEqual(convertFrom4DigitToken(convertTo4DigitToken(999999999, 30)), 999999999);
    assert.strictEqual(
      convertFrom4DigitToken(convertTo4DigitToken(999999999999, 40)),
      999999999999,
    );
  });

  test("server and meter interoperate in restricted digit mode", () => {
    const server = new Server({
      startingCode: TEST_STARTING_CODE,
      key: TEST_KEY,
      startingCount: 0,
      restrictedDigitSet: true,
    });
    const meter = new Meter({
      startingCode: TEST_STARTING_CODE,
      key: TEST_KEY,
      startingCount: 0,
      restrictedDigitSet: true,
    });
    const token = server.generateTokenForValue(3, TOKEN_TYPE_ADD_TIME);
    assert.strictEqual(token.length, 15);
    assert.match(token, /^[1-4]+$/);
    const r = meter.enterToken(token);
    assert.strictEqual(r.value, 3);
  });
});

describe("Meter", () => {
  test("processes the official token sequence and tracks state", () => {
    const meter = new Meter({ startingCode: TEST_STARTING_CODE, key: TEST_KEY, startingCount: 0 });
    const r1 = meter.enterToken("662486790"); // 1 day ADD_TIME
    assert.strictEqual(r1.value, 1);
    assert.strictEqual(meter.count, 2);
    const r2 = meter.enterToken("942433796"); // 7 days SET_TIME
    assert.strictEqual(r2.value, 7);
    assert.strictEqual(meter.count, 5);
    // expiration roughly 7 days out
    const days = (meter.expirationDate - Date.now()) / (24 * 60 * 60 * 1000);
    assert.ok(days > 6.9 && days <= 7, `expected ~7 days, got ${days}`);
    meter.enterToken("650975787"); // disable PAYG
    assert.strictEqual(meter.paygEnabled, false);
    meter.enterToken("592185789"); // 0 days SET_TIME re-enables PAYG
    assert.strictEqual(meter.paygEnabled, true);
  });

  test("does not add time twice for a replayed token", () => {
    const meter = new Meter({ startingCode: TEST_STARTING_CODE, key: TEST_KEY, startingCount: 0 });
    meter.enterToken("662486790");
    const expiration = meter.expirationDate;
    const replay = meter.enterToken("662486790");
    assert.strictEqual(replay.value, -2);
    assert.strictEqual(meter.expirationDate, expiration);
  });

  test("locks token entry after an invalid token when waiting period is enabled", () => {
    const meter = new Meter({ startingCode: TEST_STARTING_CODE, key: TEST_KEY, startingCount: 0 });
    meter.enterToken("111111111"); // invalid
    assert.strictEqual(meter.invalidTokenCount, 1);
    assert.ok(meter.tokenEntryLockedUntil > Date.now());
    // locked: even a valid token is refused
    const locked = meter.enterToken("662486790");
    assert.strictEqual(locked.value, null);
    assert.strictEqual(meter.count, 0);
    // once the waiting period expires, entry works again
    meter.tokenEntryLockedUntil = Date.now() - 1;
    const r = meter.enterToken("662486790");
    assert.strictEqual(r.value, 1);
    assert.strictEqual(meter.invalidTokenCount, 0);
  });

  test("waiting period doubles per invalid entry and caps at 512 minutes", () => {
    const meter = new Meter({ startingCode: TEST_STARTING_CODE, key: TEST_KEY, startingCount: 0 });
    for (let i = 1; i <= 11; i++) {
      meter.tokenEntryLockedUntil = 0; // simulate expiry between attempts
      const before = Date.now();
      meter.enterToken("111111111");
      const minutes = (meter.tokenEntryLockedUntil - before) / 60000;
      const expected = Math.min(2 ** (i - 1), 512);
      assert.ok(
        Math.abs(minutes - expected) < 0.1,
        `attempt ${i}: expected ~${expected}min, got ${minutes}`,
      );
    }
  });

  test("does not lock when waiting period is disabled", () => {
    const meter = new Meter({
      startingCode: TEST_STARTING_CODE,
      key: TEST_KEY,
      startingCount: 0,
      waitingPeriodEnabled: false,
    });
    meter.enterToken("111111111");
    const r = meter.enterToken("662486790");
    assert.strictEqual(r.value, 1);
  });
});

describe("Server", () => {
  test("rejects reserved and out-of-range values", () => {
    const server = new Server({
      startingCode: TEST_STARTING_CODE,
      key: TEST_KEY,
      startingCount: 0,
    });
    assert.throws(() => server.generateTokenForValue(996));
    assert.throws(() => server.generateTokenForValue(997));
    assert.throws(() => server.generateTokenForValue(1000));
    assert.throws(() => server.generateTokenForValue(-1));
    assert.throws(() => server.generateExtendedTokenForValue(1000000));
  });

  test("generates the official tokens in sequence", () => {
    const server = new Server({
      startingCode: TEST_STARTING_CODE,
      key: TEST_KEY,
      startingCount: 0,
    });
    for (const v of OFFICIAL_VECTORS) {
      assert.strictEqual(server.generateTokenForValue(v.value, v.mode), v.token);
    }
  });
});
