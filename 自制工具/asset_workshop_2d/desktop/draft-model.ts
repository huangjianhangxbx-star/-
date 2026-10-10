import type { PresetUserValues } from '../core/compose-preset.ts';
import { validateEnvironmentSelection } from '../core/environment-style.ts';
import type { EnvironmentStyleInput } from '../core/environment-style.ts';

export type DraftMode = 'preset' | 'custom';
export type RequirementLevel = 'hard' | 'preferences' | 'creativeFreedom';
export type ProjectStyleContract = {
  schemaVersion: '2dw-project-style/1'; name: string; summary: string;
  positiveRules: string[]; negativeRules: string[];
  toneBudget: { darkMaxTiers: number; lightMaxTiers: number };
  shapeLanguageRules: string[]; textureRules: string[]; renderingWarnings: string[];
};
export type TaskStyleDelta = {
  schemaVersion: '2dw-task-style-delta/1'; focus: string;
  mustPreserve: string[]; mustChange: string[]; localReferenceNote: string; avoid: string[];
  toneBudget?: { darkMaxTiers?: number; lightMaxTiers?: number };
};
type StyleValues = { projectStyleContract: ProjectStyleContract | null; taskStyleDelta: TaskStyleDelta | null };
export type DraftField = Exclude<keyof PresetUserValues, 'references' | 'requirements' | 'environmentStyle' | keyof StyleValues>;
export type BridgeValues = Partial<Omit<PresetUserValues, 'references' | keyof StyleValues>> & StyleValues;
type ModeDraft = Partial<Omit<PresetUserValues, 'references' | 'taskId' | 'title' | keyof StyleValues>>;

function copyVisibleDraft(draft: ModeDraft): ModeDraft {
  const copy = { ...draft };
  if (draft.requirements) {
    copy.requirements = {
      hard: [...(draft.requirements.hard ?? [])],
      preferences: [...(draft.requirements.preferences ?? [])],
      creativeFreedom: [...(draft.requirements.creativeFreedom ?? [])],
    };
  }
  return copy;
}

export class DraftModel {
  mode: DraftMode = 'preset';
  revision = 0;
  private previewRevision: number | null = null;
  private customInitialized = false;
  private taskId: string | undefined;
  private manualTitle: string | null = null;
  private projectStyleDefault: ProjectStyleContract | null = null;
  private projectStyleContract: ProjectStyleContract | null = null;
  private taskStyleDelta: TaskStyleDelta | null = null;
  private environmentStyle: EnvironmentStyleInput | null = null;
  projectStyleSource: 'default' | 'empty' | 'custom' = 'empty';
  private readonly drafts: Record<DraftMode, ModeDraft> = { preset: {}, custom: {} };

