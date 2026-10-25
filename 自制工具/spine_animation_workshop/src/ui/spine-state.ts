/** Keeps an async generation tied to the exact UI revision that started it. */
export type SpineGeneratedOutput = {
  jsonText: string;
  name: string;
  sourceResourceId: string;
  targetResourceId: string;
  reportText?: string;
};

export class SpineGenerationGate {
  private revision = 0;
  private currentOutput: SpineGeneratedOutput | null = null;

  get output(): SpineGeneratedOutput | null { return this.currentOutput; }

  begin(): number { return this.revision; }

  invalidate(): void {
    this.revision++;
    this.currentOutput = null;
  }

  commit(startedAtRevision: number, output: SpineGeneratedOutput): boolean {
    if (startedAtRevision !== this.revision) return false;
    this.currentOutput = output;
    return true;
  }
}

/** Consume a saved mapping once when both skeletons are available. */
export class PendingSpineConfig<T> {
  private pending: T | null = null;

  stage(config: T): void { this.pending = config; }

  take(check: (config: T) => void, draft: () => T): { config: T; rejected?: unknown } {
    const queued = this.pending;
    this.pending = null;
    if (queued === null) return { config: draft() };
    try {
      check(queued);
      return { config: queued };
    } catch (rejected) {
      return { config: draft(), rejected };
    }
  }
}
