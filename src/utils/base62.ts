const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length;

/**
 * Encodes a non-negative integer as a base62 string. Because this is a
 * straight positional-numeral-system conversion, it is a bijection: distinct
 * integers always produce distinct strings, and every string decodes back to
 * exactly one integer. Collision-freedom therefore follows from the
 * uniqueness of the input id, not from randomness or luck.
 */
export function encodeBase62(num: number): string {
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`encodeBase62 expects a non-negative integer, got ${num}`);
  }
  if (num === 0) return ALPHABET[0];

  let n = num;
  let result = '';
  while (n > 0) {
    result = ALPHABET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }
  return result;
}

export function decodeBase62(str: string): number {
  let result = 0;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid base62 character: ${ch}`);
    }
    result = result * BASE + idx;
  }
  return result;
}
