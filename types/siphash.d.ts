// the siphash package is untyped CommonJS with a non-standard export wrapper,
// so named exports are not reliably detected by node's ESM interop — always
// use the default import with this shape
declare module "siphash" {
  interface SipHash {
    hash(key: ArrayLike<number>, message: Uint8Array | string): { h: number; l: number };
    hash_hex(key: ArrayLike<number>, message: Uint8Array | string): string;
    hash_uint(key: ArrayLike<number>, message: Uint8Array | string): number;
    string16_to_key(str: string): Uint32Array;
    string_to_u8(str: string): Uint8Array;
  }

  const siphash: SipHash;
  export default siphash;
}
