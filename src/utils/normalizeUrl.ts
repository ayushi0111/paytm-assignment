/**
 * Produces a canonical form of a URL used only as the dedupe lookup key.
 * The original, user-submitted URL is always stored and redirected to
 * verbatim - this function never touches that copy.
 */
export function normalizeUrl(input: string): string {
  const url = new URL(input);

  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }

  url.hash = '';

  return url.toString();
}
