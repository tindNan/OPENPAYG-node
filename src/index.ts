import siphash from "siphash";

import { encode, encodeExtended } from "./encode.ts";
import { decode, decodeExtended, type DecodeResult, type DecodeExtendedResult } from "./decode.ts";
import { keyFromHex, convertTo4DigitToken, convertFrom4DigitToken } from "./utils.ts";
import * as constants from "./constants.ts";
import type { Logger, SipHashKey, TokenType } from "./constants.ts";

const {
  MAX_ACTIVATION_VALUE,
  EXTENDED_MAX_ACTIVATION_VALUE,
  PAYG_DISABLE_VALUE,
  COUNTER_SYNC_VALUE,
  TOKEN_TYPE_ADD_TIME,
} = constants;

export interface GenerateTokenOptions {
  /** siphash key, see keyFromHex */
  key: SipHashKey;
  /** the device's 9 digit starting code */
  startingCode: number;
  /** days of activation (0-995), 998 disables PAYG, 999 syncs the counter */
  value: number;
  /** the current token count kept by the server */
  count: number;
  /** TOKEN_TYPE_ADD_TIME (default) or TOKEN_TYPE_SET_TIME */
  mode?: TokenType;
  /** emit a 15 digit token using only digits 1-4 */
  restrictedDigitSet?: boolean;
}

export interface GeneratedToken {
  token: string;
  /** the count to persist for the device */
  newCount: number;
}

export interface DecodeTokenOptions {
  /** the entered token */
  token: string | number;
  /** siphash key, see keyFromHex */
  key: SipHashKey;
  /** the device's 9 digit starting code */
  startingCode: number;
  /** the device's last known token count */
  lastCount: number;
  /** counts already used (for out-of-order add-time tokens) */
  usedCounts?: readonly number[];
  /** token was entered using only digits 1-4 */
  restrictedDigitSet?: boolean;
}

export interface GenerateExtendedTokenOptions {
  /** siphash key, see keyFromHex */
  key: SipHashKey;
  /** the device's 12 digit starting code */
  startingCode: number;
  /** value to encode (0-999999) */
  value: number;
  /** the current token count kept by the server */
  count: number;
  /** emit a 20 digit token using only digits 1-4 */
  restrictedDigitSet?: boolean;
}

export interface DecodeExtendedTokenOptions {
  /** the entered token */
  token: string | number;
  /** siphash key, see keyFromHex */
  key: SipHashKey;
  /** the device's 12 digit starting code */
  startingCode: number;
  /** the device's last known token count */
  lastCount: number;
  /** token was entered using only digits 1-4 */
  restrictedDigitSet?: boolean;
}

function assertStandardValue(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    (value > MAX_ACTIVATION_VALUE && value !== PAYG_DISABLE_VALUE && value !== COUNTER_SYNC_VALUE)
  ) {
    throw Error(
      `INVALID VALUE: must be 0-${MAX_ACTIVATION_VALUE}, ${PAYG_DISABLE_VALUE} or ${COUNTER_SYNC_VALUE}`,
    );
  }
}

/** Generates a standard 9 digit OpenPAYGO token */
export function generateToken({
  key,
  startingCode,
  value,
  count,
  mode = TOKEN_TYPE_ADD_TIME,
  restrictedDigitSet = false,
}: GenerateTokenOptions): GeneratedToken {
  assertStandardValue(value);
  const { finalToken, newCount } = encode(key, startingCode, value, count, mode);

  return {
    token: restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 30) : finalToken,
    newCount,
  };
}

/**
 * Decodes a standard 9 digit OpenPAYGO token on the device side.
 * The result value is the decoded activation value, -2 for an already
 * used token, and null for an invalid token.
 */
export function decodeToken({
  token,
  key,
  startingCode,
  lastCount,
  usedCounts = [],
  restrictedDigitSet = false,
}: DecodeTokenOptions): DecodeResult {
  if (restrictedDigitSet) {
    token = convertFrom4DigitToken(token);
  }

  return decode(token, startingCode, key, lastCount, usedCounts);
}

/** Generates an extended 12 digit OpenPAYGO token (device-specific data, no add/set time modes) */
export function generateExtendedToken({
  key,
  startingCode,
  value,
  count,
  restrictedDigitSet = false,
}: GenerateExtendedTokenOptions): GeneratedToken {
  if (!Number.isInteger(value) || value < 0 || value > EXTENDED_MAX_ACTIVATION_VALUE) {
    throw Error(`INVALID VALUE: must be 0-${EXTENDED_MAX_ACTIVATION_VALUE}`);
  }

  const { finalToken, newCount } = encodeExtended(key, startingCode, value, count);

  return {
    token: restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 40) : finalToken,
    newCount,
  };
}

/**
 * Decodes an extended 12 digit OpenPAYGO token on the device side.
 * The result value is null if the token is invalid or already used.
 */
export function decodeExtendedToken({
  token,
  key,
  startingCode,
  lastCount,
  restrictedDigitSet = false,
}: DecodeExtendedTokenOptions): DecodeExtendedResult {
  if (restrictedDigitSet) {
    token = convertFrom4DigitToken(token);
  }

  return decodeExtended(token, startingCode, key, lastCount);
}

// high-level stateful classes
export { Server, type ServerOptions } from "./Server.ts";
export { Meter, type MeterOptions } from "./Meter.ts";

// key helpers
export { keyFromHex };
export const keyFromString16 = siphash.string16_to_key;

// spec constants and shared types
export { constants };
export type { Logger, SipHashKey, TokenType, DecodeResult, DecodeExtendedResult };
