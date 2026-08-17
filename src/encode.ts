import { TOKEN_TYPE_SET_TIME, type SipHashKey, type TokenType } from "./constants.ts";
import {
  encodeBase,
  getTokenBase,
  putBaseInToken,
  getExtendedTokenBase,
  encodeExtendedBase,
  putBaseInExtendedToken,
} from "./utils.ts";
import { generateNextToken, generateNextExtendedToken } from "./generateNextToken.ts";

export interface EncodeResult {
  finalToken: string;
  newCount: number;
}

export function encode(
  key: SipHashKey,
  startingCode: number,
  value: number,
  count: number,
  mode: TokenType,
): EncodeResult {
  const startingCodeBase = getTokenBase(startingCode);
  const tokenBase = encodeBase(startingCodeBase, value);
  let currentToken = putBaseInToken(startingCode, tokenBase);

  const newCount = getNextCount(count, mode);

  for (let xn = 0; xn < newCount; xn++) {
    currentToken = generateNextToken(currentToken, key);
  }

  // ensure that final token has 9 digits.
  // the implementation can consider 15 digit tokens but that won't be necessary here
  const finalToken = putBaseInToken(currentToken, tokenBase).toString().padStart(9, "0");

  return { newCount, finalToken };
}

// the extended (12 digit) scheme has no ADD_TIME/SET_TIME modes,
// the count simply increments by 1 for each token generated
export function encodeExtended(
  key: SipHashKey,
  startingCode: number,
  value: number,
  count: number,
): EncodeResult {
  const startingCodeBase = getExtendedTokenBase(startingCode);
  const tokenBase = encodeExtendedBase(startingCodeBase, value);
  let currentToken = putBaseInExtendedToken(startingCode, tokenBase);

  const newCount = count + 1;

  for (let xn = 0; xn < newCount; xn++) {
    currentToken = generateNextExtendedToken(currentToken, key);
  }

  const finalToken = putBaseInExtendedToken(currentToken, tokenBase).toString().padStart(12, "0");

  return { newCount, finalToken };
}

function getNextCount(count: number, mode: TokenType): number {
  const currentCountOdd = count % 2;

  let newCount: number;
  if (mode === TOKEN_TYPE_SET_TIME) {
    newCount = currentCountOdd ? count + 2 : count + 1;
  } else {
    newCount = currentCountOdd ? count + 1 : count + 2;
  }

  return newCount;
}
