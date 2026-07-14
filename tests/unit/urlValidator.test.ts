import { isValidUrl, isValidAlias } from '../../src/utils/urlValidator';

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('mailto:a@b.com')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('   ')).toBe(false);
  });
});

describe('isValidAlias', () => {
  it('accepts alphanumeric aliases with dashes/underscores', () => {
    expect(isValidAlias('my-link_1')).toBe(true);
    expect(isValidAlias('abc')).toBe(true);
  });

  it('rejects aliases outside the length bounds', () => {
    expect(isValidAlias('ab')).toBe(false);
    expect(isValidAlias('a'.repeat(33))).toBe(false);
  });

  it('rejects aliases with unsafe characters', () => {
    expect(isValidAlias('has space')).toBe(false);
    expect(isValidAlias('slash/here')).toBe(false);
  });

  it('rejects reserved words regardless of case', () => {
    expect(isValidAlias('shorten')).toBe(false);
    expect(isValidAlias('API')).toBe(false);
    expect(isValidAlias('health')).toBe(false);
  });
});
