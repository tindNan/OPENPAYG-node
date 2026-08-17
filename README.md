# DOC

This is a nodejs implementation of the python example provided in https://github.com/EnAccess/OpenPAYGO-Token.
In case of anything please feel free to open an issue.

## USAGE

```sh
node simulation.js <number of tokens to generate>   # server -> meter round trip demo
npm test                                            # runs the spec test vectors (node:test, Node 18+)
```

## REFERENCE DOCUMENTATION

1. [OPENPAYG Token general documentation](https://github.com/EnAccess/OpenPAYGO/blob/master/documentation/general_documentation.pdf)
2. [OPENPAYG Token example documentation](https://github.com/EnAccess/OpenPAYGO-Token/blob/master/documentation/example_implementation_documentation.pdf)

## CHANGES FROM THE REFERENCE IMPLEMENTATION

Per the Apache 2.0 license of the OpenPAYGO Token project, changes relative to the
official Python reference implementation are documented here:

- Standard 9 digit tokens are byte-for-byte compatible with the reference
  (verified against the official scenario 1 test vectors in `test/openpaygo.test.js`).
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
