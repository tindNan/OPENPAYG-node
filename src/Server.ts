import { debuglog } from "node:util";

import { encode, encodeExtended } from "./encode.ts";
import { convertTo4DigitToken } from "./utils.ts";

import {
  KEY,
  MAX_ACTIVATION_VALUE,
  EXTENDED_MAX_ACTIVATION_VALUE,
  PAYG_DISABLE_VALUE,
  COUNTER_SYNC_VALUE,
  TOKEN_TYPE_ADD_TIME,
  STARTING_CODE,
  STARTING_COUNT,
  type Logger,
  type SipHashKey,
  type TokenType,
} from "./constants.ts";

export interface ServerOptions {
  /** the device's 9 digit starting code, defaults to 123456789 */
  startingCode?: number;
  /** siphash key (4 x uint32), see keyFromHex */
  key?: SipHashKey;
  /** starting count for the # of tokens */
  startingCount?: number;
  /** time divider (check OPENPAYG documentation) */
  timeDivider?: number;
  /** emit tokens using only digits 1-4, 15/20 digits long (default false) */
  restrictedDigitSet?: boolean;
  /**
   * log sink (e.g. console.log or a pino method);
   * defaults to util.debuglog, enabled by running with NODE_DEBUG=openpaygo
   */
  logger?: Logger;
}

export class Server {
  startingCode: number;
  key: SipHashKey;
  count: number;
  timeDivider: number;
  restrictedDigitSet: boolean;
  logger: Logger;

  constructor({
    startingCode = STARTING_CODE,
    key = KEY,
    startingCount = STARTING_COUNT,
    timeDivider = 1,
    restrictedDigitSet = false,
    logger = debuglog("openpaygo"),
  }: ServerOptions = {}) {
    this.logger = logger;
    this.startingCode = startingCode;
    this.key = key;
    this.count = startingCount;
    this.timeDivider = timeDivider;
    this.restrictedDigitSet = restrictedDigitSet;
  }

  /**
   * @param value - number of days to encode (0-995), or 998 to disable PAYG,
   *   or 999 for counter synchronisation. 996 and 997 are reserved by the spec.
   *   If timeDivider is > 1 then refer to OPENPAYG documentation
   * @param mode - whether the token is add time or set time
   * @returns the 9 digit token (15 digits in restricted digit set mode)
   */
  generateTokenForValue(value: number, mode: TokenType = TOKEN_TYPE_ADD_TIME): string {
    if (
      !Number.isInteger(value) ||
      (value > MAX_ACTIVATION_VALUE &&
        value !== PAYG_DISABLE_VALUE &&
        value !== COUNTER_SYNC_VALUE) ||
      value < 0
    ) {
      throw Error(
        `INVALID VALUE: must be 0-${MAX_ACTIVATION_VALUE}, ${PAYG_DISABLE_VALUE} or ${COUNTER_SYNC_VALUE}`,
      );
    }

    const printMode = mode === TOKEN_TYPE_ADD_TIME ? "ADD_TIME" : "SET_TIME";
    this.logger(
      `starting code: ${this.startingCode}, value: ${value}, token_count: ${this.count}, mode: ${printMode}`,
    );

    const { finalToken, newCount } = encode(this.key, this.startingCode, value, this.count, mode);
    this.count = newCount;

    return this.restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 30) : finalToken;
  }

  /**
   * @param value - value to encode (0-999999), extended tokens carry
   *   device-specific data and have no add/set time modes
   * @returns the 12 digit token (20 digits in restricted digit set mode)
   */
  generateExtendedTokenForValue(value: number): string {
    if (!Number.isInteger(value) || value < 0 || value > EXTENDED_MAX_ACTIVATION_VALUE) {
      throw Error(`INVALID VALUE: must be 0-${EXTENDED_MAX_ACTIVATION_VALUE}`);
    }

    this.logger(`starting code: ${this.startingCode}, value: ${value}, token_count: ${this.count}`);

    const { finalToken, newCount } = encodeExtended(this.key, this.startingCode, value, this.count);
    this.count = newCount;

    return this.restrictedDigitSet ? convertTo4DigitToken(Number(finalToken), 40) : finalToken;
  }
}
