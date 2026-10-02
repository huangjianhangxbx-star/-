/** One in-flight build; coalesce edits and retain every dirty chunk until accepted. */
export class RebuildQueue {
  revision = 0;
  running = false;
  latest: any;
  full = false;
  dirty = new Set<string>();
  send: (job: any) => void;
  apply: (result: any, doc: any, chunks?: Set<string>) => void;
  constructor(
    send: (job: any) => void,
    apply: (result: any, doc: any, chunks?: Set<string>) => void,
  ) {
    this.send = send;
    this.apply = apply;
  }
  request(doc: any, chunks?: Set<string>) {
    this.latest = doc;
    this.revision++;
    if (!chunks) this.full = true;
    else for (const c of chunks) this.dirty.add(c);
    if (!this.running) this.start();
  }
  start() {
    this.running = true;
    this.send({
      revision: this.revision,
      doc: this.latest,
      chunks: this.full ? null : [...this.dirty],
    });
  }
  receive(result: any) {
    this.running = false;
    if (result.revision !== this.revision) {
      this.start();
      return;
    }
    if (!result.error)
      this.apply(
        result,
        this.latest,
        this.full ? undefined : new Set(this.dirty),
      );
    this.full = false;
    this.dirty.clear();
  }
}
