import { test, describe } from "node:test";
import assert from "node:assert";

import samples from "./vectors/sample_tokens.json" with { type: "json" };

import {
  generateToken,
  generateExtendedToken,
  decodeToken,
  decodeExtendedToken,
  keyFromHex,
  constants,
} from "../src/index.ts";
import type { TokenType } from "../src/constants.ts";

// official OpenPAYGO interop corpus, copied verbatim from
// https://github.com/EnAccess/OpenPAYGO-js/blob/main/test/sample_tokens.json
// (the same file ships with the official Python implementation)

const VALUE_FOR: Record<string, number> = {
  DISABLE_PAYG: constants.PAYG_DISABLE_VALUE,
  COUNTER_SYNC: constants.COUNTER_SYNC_VALUE,
};

// ADD_TIME tokens sit on even counts; every other type sits on odd counts
function modeFor(tokenType: string): TokenType {
  return tokenType === "ADD_TIME" ? constants.TOKEN_TYPE_ADD_TIME : constants.TOKEN_TYPE_SET_TIME;
}

describe(`official interop corpus (${samples.length} vectors)`, () => {
  test("encode: every vector produces the exact official token and count", () => {
    for (const s of samples) {
      const options = {
        key: keyFromHex(s.key),
        startingCode: s.starting_code,
        value: s.value_raw ?? VALUE_FOR[s.token_type] ?? 0,
        count: s.count,
        mode: modeFor(s.token_type),
        restrictedDigitSet: s.restricted_digit_set,
      };
      const { token, newCount } = s.extended_token
        ? generateExtendedToken(options)
        : generateToken(options);
      const label = `${s.token_type} ext=${s.extended_token} rds=${s.restricted_digit_set} count=${s.count}`;
      assert.strictEqual(token, s.token, label);
      assert.strictEqual(newCount, s.new_count, label);
    }
  });

  test("decode: every vector decodes to the official value, count and type", () => {
    for (const s of samples) {
      const options = {
        token: s.token,
        key: keyFromHex(s.key),
        startingCode: s.starting_code,
        lastCount: s.count,
        restrictedDigitSet: s.restricted_digit_set,
      };
      const r = s.extended_token ? decodeExtendedToken(options) : decodeToken(options);
      const label = `${s.token_type} ext=${s.extended_token} rds=${s.restricted_digit_set} count=${s.count}`;
      assert.strictEqual(r.value, s.value_raw ?? VALUE_FOR[s.token_type], label);
      assert.strictEqual(r.count, s.new_count, label);
      assert.strictEqual(r.type, modeFor(s.token_type), label);
    }
  });
});
