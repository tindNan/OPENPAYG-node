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

1. [OpenPAYGO documentation site](https://enaccess.github.io/OpenPAYGO-docs/docs/openpaygo-token/introduction)
2. [OPENPAYG Token general documentation (PDF)](https://github.com/EnAccess/OpenPAYGO-Token/blob/main/documentation/general_documentation.pdf)
3. [OPENPAYG Token example documentation (PDF)](https://github.com/EnAccess/OpenPAYGO-Token/blob/main/documentation/example_implementation_documentation.pdf)

## INTEROPERABILITY

Interoperability with the current official implementations
([OpenPAYGO-python](https://github.com/EnAccess/OpenPAYGO-python),
[OpenPAYGO-js](https://github.com/EnAccess/OpenPAYGO-js)) is locked in by test:

- The official 80-vector interop corpus (`test/vectors/sample_tokens.json`,
  copied verbatim from the official repositories) passes in both the encode and
  decode directions — standard, extended, and restricted digit set variants
  (`test/interop.test.ts`).
- The documentation's scenario 1 test procedure passes end to end
  (`test/openpaygo.test.ts`).

Like the current official implementations, extended (12 digit) tokens use the
same parity-based count scheme as standard tokens, and the counter sync
validity window is `MAX_TOKEN_JUMP` (64) counts below the device count.

## SPEC EVOLUTION: 2019 REFERENCE VS CURRENT ECOSYSTEM

The published documentation (PDFs and docs site) still describes the 2019
reference implementation ([OpenPAYGO-Token](https://github.com/EnAccess/OpenPAYGO-Token)),
but the current official libraries (OpenPAYGO-python, OpenPAYGO-js) — which
generate the shared interop test vectors — have evolved past it in several
places. This library follows the **current ecosystem** behaviour. The
differences that matter for interoperability:

| Behaviour | 2019 reference | Current ecosystem (this library) |
| --- | --- | --- |
| Extended (12 digit) token counts | `count + 1` per token, no Add/Set modes | Same parity scheme as standard tokens: Add Time on even counts, Set Time / Disable / Sync on odd counts |
| Extended token replay protection | Simple `count > lastCount` check; decoder stored `count - 1`, which re-accepted replayed tokens | Full `countIsValid` + used-counts tracking, identical to the standard path |
| Extended decode search window | Fixed 0–30 counts from zero (broke once the device count passed 29) | `lastCount + MAX_TOKEN_JUMP + 1`, like standard tokens |
| Counter sync validity window | Hardcoded `lastCount - 30` | `lastCount - MAX_TOKEN_JUMP` (64) |
| Starting code | Always explicitly assigned per device | Optionally derived from the key: `generateStartingCode(key)` = the token-conversion of `siphash(key, key_bytes)` |
| Token type identifiers | `SET_TIME = 1`, `ADD_TIME = 2` (what this library exports) | `ADD_TIME = 1`, `SET_TIME = 2`, plus `DISABLE_PAYG`/`COUNTER_SYNC`/`INVALID`/`ALREADY_USED` |

On the last row: the numeric identifiers never appear in tokens — only count
*parity* is on the wire, and both generations agree on it (Add Time = even).
Compare decoded results against this library's exported `TOKEN_TYPE_*`
constants, never against literal numbers from another library.

Values `998` (disable PAYG) and `999` (counter sync) keep their meaning in
extended tokens too — the ecosystem did not move them to 6 digit equivalents.

## JAVASCRIPT PORTING NOTES: ENDIANNESS AND OTHER FOOTGUNS

The reference implementation is Python, where integers are arbitrary-precision
and `bytes` are explicit. Porting the algorithm to JavaScript crosses several
traps; these are the ones that actually bite (some have bitten the official
JS library), and how this codebase handles them.

**Message bytes are big-endian, key words are little-endian.** The SipHash
*message* is the token packed big-endian (Python `struct.pack(">L", token)`
duplicated to 8 bytes; 8 byte `">Q"` for extended). But siphash-js consumes the
*key* as four uint32 words read **little**-endian from the 16 key bytes. Mixing
these up produces valid-looking tokens that no other implementation accepts.
`keyFromHex` packs LE (`getUint32(i * 4, true)`); the token buffers are written
BE (`setUint32(offset, value, false)`).

**Never use `new Uint32Array(buffer)` to read protocol data.** Typed-array
views use the *platform's* byte order (little-endian on every mainstream CPU,
but not guaranteed). `DataView` with an explicit endianness flag is the
portable way to express what the spec means. (OpenPAYGO-js reads its key with
`new Uint32Array(buf)` — it works on common hardware by coincidence, not by
contract.)

**JS bitwise operators are signed 32-bit.** The spec's 29.5-bit mask,
`((1 << (32 - 2 + 1)) - 1) << 2`, is `0x1FFFFFFFC` in Python but overflows to
`-4` in JavaScript (`1 << 31` is already negative). The expression still works
here — but only because the subsequent `&` also truncates to 32 bits, so the
wrong intermediate collapses to the right answer. Any bit manipulation that
must be unsigned has to end in `>>> 0` (see `(high ^ low) >>> 0` in
`generateNextToken`); forgetting it yields negative "tokens".

**32-bit writes throw beyond 2³², doubles lie beyond 2⁵³.** A 12 digit
extended token does not fit `setUint32`/`writeUInt32BE` — the write throws (the
official JS library's extended decode currently crashes exactly this way).
The 64-bit SipHash output doesn't fit a JS number at all: reassembling it as
`Number` silently loses low bits above 2⁵³. The extended path therefore stays
in `BigInt` end to end: `setBigUint64` for the message, and
`(BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)` — with the inner `>>> 0`
first, because siphash-js word halves are 32-bit values that must be made
unsigned *before* they are widened.

**Strings are not bytes.** Hashing a hex *string* hashes its UTF-8 characters,
not the 16 bytes it spells. This is why `generateStartingCode` here follows the
Python implementation (hash of the decoded key bytes, verified equal against
it) rather than OpenPAYGO-js, whose starting-code derivation hashes the hex
string itself and disagrees with the Python-generated test vectors.

**Sanity anchor.** When touching any of this, the official interop corpus
(`npm test`, `test/interop.test.ts`) is the ground truth: 80 tokens generated
by the reference implementation must survive both directions bit-for-bit.

## CHANGES FROM THE REFERENCE IMPLEMENTATION

Per the Apache 2.0 license of the OpenPAYGO Token project, changes relative to the
official implementations are documented here:

- The invalid-token waiting period (1 minute doubling to a 512 minute cap) is
  implemented in `Meter` as recommended by the documentation's Security
  Considerations (the official libraries leave it to the integrator).
- `decodeToken` only applies `valueDivider` to real activation values — the
  reserved values 998 (disable) and 999 (counter sync) are returned unscaled so
  they remain recognisable signals.
- `generateStartingCode` follows the Python implementation (hash of the raw
  16 key bytes), which is the behaviour the official test vectors were
  generated with.
