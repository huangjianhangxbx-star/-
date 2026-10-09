import type { PresetUserValues } from '../core/compose-preset.ts';

export type DraftMode = 'preset' | 'custom';
export type RequirementLevel = 'hard' | 'preferences' | 'creativeFreedom';
export type DraftField = Exclude<keyof PresetUserValues, 'references' | 'requirements'>;
export type BridgeValues = Partial<Omit<PresetUserValues, 'references'>>;

export class DraftModel {
  mode: DraftMode = 'preset';
  revision = 0;
  private previewRevision: number | null = null;
  private customInitialized = false;
  private readonly drafts: Record<DraftMode, BridgeValues> = { preset: {}, custom: {} };

  get exportRevision(): number | null { return this.previewRevision; }

  setMode(mode: DraftMode): void {
    if (mode === this.mode) return;
    if (mode === 'custom' && !this.customInitialized) {
      this.drafts.custom = { ...this.drafts.preset };
      delete this.drafts.custom.requirements;
      this.customInitialized = true;
    }
    this.mode = mode;
    this.invalidate();
  }

  setField(field: DraftField, value: PresetUserValues[DraftField] | undefined): void {
    const draft = this.drafts[this.mode];
    if (value === undefined) {
      if (!Object.hasOwn(draft, field)) return;
      delete draft[field];
    } else {
      if (Object.is(draft[field], value)) return;
      (draft as Record<string, unknown>)[field] = value;
    }
    this.invalidate();
  }

  addRequirement(level: RequirementLevel, text: string): void {
    this.requirements(level).push(text);
    this.invalidate();
  }

  setRequirement(level: RequirementLevel, index: number, text: string): void {
    const list = this.requirements(level);
    if (index < 0 || index >= list.length || list[index] === text) return;
    list[index] = text;
    this.invalidate();
  }

  removeRequirement(level: RequirementLevel, index: number): void {
    const list = this.requirements(level);
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    this.invalidate();
  }

  moveRequirement(level: RequirementLevel, index: number, direction: -1 | 1): void {
    const list = this.requirements(level);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.invalidate();
  }

  valuesForBridge(): BridgeValues {
    const draft = { ...this.drafts[this.mode] };
    if (this.mode === 'preset') {
      delete draft.requirements;
      return draft;
    }
    const requirements = draft.requirements;
    return { ...draft, requirements: {
      hard: [...(requirements?.hard ?? [])],
      preferences: [...(requirements?.preferences ?? [])],
      creativeFreedom: [...(requirements?.creativeFreedom ?? [])],
    } };
  }

  acceptPreview(revision: number): boolean {
    if (revision !== this.revision) return false;
    this.previewRevision = revision;
    return true;
  }

  invalidate(): void {
    this.revision += 1;
    this.previewRevision = null;
  }

  private requirements(level: RequirementLevel): string[] {
    const draft = this.drafts.custom;
    draft.requirements ??= {};
    return (draft.requirements[level] ??= []);
  }
}
