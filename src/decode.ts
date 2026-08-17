import {
  COUNTER_SYNC_VALUE,
  MAX_TOKEN_JUMP,
  MAX_TOKEN_JUMP_COUNTER_SYNC,
  MAX_UNUSED_OLDER_TOKENS,
  TOKEN_TYPE_ADD_TIME,
  TOKEN_TYPE_SET_TIME,
  type SipHashKey,
  type TokenType,
} from "./constants.ts";

import { generateNextToken, generateNextExtendedToken } from "./generateNextToken.ts";
import {
  decodeBase,
  decodeExtendedBase,
  getTokenBase,
  putBaseInToken,
  getExtendedTokenBase,
  putBaseInExtendedToken,
} from "./utils.ts";

/**
 * value is the decoded activation value for a valid token,
 * -2 for a valid but already used (old) token, and null for an invalid token
 */
export type DecodeResult =
  | { value: number; count: number; type: TokenType }
  | { value: -2 | null; count: null; type: null };

export type DecodeExtendedResult = { value: number; count: number } | { value: null; count: null };

export function decode(
  token: string | number,
  startingCode: number,
  key: SipHashKey,
  lastCount: number,
  usedCounts: readonly number[] = [],
): DecodeResult {
  const numericToken = Number(token); // token should be a number, sometimes might be passed as string

  let validOlderToken = false;

  const tokenBase = getTokenBase(numericToken);

  let currentCode = putBaseInToken(startingCode, tokenBase);

  const startingCodeBase = getTokenBase(startingCode);

  const value = decodeBase(startingCodeBase, tokenBase);

  const maxAttempts =
    value === COUNTER_SYNC_VALUE
      ? lastCount + MAX_TOKEN_JUMP_COUNTER_SYNC + 1
      : lastCount + MAX_TOKEN_JUMP + 1;

  // the ideal should be the count value of the token + 30
  // assuming this is the first time we are seeing this token
  for (let count = 0; count < maxAttempts; count++) {
    const maskedToken = putBaseInToken(currentCode, tokenBase);

    const type: TokenType = count % 2 ? TOKEN_TYPE_SET_TIME : TOKEN_TYPE_ADD_TIME;

    if (maskedToken === numericToken) {
      if (countIsValid(count, lastCount, value, type, usedCounts)) {
        return { value, count, type };
      } else {
        validOlderToken = true;
      }
    }

    currentCode = generateNextToken(currentCode, key);
  }

  if (validOlderToken) {
    return { value: -2, count: null, type: null };
  }

  return { value: null, count: null, type: null };
}

// the extended (12 digit) scheme has no ADD_TIME/SET_TIME modes,
// counts simply increment by 1 for each token generated
export function decodeExtended(
  token: string | number,
  startingCode: number,
  key: SipHashKey,
  lastCount: number,
): DecodeExtendedResult {
  const numericToken = Number(token);
  const tokenBase = getExtendedTokenBase(numericToken);
  let currentCode = putBaseInExtendedToken(startingCode, tokenBase);
  const startingCodeBase = getExtendedTokenBase(startingCode);

  const value = decodeExtendedBase(startingCodeBase, tokenBase);

  const maxAttempts = lastCount + MAX_TOKEN_JUMP + 1;

  for (let count = 0; count < maxAttempts; count++) {
    const maskedToken = putBaseInExtendedToken(currentCode, tokenBase);

    if (maskedToken === numericToken && count > lastCount) {
      return { value, count };
    }

    currentCode = generateNextExtendedToken(currentCode, key);
  }

  return { value: null, count: null };
}

function countIsValid(
  count: number,
  lastCount: number,
  value: number,
  type: TokenType,
  usedCounts: readonly number[],
): boolean {
  if (value === COUNTER_SYNC_VALUE) {
    if (count > lastCount - 30) {
      return true;
    }
  } else if (count > lastCount) {
    return true;
  } else if (MAX_UNUSED_OLDER_TOKENS > 0) {
    if (count > lastCount - MAX_UNUSED_OLDER_TOKENS) {
      if (!usedCounts.includes(count) && type === TOKEN_TYPE_ADD_TIME) {
        return true;
      }
    }
  }
  return false;
}
