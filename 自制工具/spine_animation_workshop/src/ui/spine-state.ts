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
