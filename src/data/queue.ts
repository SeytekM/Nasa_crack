/**
 * Tiny request queue: limits concurrency and retries transient failures with
 * exponential backoff + jitter. Validation errors (HTTP 4xx except 429) are
 * never retried.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.retryable;
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  return true; // network errors (TypeError: Failed to fetch) etc.
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 800;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err) || opts.signal?.aborted) throw err;
      const delay = base * 2 ** attempt * (0.75 + Math.random() * 0.5);
      attempt++;
      await sleep(delay, opts.signal);
    }
  }
}

export class RequestQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  private readonly concurrency: number;
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
