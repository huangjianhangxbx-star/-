export interface TrackEvent {at: number; kind: string}
export class AttackInput {
  held = false;
  deadline = -Infinity;
  requestId = 0;
  constructor(readonly lifetime: number) {
    if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error('Invalid input lifetime');
  }
  press(now: number): void {
    if (this.held) return;
    this.held = true;
    this.deadline = now + this.lifetime;
    this.requestId++;
  }
  release(): void {this.held = false;}
  accept(): void {this.deadline = -Infinity;}
  clear(): void {this.release(); this.accept();}
  request(now: number): boolean {return this.held || now < this.deadline;}
}
export class EventTrack {
  time = 0;
  finished = false;
  private cursor = 0;
  private canceled = false;
  private readonly events: TrackEvent[];
  constructor(events: readonly TrackEvent[], readonly duration: number, readonly generation: number, readonly rate = 1) {
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isInteger(generation) || generation < 1 ||
        events.some(e => !Number.isFinite(e.at) || e.at < 0 || e.at > duration || !e.kind)) throw new Error('Invalid event track');
    this.events = events.map(e => ({...e})).sort((a,b) => a.at-b.at);
  }
  advance(delta: number, generation: number): TrackEvent[] {
    if (!Number.isFinite(delta) || delta < 0) throw new Error('Invalid simulation delta');
    if (this.canceled || this.finished || generation !== this.generation || delta === 0) return [];
    this.time = Math.min(this.duration, this.time + delta * this.rate);
    const crossed: TrackEvent[] = [];
    while (this.cursor < this.events.length && this.events[this.cursor].at <= this.time + 1e-10) crossed.push(this.events[this.cursor++]);
    this.finished = this.time >= this.duration;
    return crossed;
  }
  cancel(): void {this.canceled = true;}
}
