import { normalizeUrl } from '../../src/utils/normalizeUrl';

describe('normalizeUrl', () => {
  it('lowercases the hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.com/Path')).toBe('https://example.com/Path');
  });

  it('strips default ports', () => {
    expect(normalizeUrl('http://example.com:80/x')).toBe('http://example.com/x');
    expect(normalizeUrl('https://example.com:443/x')).toBe('https://example.com/x');
  });

  it('keeps non-default ports', () => {
    expect(normalizeUrl('http://example.com:8080/x')).toBe('http://example.com:8080/x');
  });

  it('treats a bare root path the same as no path', () => {
    expect(normalizeUrl('https://example.com/')).toBe(normalizeUrl('https://example.com'));
  });

  it('strips the fragment', () => {
    expect(normalizeUrl('https://example.com/path#section')).toBe('https://example.com/path');
  });

  it('treats equivalent URLs as identical after normalization', () => {
    const a = normalizeUrl('https://EXAMPLE.com:443/docs/');
    const b = normalizeUrl('https://example.com/docs/');
    expect(a).toBe(b);
  });
});
