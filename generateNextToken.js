const siphash = require('siphash');
const { convertTo30Bits } = require('./utils');

function generateNextToken(currentToken, key) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, currentToken, false);
  view.setUint32(4, currentToken, false);

  // the message should be an Uint8Array
  // ref: https://github.com/jedisct1/siphash-js/issues/5#issuecomment-486682407
  const messageBuffer = new Uint8Array(view.buffer);

  const { l: low, h: high } = siphash.hash(key, messageBuffer);

  /*
   * always end bitwise ops in JS with ">>> 0" in order to leave the number unsigned, otherwise you end up with
   * strange stuff.
   *
   * for more context please brush up on bitwise operations for javascript
   *
   * ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift
   * https://stackoverflow.com/questions/6798111/bitwise-operations-on-32-bit-unsigned-ints
   */
  const res = (high ^ low) >>> 0; // always end bitwise ops in JS with >>> 0 to treat it as unsigned, otherwise magic happens
  const token = convertTo30Bits(res);
  return token;
}

function generateNextExtendedToken(currentToken, key) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, currentToken, false); // TODO: consider if using setBigtUint64 is better

  const msgBuffer = new Uint8Array(view.buffer);

  return siphash.hash_uint(key, msgBuffer);
}

module.exports = {
  generateNextToken,
  generateNextExtendedToken,
}
