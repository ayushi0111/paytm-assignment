import { encodeBase62, decodeBase62 } from '../../src/utils/base62';

describe('base62', () => {
  it('encodes 0 as the first alphabet character', () => {
    expect(encodeBase62(0)).toBe('0');
  });

  it('round-trips a range of integers', () => {
    for (const n of [0, 1, 61, 62, 123, 999999, 1_000_000, 56800235583]) {
      expect(decodeBase62(encodeBase62(n))).toBe(n);
    }
  });

  it('produces distinct codes for distinct consecutive ids (no collisions)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const code = encodeBase62(i);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });

  it('produces only URL-safe characters', () => {
    for (const n of [0, 61, 62, 3843, 1_000_000_000]) {
      expect(encodeBase62(n)).toMatch(/^[0-9a-zA-Z]+$/);
    }
  });

  it('rejects negative numbers and non-integers', () => {
    expect(() => encodeBase62(-1)).toThrow();
    expect(() => encodeBase62(1.5)).toThrow();
  });

  it('rejects invalid characters when decoding', () => {
    expect(() => decodeBase62('abc!')).toThrow();
  });
});
