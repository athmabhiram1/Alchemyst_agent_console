export class SeqBuffer<T extends { seq: number }> {
  private buffered = new Map<number, T>();
  private next = 1;

  constructor(private readonly gapGuard = false) {}

  get lastProcessed(): number {
    return this.next - 1;
  }

  setNext(n: number): void {
    this.next = n;
  }

  hasGap(seen: number): boolean {
    return seen > this.next;
  }

  /**
   * Feed an event with a sequence number. Returns the batch of events that
   * became processable in strict sequence order (0, 1, or many).
   * Duplicates (seq already processed or buffered) are dropped.
   */
  feed(e: T): T[] {
    if (e.seq < this.next) return [];
    if (e.seq === this.next) {
      const out: T[] = [e];
      this.next += 1;
      while (this.buffered.has(this.next)) {
        const next = this.buffered.get(this.next)!;
        this.buffered.delete(this.next);
        out.push(next);
        this.next += 1;
      }
      return out;
    }
    if (!this.buffered.has(e.seq)) this.buffered.set(e.seq, e);
    return [];
  }

  get queuedCount(): number {
    return this.buffered.size;
  }
}
