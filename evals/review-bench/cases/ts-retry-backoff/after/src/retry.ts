const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` up to `attempts` times, waiting `baseMs`, then twice as long, between
 * attempts; the last error is rethrown unchanged.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 100): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastError;
}
