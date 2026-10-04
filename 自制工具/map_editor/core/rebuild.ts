/** One in-flight build; coalesce edits and retain every dirty chunk until accepted. */
export class RebuildQueue {
  revision = 0;
  running = false;
  latest: any;
  full = false;
  dirty = new Set<string>();
  generation = 0;
  inflight: any;
  sessionId?: string;
  send: (job: any) => void;
  apply: (result: any, doc: any, chunks?: Set<string>) => void;
  constructor(
    send: (job: any) => void,
    apply: (result: any, doc: any, chunks?: Set<string>) => void,
    sessionId?: string,
  ) {
    this.send = send;
    this.apply = apply;
    this.sessionId=sessionId;
  }
  request(doc: any, chunks?: Set<string>) {
    this.latest = doc;
    this.revision++;
    if (!chunks) this.full = true;
    else for (const c of chunks) this.dirty.add(c);
    if (!this.running) this.start();
  }
  /** Call before cancel, undo or loading another map: older work must never publish. */
  invalidate() {
    this.generation++;
  }
  start() {
    this.running = true;
    this.inflight = {
      revision: this.revision,
      doc: this.latest,
      chunks: this.full ? null : [...this.dirty],
      generation: this.generation,
      sessionId: this.sessionId,
    };
    this.send(this.inflight);
  }
  receive(result: any) {
    const flight = this.inflight;
    if (!flight || result.revision !== flight.revision) return;
    if(this.sessionId!==undefined && (result.sessionId!==flight.sessionId || result.generation!==flight.generation))return;
    this.running = false;
    if (result.revision !== this.revision) {
      // Publish a coherent completed snapshot while the pointer remains down.
      // Invalidated strokes and replaced documents cannot paint stale geometry.
      if (!result.error && flight.generation === this.generation &&
          (flight.doc.mapId == null || flight.doc.mapId === this.latest.mapId))
        this.apply(result, flight.doc, flight.chunks == null ? undefined : new Set(flight.chunks));
      this.start();
      return;
    }
    if (!result.error && flight.generation === this.generation)
      this.apply(
        result,
        this.latest,
        this.full ? undefined : new Set(this.dirty),
      );
    this.full = false;
    this.dirty.clear();
  }
}
