import { checkUrlReachable } from '../../src/utils/checkUrlReachable';

describe('checkUrlReachable', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('treats any HTTP response, even a non-2xx status, as reachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 404 }) as unknown as typeof fetch;
    await expect(checkUrlReachable('https://example.com/missing')).resolves.toBe(true);
  });

  it('treats a network-level failure as unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as unknown as typeof fetch;
    await expect(checkUrlReachable('https://does-not-exist.invalid')).resolves.toBe(false);
  });

  it('treats a timeout (abort) as unreachable', async () => {
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('aborted')), 5))
    ) as unknown as typeof fetch;
    await expect(checkUrlReachable('https://example.com/slow', 1)).resolves.toBe(false);
  });
});
