import type { EditorDocument } from './document.ts';
import { voxelKey, type SelectionCell, type VoxelSelection } from './voxel-selection.ts';

export type StepScaleAxis = 'x' | 'y' | 'xy';
export type StepScalePreview = {
  axis: StepScaleAxis;
  steps: number;
  source: SelectionCell[];
  destination: SelectionCell[];
  conflicts: string[];
  before: [number, number];
  after: [number, number];
};

const same = (a: SelectionCell, b: SelectionCell) =>
  a.color === b.color && (a.owner ?? 'height') === (b.owner ?? 'height');
const sourceIndex = (offset: number, oldSize: number, newSize: number) =>
  Math.max(0, Math.min(oldSize - 1, Math.round((offset + 0.5) * oldSize / newSize - 0.5)));

/** Resample occupied integer cells inside an expanded XY envelope; Z and cell size never change. */
export function planStepScale(
  doc: EditorDocument,
  selection: VoxelSelection,
  axis: StepScaleAxis,
  steps: number,
): StepScalePreview {
  if (!['x', 'y', 'xy'].includes(axis) || !Number.isSafeInteger(steps) || steps < 1)
    throw Error('请选择 X/Y/XY 和至少 1 个整数步进格');
  if (!selection.count) throw Error('请先选择体素');
  const bounds = selection.bounds!;
  const before: [number, number] = [bounds.max[0] - bounds.min[0] + 1, bounds.max[1] - bounds.min[1] + 1];
  const dx = axis.includes('x') ? steps : 0;
  const dy = axis.includes('y') ? steps : 0;
  const after: [number, number] = [before[0] + dx * 2, before[1] + dy * 2];
  const source: SelectionCell[] = [];
  for (const selected of selection.snapshot.values()) {
    const live = doc.cells.get(voxelKey(selected));
    if (!live || !same(live, selected)) throw Error('选区源体素已变化，请重新选择');
    source.push({ ...live });
  }
  const layers = [...new Set(source.map(c => c.z))].sort((a, b) => a - b);
  if (after[0] * after[1] * layers.length > 1000000)
    throw Error('步进预览预算超限，请缩小选区或步数');
  const sourceByKey = new Map(source.map(c => [voxelKey(c), c]));
  const sourceKeys = new Set(sourceByKey.keys());
  const destination: SelectionCell[] = [];
  const conflicts: string[] = [];
  for (const z of layers)
    for (let y = 0; y < after[1]; y++)
      for (let x = 0; x < after[0]; x++) {
        const oldX = bounds.min[0] + sourceIndex(x, before[0], after[0]);
        const oldY = bounds.min[1] + sourceIndex(y, before[1], after[1]);
        const original = sourceByKey.get(`${oldX},${oldY},${z}`);
        if (!original) continue;
        const cell = { ...original, x: bounds.min[0] - dx + x, y: bounds.min[1] - dy + y };
        const key = voxelKey(cell);
        if (Math.abs(cell.x) > 8192 || Math.abs(cell.y) > 8192) throw Error('步进结果坐标越界');
        const occupied = doc.cells.get(key);
        if (occupied && !sourceKeys.has(key)) conflicts.push(key);
        destination.push(cell);
      }
  if (doc.cells.size - source.length + destination.length > 250000)
    throw Error('体素预算超限，计划未执行');
  return { axis, steps, source, destination, conflicts, before, after };
}
