export class Cooldown {
  private readonly last = new Map<string, number>();

  constructor(
    private readonly windowMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  tryAcquire(userId: string): boolean {
    const now = this.clock();
    this.sweep(now);
    const previous = this.last.get(userId);
    if (previous !== undefined && now - previous < this.windowMs) {
      return false;
    }
    this.last.set(userId, now);
    return true;
  }

  private sweep(now: number): void {
    if (this.last.size < 500) return;
    for (const [userId, at] of this.last) {
      if (now - at >= this.windowMs) {
        this.last.delete(userId);
      }
    }
  }
}
