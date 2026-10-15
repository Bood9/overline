/** Serialised, rate-limited access to a host, with backoff when it pushes back. */
export class HostThrottle {
  private queue: Promise<unknown> = Promise.resolve();
  private nextAllowed = 0;
  private penaltyUntil = 0;
  private consecutiveBlocks = 0;

  constructor(private minGapMs: number, private name = 'host') {}

  get blockedFor(): number {
    return Math.max(0, this.penaltyUntil - Date.now());
  }

  /** Called when the host answered 403/429 — back off exponentially. */
  penalise() {
    this.consecutiveBlocks++;
    const minutes = Math.min(30, 2 ** Math.min(this.consecutiveBlocks, 5));
    this.penaltyUntil = Date.now() + minutes * 60_000;
    return minutes;
  }
  clear() {
    this.consecutiveBlocks = 0;
    this.penaltyUntil = 0;
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      if (this.blockedFor > 0) {
        throw new Error(`${this.name}: пауза после блокировки ещё ${Math.ceil(this.blockedFor / 1000)}с`);
      }
      const wait = this.nextAllowed - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.nextAllowed = Date.now() + this.minGapMs;
      return fn();
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
