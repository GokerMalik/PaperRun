export const MM_PER_CSS_PIXEL = 25.4 / 96;
export type Sample = { seconds: number; mm: number };
export class Run {
  distance = 0;
  startedAt: number | null = null;
  finishedAt: number | null = null;
  paused = true;
  lastSide: number | null = null;
  stroke: { id: number; side: number; lastY: number; moved: boolean } | null = null;
  splits: { page: number; seconds: number; mm: number }[] = [];
  samples: Sample[] = [{ seconds: 0, mm: 0 }];
  heights: number[];
  constructor(heights: number[]) { this.heights = heights; }
  get total() { return this.heights.reduce((a,b) => a+b,0); }
  // Callers supply wall-clock milliseconds so phone sleep and background time count.
  time(now: number) { return this.startedAt === null ? 0 : Math.max(0, (this.finishedAt ?? now) - this.startedAt); }
  resume(now: number) {
    if (this.finishedAt !== null || this.distance >= this.total) return;
    if (this.startedAt === null) this.startedAt = now;
    this.paused = false;
    this.sample(now);
  }
  pause(now: number) { this.sample(now); this.paused = true; this.end(); }
  begin(id: number, side: number, y: number) {
    if (this.startedAt === null || this.paused || this.finishedAt !== null || this.stroke || this.lastSide === side) return false;
    this.stroke = { id, side, lastY: y, moved: false }; return true;
  }
  move(id: number, y: number, now: number) {
    if (!this.stroke || this.stroke.id !== id || this.startedAt === null || this.paused || this.finishedAt !== null) return;
    const delta = y - this.stroke.lastY;
    if (delta <= 0) return;
    this.stroke.lastY = y;
    this.stroke.moved = true;
    this.advance(delta * MM_PER_CSS_PIXEL, now);
  }
  end(id?: number) {
    if (this.stroke && (id === undefined || this.stroke.id === id)) {
      if (this.stroke.moved) this.lastSide = this.stroke.side;
      this.stroke = null;
    }
  }
  advance(mm: number, now: number) {
    if (this.startedAt === null || this.paused || this.finishedAt !== null || !Number.isFinite(mm) || mm <= 0) return;
    this.distance = Math.min(this.total, this.distance + mm);
    const seconds = this.time(now) / 1000;
    let boundary = 0;
    this.heights.forEach((height, page) => {
      boundary += height;
      if (this.distance >= boundary - 1e-8 && this.splits.length === page) {
        const prior = this.splits.reduce((sum, split) => sum + split.seconds, 0);
        this.splits.push({ page: page + 1, seconds: seconds - prior, mm: height });
      }
    });
    this.sample(now);
    if (this.distance >= this.total) { this.finishedAt = now; this.pause(now); }
  }
  sample(now: number) {
    const sample = { seconds: this.time(now) / 1000, mm: this.distance };
    if (sample.seconds - this.samples[this.samples.length - 1].seconds >= .1 || this.distance >= this.total) this.samples.push(sample);
  }
  speed(now: number) {
    if (this.startedAt === null || this.paused || this.finishedAt !== null) return 0;
    const seconds = this.time(now) / 1000;
    const reference = this.samples.findLast(s => s.seconds <= seconds - .7) ?? this.samples[0];
    return seconds > reference.seconds ? (this.distance - reference.mm) / (seconds - reference.seconds) * .0036 : 0;
  }
}
export function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`;
}