  get exportRevision(): number | null { return this.previewRevision; }
  get titleMode(): 'auto' | 'manual' { return this.manualTitle === null ? 'auto' : 'manual'; }
  get effectiveTitle(): string {
    if (this.manualTitle !== null) return this.manualTitle;
    const draft = this.drafts[this.mode];
    const description = (draft.description ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
    const characters = Array.from(description);
    const subject = characters.length > 28 ? `${characters.slice(0, 28).join('')}…` : description || '未描述素材';
    const dimension = (value: number | undefined): string =>
      value !== undefined && Number.isSafeInteger(value) && value > 0 ? String(value) : '?';
    const width = draft.widthPx;
    const height = draft.heightPx === undefined && draft.squareLocked ? width : draft.heightPx;
    const size = width === undefined && height === undefined ? '尺寸待定' : `${dimension(width)}×${dimension(height)} px`;
    const mode = this.mode === 'preset' ? '独立静态 PNG' : '自定义静态 PNG';
    return `${subject} · ${size} · ${mode}`;
  }

  setTaskId(id: string): void {
    if (!id.trim()) throw new TypeError('任务 ID 不可为空');
    if (id === this.taskId) return;
    this.taskId = id;
    this.invalidate();
  }

  setManualTitle(text: string): void {
    const title = text.trim();
    if (!title) { this.restoreAutoTitle(); return; }
    if (title === this.manualTitle) return;
    this.manualTitle = title;
    this.invalidate();
  }

  restoreAutoTitle(): void {
    if (this.manualTitle === null) return;
    this.manualTitle = null;
    this.invalidate();
  }

  setProjectStyleDefault(contract: ProjectStyleContract | null): void {
    this.projectStyleDefault = contract === null ? null : structuredClone(contract);
    this.useProjectStyleDefault();
  }

  useProjectStyleDefault(): void {
    this.projectStyleContract = this.projectStyleDefault === null ? null : structuredClone(this.projectStyleDefault);
    this.projectStyleSource = this.projectStyleDefault === null ? 'empty' : 'default';
    this.invalidate();
  }

  useEmptyProjectStyle(): void {
    if (this.projectStyleContract === null && this.projectStyleSource === 'empty') return;
    this.projectStyleContract = null;
    this.projectStyleSource = 'empty';
    this.invalidate();
  }

  setProjectStyleContract(contract: ProjectStyleContract): void {
    this.projectStyleContract = structuredClone(contract);
    this.projectStyleSource = 'custom';
    this.invalidate();
  }

  setTaskStyleDelta(delta: TaskStyleDelta | null): void {
    this.taskStyleDelta = delta === null ? null : structuredClone(delta);
    this.invalidate();
  }

  setEnvironmentStyle(value: EnvironmentStyleInput | null): void {
    this.environmentStyle = validateEnvironmentSelection(value);
    this.invalidate();
  }

  newTask(id: string): void {
    if (!id.trim()) throw new TypeError('任务 ID 不可为空');
    this.taskId = id;
    this.mode = 'preset';
    this.drafts.preset = {};
    this.drafts.custom = {};
    this.customInitialized = false;
    this.manualTitle = null;
    this.projectStyleContract = this.projectStyleDefault === null ? null : structuredClone(this.projectStyleDefault);
    this.projectStyleSource = this.projectStyleDefault === null ? 'empty' : 'default';
    this.taskStyleDelta = null;
    this.environmentStyle = null;
    this.invalidate();
  }

  copyTask(id: string): void {
    if (!id.trim()) throw new TypeError('任务 ID 不可为空');
    const visible = copyVisibleDraft(this.drafts[this.mode]);
    this.taskId = id;
    this.drafts.preset = {};
    this.drafts.custom = {};
    this.drafts[this.mode] = visible;
    this.customInitialized = this.mode === 'custom';
    this.projectStyleContract = this.projectStyleContract === null ? null : structuredClone(this.projectStyleContract);
    this.taskStyleDelta = this.taskStyleDelta === null ? null : structuredClone(this.taskStyleDelta);
    this.invalidate();
  }

  setMode(mode: DraftMode): void {
    if (mode === this.mode) return;
    if (mode === 'custom' && !this.customInitialized) {
      this.drafts.custom = copyVisibleDraft(this.drafts.preset);
      delete this.drafts.custom.requirements;
      this.customInitialized = true;
    }
    this.mode = mode;
    this.invalidate();
  }

  setField(field: DraftField, value: PresetUserValues[DraftField] | undefined): void {
    if (field === 'taskId') {
      if (typeof value !== 'string') throw new TypeError('任务 ID 不可为空');
      this.setTaskId(value);
      return;
    }
    if (field === 'title') {
      if (value !== undefined && typeof value !== 'string') throw new TypeError('标题必须是文本');
      this.setManualTitle(value ?? '');
      return;
    }
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
    const draft: BridgeValues = {
      ...this.drafts[this.mode],
      ...(this.taskId === undefined ? {} : { taskId: this.taskId }),
      title: this.effectiveTitle,
      projectStyleContract: this.projectStyleContract === null ? null : structuredClone(this.projectStyleContract),
      taskStyleDelta: this.taskStyleDelta === null ? null : structuredClone(this.taskStyleDelta),
      ...(this.environmentStyle ? { environmentStyle: structuredClone(this.environmentStyle) } : {}),
    };
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
