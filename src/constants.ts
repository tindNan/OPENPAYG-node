import siphash from "siphash";

export const MAX_BASE = 999;
export const MAX_EXTENDED_BASE = 999999;
export const MAX_ACTIVATION_VALUE = 995;
export const EXTENDED_MAX_ACTIVATION_VALUE = 999999;
export const PAYG_DISABLE_VALUE = 998;
export const COUNTER_SYNC_VALUE = 999;
export const TOKEN_VALUE_OFFSET = 1000;
export const EXTENDED_TOKEN_VALUE_OFFSET = 1000000;
export const TOKEN_TYPE_SET_TIME = 1;
export const TOKEN_TYPE_ADD_TIME = 2;
export const STARTING_CODE = 123456789;
export const EXTENDED_STARTING_CODE = 123456789123;
export const STARTING_COUNT = 1;
export const MAX_TOKEN_JUMP = 64;
export const MAX_TOKEN_JUMP_COUNTER_SYNC = 100;
export const MAX_UNUSED_OLDER_TOKENS = 8 * 2;
export const KEY = siphash.string16_to_key("This is the key!"); // <--------- you can replace 'This is the key'
export const TIME_DIVIDER = 1;

export type TokenType = typeof TOKEN_TYPE_SET_TIME | typeof TOKEN_TYPE_ADD_TIME;

/** siphash key: 4 x 32 bit unsigned integers, see keyFromHex */
export type SipHashKey = Uint32Array | readonly number[];

/** log sink for the internal decisions of Meter and Server */
export type Logger = (message: string) => void;
