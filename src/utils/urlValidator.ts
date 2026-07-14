const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED_ALIASES = new Set(['shorten', 'api', 'health', 'stats', 'favicon.ico', 'static']);

export function isValidUrl(input: string): boolean {
  if (typeof input !== 'string' || input.trim().length === 0) return false;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;

  return true;
}

export function isValidAlias(alias: string): boolean {
  if (typeof alias !== 'string') return false;
  return ALIAS_PATTERN.test(alias) && !RESERVED_ALIASES.has(alias.toLowerCase());
}
