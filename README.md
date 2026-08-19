# OpenPAYGO Token for Node.js

[![CI](https://github.com/tindNan/OPENPAYG-node/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/tindNan/OPENPAYG-node/actions/workflows/ci.yaml)
[![npm](https://img.shields.io/npm/v/openpayg-token-node)](https://www.npmjs.com/package/openpayg-token-node)

This library is an implementation of the OpenPAYGO Token system for Node.js.
The initial version was a port of the Python example in
https://github.com/EnAccess/OpenPAYGO-Token. If you find a problem, open an
issue on GitHub.

The code is strict TypeScript. The package is an ECMAScript module (ESM) and
includes type declarations. Node.js 22.18 or later is necessary. The tests run
the TypeScript source files directly.

## COMMANDS

```sh
npm test                          # run the spec test vectors and the end-to-end scenarios
NODE_DEBUG=openpaygo npm test     # run the tests and show the internal log messages
npm run typecheck                 # do a strict type check, without output files
npm run build                     # compile src/ into dist/ (.js and .d.ts files)
```

The file `test/scenario.test.ts` contains the end-to-end scenarios. These
scenarios show purchases, replayed tokens, corrections, counter
synchronisation, and extended tokens.

## HOW TO USE THE LIBRARY

The package gives you two levels of access. Node.js 22 or later can also load
the package with `require()`.

### Level 1: pure functions

```ts
import { generateToken, decodeToken, keyFromHex, constants } from "openpayg-token-node";

const key = keyFromHex("a29ab82edc5fbbc41ec9530f6dac86b1"); // 16 byte device key as hex

// server side: generate a token, then keep newCount for the device
const { token, newCount } = generateToken({
  key,
  startingCode: 123456789,
  value: 30, // days (0-995), 998 = disable PAYG, 999 = counter sync
  count: 0, // the current count of the device, kept on the server
  mode: constants.TOKEN_TYPE_ADD_TIME, // or TOKEN_TYPE_SET_TIME
});

// device side: decode a token and make sure that it is valid
const { value, count, type } = decodeToken({
  token,
  key,
  startingCode: 123456789,
  lastCount: 0, // the last known count of the device
  usedCounts: [], // counts used before; permits add-time tokens out of sequence
});
// value: the activation value, -2 for a used token, null for an invalid token
```

Use `generateExtendedToken` and `decodeExtendedToken` for 12 digit extended
tokens. Set `restrictedDigitSet: true` on the server and on the device for
tokens that use only the digits 1 to 4.

### Level 2: stateful classes

```ts
import { Server, Meter, keyFromHex } from "openpayg-token-node";

const key = keyFromHex("a29ab82edc5fbbc41ec9530f6dac86b1");
const server = new Server({ startingCode: 123456789, key, startingCount: 0 });
const meter = new Meter({ startingCode: 123456789, key, startingCount: 0 });

const token = server.generateTokenForValue(30);
const { value } = meter.enterToken(token);
```

The `Meter` class keeps the count, the used counts, the PAYG status, and the
waiting period after invalid tokens.

The two classes do not write log messages in normal operation. Set the
environment variable `NODE_DEBUG=openpaygo` to see the log messages. As an
alternative, supply your own log function with the `logger` option:

```ts
import pino from "pino";
const log = pino();
const meter = new Meter({ startingCode: 123456789, key, logger: (msg) => log.debug(msg) });
```

## REFERENCE DOCUMENTATION

1. [OpenPAYGO documentation site](https://enaccess.github.io/OpenPAYGO-docs/docs/openpaygo-token/introduction)
2. [OpenPAYGO Token general documentation (PDF)](https://github.com/EnAccess/OpenPAYGO-Token/blob/main/documentation/general_documentation.pdf)
3. [OpenPAYGO Token example documentation (PDF)](https://github.com/EnAccess/OpenPAYGO-Token/blob/main/documentation/example_implementation_documentation.pdf)

## INTEROPERABILITY

Tests make sure that this library agrees with the current official
implementations ([OpenPAYGO-python](https://github.com/EnAccess/OpenPAYGO-python)
and [OpenPAYGO-js](https://github.com/EnAccess/OpenPAYGO-js)):

- The official test corpus of 80 vectors is in
  `test/vectors/sample_tokens.json`. It is an exact copy from the official
  repositories. The file `test/interop.test.ts` encodes and decodes each
  vector. This includes the standard, extended, and restricted digit set
  variants.
- The file `test/openpaygo.test.ts` does the scenario 1 test procedure from
  the documentation.

This library uses the same rules as the current official implementations.
Extended (12 digit) tokens use the parity count scheme of standard tokens.
The counter sync window is `MAX_TOKEN_JUMP` (64) counts below the device
count.

## SPEC CHANGES: 2019 REFERENCE COMPARED WITH THE CURRENT ECOSYSTEM

The published documentation (the PDF files and the documentation site) shows
the 2019 reference implementation
([OpenPAYGO-Token](https://github.com/EnAccess/OpenPAYGO-Token)). The current
official libraries (OpenPAYGO-python and OpenPAYGO-js) changed some of that
behaviour. The official test vectors come from these current libraries. This
library obeys the current ecosystem behaviour. The table shows the differences
that have an effect on interoperability:

| Behaviour                        | 2019 reference                                                                                          | Current ecosystem (this library)                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Extended (12 digit) token counts | `count + 1` for each token, no Add/Set modes                                                            | The parity scheme of standard tokens: Add Time on even counts; Set Time, Disable, and Sync on odd counts |
| Extended token replay protection | Only a `count > lastCount` check; the decoder kept `count - 1`, thus it accepted a replayed token again | The full `countIsValid` check with used-counts records, the same as the standard path                    |
| Extended decode search window    | A fixed window of 0 to 30 counts from zero (this failed when the device count was more than 29)         | `lastCount + MAX_TOKEN_JUMP + 1`, the same as standard tokens                                            |
| Counter sync window              | A fixed `lastCount - 30`                                                                                | `lastCount - MAX_TOKEN_JUMP` (64)                                                                        |
| Starting code                    | Always set for each device                                                                              | Optional: `generateStartingCode(key)` calculates it from the key with `siphash(key, key_bytes)`          |
| Token type identifiers           | `SET_TIME = 1`, `ADD_TIME = 2` (this library exports these values)                                      | `ADD_TIME = 1`, `SET_TIME = 2`, and also `DISABLE_PAYG`, `COUNTER_SYNC`, `INVALID`, `ALREADY_USED`       |

Note: The token type identifiers are not part of the token. Only the count
parity is part of the token. The two generations agree on the parity (Add
Time = even). Compare decoded results with the `TOKEN_TYPE_*` constants that
this library exports. Do not compare them with number literals from a
different library.

Note: The values `998` (disable PAYG) and `999` (counter sync) have the same
meaning in extended tokens. The ecosystem did not replace them with 6 digit
values.

## PRECAUTIONS FOR JAVASCRIPT PORTS: BYTE ORDER AND INTEGER LIMITS

The reference implementation is Python. In Python, integers have no size
limit, and the `bytes` type is explicit. JavaScript is different in ways that
can cause incorrect tokens. The list below shows each risk and the applicable
part of this code. Some of these risks caused defects in the official
JavaScript library.

**CAUTION: The message bytes are big-endian, but the key words are
little-endian.** The SipHash message is the token in big-endian byte order
(Python `struct.pack(">L", token)`, copied to 8 bytes; `">Q"` for extended
tokens). But siphash-js reads the key as four uint32 words in little-endian
byte order. If you interchange the two byte orders, the tokens look correct
but no other implementation accepts them. The function `keyFromHex` writes the
key words little-endian (`getUint32(i * 4, true)`). The code writes the token
buffers big-endian (`setUint32(offset, value, false)`).

**CAUTION: Do not use `new Uint32Array(buffer)` to read protocol data.** A
typed array uses the byte order of the platform. This is little-endian on
usual hardware, but the language does not make sure of it. Use `DataView` with
an explicit byte order flag. (OpenPAYGO-js reads its key with
`new Uint32Array(buf)`. That is correct on usual hardware only by chance.)

**CAUTION: JavaScript bitwise operators use signed 32-bit integers.** The
29.5-bit mask from the spec, `((1 << (32 - 2 + 1)) - 1) << 2`, is
`0x1FFFFFFFC` in Python. In JavaScript the same expression overflows to `-4`,
because `1 << 31` is negative. The code here stays correct only because the
`&` operator that follows also cuts the value to 32 bits. Apply `>>> 0` to
each bit operation that must give an unsigned result. See
`(high ^ low) >>> 0` in `generateNextToken`. Without `>>> 0`, the result can
be a negative number.

**CAUTION: 32-bit writes fail above 2^32, and doubles lose precision above
2^53.** A 12 digit extended token is too large for `setUint32` or
`writeUInt32BE`. The write operation stops with an error. (The extended decode
in the official JavaScript library fails in this way.) The 64-bit SipHash
output is too large for a JavaScript number. If you make it a `Number`, the
low bits above 2^53 are lost without a warning. Because of this, the extended
path uses `BigInt` at each step: `setBigUint64` for the message, and
`(BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)` for the hash. Apply the
inner `>>> 0` first. The word halves from siphash-js are 32-bit values that
must become unsigned before you make them wider.

**CAUTION: A string is not a byte sequence.** If you hash a hex string, you
hash its UTF-8 characters, not the 16 bytes that the string specifies. For
this reason, `generateStartingCode` here agrees with the Python
implementation: it hashes the decoded key bytes. A test made sure that the two
give equal results. OpenPAYGO-js hashes the hex string itself, and its result
does not agree with the official test vectors.

Note: The official test corpus is the reference for all changes to this code.
Run `npm test`. The 80 vectors in `test/interop.test.ts` must encode and
decode with no differences.

## CHANGES FROM THE REFERENCE IMPLEMENTATION

The OpenPAYGO Token project uses the Apache 2.0 license. This license makes it
necessary to document changes. The changes in this library, compared with the
official implementations, are:

- The `Meter` class contains the waiting period for invalid tokens (1 minute,
  which becomes two times longer after each invalid token, to a maximum of 512
  minutes). The documentation recommends this in its Security Considerations.
  The official libraries do not contain it.
- `decodeToken` applies `valueDivider` only to real activation values. The
  reserved values 998 (disable) and 999 (counter sync) come back unchanged.
  Thus they stay identifiable as signals.
- `generateStartingCode` agrees with the Python implementation (a hash of the
  16 raw key bytes). The official test vectors use this behaviour.
