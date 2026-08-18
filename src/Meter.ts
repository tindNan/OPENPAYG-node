import { debuglog } from "node:util";

import {
  STARTING_COUNT,
  KEY,
  COUNTER_SYNC_VALUE,
  MAX_UNUSED_OLDER_TOKENS,
  TOKEN_TYPE_ADD_TIME,
  PAYG_DISABLE_VALUE,
  MAX_ACTIVATION_VALUE,
  TOKEN_TYPE_SET_TIME,
  TIME_DIVIDER,
  type Logger,
  type SipHashKey,
  type TokenType,
} from "./constants.ts";

import { decode, type DecodeResult } from "./decode.ts";
import { generateStartingCode } from "./generateNextToken.ts";
import { convertFrom4DigitToken } from "./utils.ts";

// waiting period after invalid tokens: 1 minute doubling up to 512 minutes (~8h)
const WAITING_PERIOD_BASE_MINUTES = 1;
const WAITING_PERIOD_MAX_MINUTES = 512;

export interface MeterOptions {
  /** the device's 9 digit starting code; derived from the key if omitted */
  startingCode?: number;
  /** siphash key (4 x uint32), see keyFromHex */
  key?: SipHashKey;
  /** the device's initial token count */
  startingCount?: number;
  /** division factor applied to activation values */
  timeDivider?: number;
  /** lock token entry after invalid tokens (default true) */
  waitingPeriodEnabled?: boolean;
  /** tokens are entered using only digits 1-4 (default false) */
  restrictedDigitSet?: boolean;
  /**
   * log sink (e.g. console.log or a pino method);
   * defaults to util.debuglog, enabled by running with NODE_DEBUG=openpaygo
   */
  logger?: Logger;
}

export class Meter {
  startingCode: number;
  key: SipHashKey;
  timeDivider: number;
  paygEnabled = true;
  invalidTokenCount = 0;
  usedCounts: number[] = [];
  count: number;
  waitingPeriodEnabled: boolean;
  restrictedDigitSet: boolean;
  /** UNIX ms until which token entry is refused */
  tokenEntryLockedUntil = 0;
  /** UNIX ms */
  expirationDate: number;
  logger: Logger;

  constructor({
    key = KEY,
    startingCode = generateStartingCode(key),
    startingCount = STARTING_COUNT,
    timeDivider = TIME_DIVIDER,
    waitingPeriodEnabled = true,
    restrictedDigitSet = false,
    logger = debuglog("openpaygo"),
  }: MeterOptions = {}) {
    this.logger = logger;
    this.startingCode = startingCode;
    this.key = key;
    this.timeDivider = timeDivider;
    this.count = startingCount;
    this.waitingPeriodEnabled = waitingPeriodEnabled;
    this.restrictedDigitSet = restrictedDigitSet;
    this.expirationDate = Date.now();
  }

  enterToken(token: string | number): DecodeResult {
    if (this.#isLocked()) {
      const minutesLeft = Math.ceil((this.tokenEntryLockedUntil - Date.now()) / 60000);
      this.logger(`TOKEN ENTRY LOCKED, TRY AGAIN IN ${minutesLeft} MINUTE(S)`);
      return { value: null, count: null, type: null };
    }

    if (this.restrictedDigitSet) {
      token = convertFrom4DigitToken(token);
    }

    const result = decode(token, this.startingCode, this.key, this.count, this.usedCounts);

    if (!this.#isValidToken(result)) {
      return result;
    }

    const { value, count, type } = result;

    if (count > this.count || value === COUNTER_SYNC_VALUE) {
      this.count = count;
    }

    this.#updateUsedCounts(value, count, type);
    this.invalidTokenCount = 0;
    this.tokenEntryLockedUntil = 0;
    this.#updateMeterStatus(value, type);
    return result;
  }

  #isLocked(): boolean {
    return this.waitingPeriodEnabled && Date.now() < this.tokenEntryLockedUntil;
  }

  /** narrows the decode result to the valid-token branch */
  #isValidToken(result: DecodeResult): result is Extract<DecodeResult, { count: number }> {
    this.logger("processing decoded token");
    // there could be value = 0, so we discriminate on count
    if (result.count !== null) {
      this.logger("VALID TOKEN");
      return true;
    }

    if (result.value === -2) {
      this.logger("OLD TOKEN");
      return false;
    }

    this.logger("TOKEN INVALID");
    this.invalidTokenCount++;
    this.#startWaitingPeriod();
    return false;
  }

  #startWaitingPeriod(): void {
    if (!this.waitingPeriodEnabled) {
      return;
    }

    const minutes = Math.min(
      WAITING_PERIOD_BASE_MINUTES * 2 ** (this.invalidTokenCount - 1),
      WAITING_PERIOD_MAX_MINUTES,
    );
    this.tokenEntryLockedUntil = Date.now() + minutes * 60 * 1000;
  }

  #updateUsedCounts(tokenValue: number, newCount: number, tokenType: TokenType): void {
    let highestCount = Math.max(...this.usedCounts, 0);

    if (newCount > highestCount) {
      highestCount = newCount;
    }

    const bottomRange = highestCount - MAX_UNUSED_OLDER_TOKENS;
    const newUsedCounts: number[] = [];

    if (
      tokenType !== TOKEN_TYPE_ADD_TIME ||
      tokenValue === COUNTER_SYNC_VALUE ||
      tokenValue === PAYG_DISABLE_VALUE
    ) {
      // if it is not an add time token, we mark all the past tokens as used in the range
      for (let count = bottomRange; count < highestCount + 1; count++) {
        newUsedCounts.push(count);
      }
    } else {
      for (let count = bottomRange; count < highestCount + 1; count++) {
        if (count === newCount || this.usedCounts.includes(count)) {
          newUsedCounts.push(count);
        }
      }
    }

    this.usedCounts = newUsedCounts;
  }

  #updateMeterStatus(tokenValue: number, tokenType: TokenType): void {
    if (tokenValue <= MAX_ACTIVATION_VALUE) {
      if (!this.paygEnabled && tokenType === TOKEN_TYPE_SET_TIME) {
        this.paygEnabled = true;
      }
      if (this.paygEnabled) {
        this.#updateMeterExpirationDate(tokenValue, tokenType);
      }
    } else if (tokenValue === PAYG_DISABLE_VALUE) {
      this.paygEnabled = false;
    } else if (tokenValue === COUNTER_SYNC_VALUE) {
      // count was already synced in enterToken
      this.logger("METER COUNTER SYNCED");
    } else {
      // values 996 and 997 are reserved for future extensions
      this.logger("RESERVED VALUE, NO STATUS CHANGE");
    }
  }

  #updateMeterExpirationDate(tokenValue: number, tokenType: TokenType): void {
    const now = Date.now();
    const numDays = tokenValue / this.timeDivider;
    const msToAdd = numDays * 24 * 60 * 60 * 1000;

    if (tokenType === TOKEN_TYPE_SET_TIME) {
      this.expirationDate = now + msToAdd;
    } else {
      this.expirationDate =
        this.expirationDate < now ? now + msToAdd : this.expirationDate + msToAdd;
    }
  }
}
