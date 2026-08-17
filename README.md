# DOC

This is a nodejs implementation of the python example provided in https://github.com/EnAccess/OpenPAYGO-Token.
In case of anything please feel free to open an issue.

The library is written in strict TypeScript and ships as ESM with type
declarations. Node >= 22.18 is required (tests run the TypeScript sources
directly on Node's built-in type stripping; `npm run build` compiles `src/`
to `dist/` for publishing).

## USAGE

```sh
npm test                          # spec test vectors + end-to-end scenarios (node:test)
NODE_DEBUG=openpaygo npm test     # same, with the meter/server internal decisions logged
npm run typecheck                 # strict tsc, no emit
npm run build                     # compile src/ to dist/ (.js + .d.ts)
```

The end-to-end server -> meter flows (purchases, replays, corrections, counter
resync, extended tokens) live in `test/scenario.test.ts`.

## USAGE AS A LIBRARY

The package entry point exposes the spec contract at two levels. CommonJS
consumers on Node >= 22 can still `require()` the package via require(esm).

### Low-level pure functions

```ts
import { generateToken, decodeToken, keyFromHex, constants } from "openpayg-token-node";

const key = keyFromHex("a29ab82edc5fbbc41ec9530f6dac86b1"); // 16 byte device key as hex

// server side: generate a token, persist newCount for the device
const { token, newCount } = generateToken({
  key,
  startingCode: 123456789,
  value: 30, // days (0-995), 998 = disable PAYG, 999 = counter sync
  count: 0, // the device's current count on the server
  mode: constants.TOKEN_TYPE_ADD_TIME, // or TOKEN_TYPE_SET_TIME
});

// device side: decode and validate an entered token
const { value, count, type } = decodeToken({
  token,
  key,
  startingCode: 123456789,
  lastCount: 0, // the device's last known count
  usedCounts: [], // previously used counts, enables out-of-order add-time tokens
});
// value: the activation value, -2 for an already used token, null if invalid

// 12 digit extended tokens: generateExtendedToken / decodeExtendedToken
// tokens using only digits 1-4: pass restrictedDigitSet: true on both sides
```

### High-level stateful classes

```ts
import { Server, Meter, keyFromHex } from "openpayg-token-node";

const key = keyFromHex("a29ab82edc5fbbc41ec9530f6dac86b1");
const server = new Server({ startingCode: 123456789, key, startingCount: 0 });
// Meter tracks count, used counts, PAYG state and the waiting period after invalid tokens
const meter = new Meter({ startingCode: 123456789, key, startingCount: 0 });

const token = server.generateTokenForValue(30);
const { value } = meter.enterToken(token);
```

Both classes are silent by default. Their internal decisions are logged through
`util.debuglog`, so run with `NODE_DEBUG=openpaygo` to see them — or pass your own
sink via the `logger` option (`console.log`, a pino method, etc.):

```ts
import pino from "pino";
const log = pino();
const meter = new Meter({ startingCode: 123456789, key, logger: (msg) => log.debug(msg) });
```

## REFERENCE DOCUMENTATION

1. [OPENPAYG Token general documentation](https://github.com/EnAccess/OpenPAYGO/blob/master/documentation/general_documentation.pdf)
2. [OPENPAYG Token example documentation](https://github.com/EnAccess/OpenPAYGO-Token/blob/master/documentation/example_implementation_documentation.pdf)

## CHANGES FROM THE REFERENCE IMPLEMENTATION

Per the Apache 2.0 license of the OpenPAYGO Token project, changes relative to the
official Python reference implementation are documented here:

- Standard 9 digit tokens are byte-for-byte compatible with the reference
  (verified against the official scenario 1 test vectors in `test/openpaygo.test.ts`).
- Extended (12 digit) tokens follow the reference scheme (count increments by 1,
  no Add/Set Time modes), but the decoder searches counts up to
  `lastCount + MAX_TOKEN_JUMP` (like the standard scheme) instead of the reference's
  fixed 0-30 window, and stores the matched count directly rather than `count - 1`
  so replayed extended tokens are rejected.
- The invalid-token waiting period (1 minute doubling to a 512 minute cap) is
  implemented in `Meter` as recommended by the general documentation's
  Security Considerations.
- Restricted digit set mode (tokens using only digits 1-4) is supported by both
  `Server` and `Meter`.
