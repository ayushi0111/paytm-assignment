const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Best-effort reachability probe for a shorten-time warning (not a hard
 * validation gate). Any actual HTTP response - even a 404 or 500 - counts as
 * reachable, since the server exists and answered; only a network-level
 * failure (DNS failure, connection refused, timeout) is treated as
 * unreachable. Callers must never let a `false` block link creation, only
 * attach a non-fatal warning.
 */
export async function checkUrlReachable(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
