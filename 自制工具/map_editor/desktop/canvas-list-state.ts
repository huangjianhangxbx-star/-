import type { AssetDocument } from "../core/workshop-documents.ts";
export type CanvasListSelection = {
  selected: string[];
  active: string;
  anchor: string | null;
};
export function selectCanvasRows(
  order: string[],
  state: CanvasListSelection,
  id: string,
  modifier: "plain" | "ctrl" | "shift",
): CanvasListSelection {
  if (!order.includes(id)) throw Error("画布不存在");
  let selected: string[],
    active = id,
    anchor = id;
  if (modifier === "shift" && state.anchor && order.includes(state.anchor)) {
    const a = order.indexOf(state.anchor),
      b = order.indexOf(id);
    selected = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    anchor = state.anchor;
  } else if (modifier === "ctrl") {
    const set = new Set(state.selected.filter((v) => order.includes(v)));
    if (set.has(id)) {
      set.delete(id);
      active =
        state.active === id
          ? (order.find((v) => set.has(v)) ?? state.active)
          : state.active;
    } else set.add(id);
    selected = order.filter((v) => set.has(v));
  } else selected = [id];
  return { selected, active, anchor };
}
export function planCanvasMerge(
  model: AssetDocument,
  ids: readonly string[],
  targetId: string,
) {
  const all = model.canvases ?? [],
    target = all.find((c) => c.canvasId === targetId),
    wanted = new Set(ids);
  if (!target || !wanted.has(targetId)) throw Error("合并目标必须在所选画布中");
  if (wanted.size < 2) throw Error("至少选择两张画布");
  if (ids.some((id) => !all.some((c) => c.canvasId === id)))
    throw Error("所选画布已变化，请重新选择");
  const sources = all.filter((c) => wanted.has(c.canvasId)),
    stride = target.voxelStepM / 0.03125;
  for (const c of sources) {
    if (c.locked) throw Error(c.name + "：画布已锁定");
    if (c.voxelStepM !== target.voxelStepM)
      throw Error(c.name + "：精度不同，不能合并");
    if (
      c.originTicks.some((n, i) => (n - target.originTicks[i]) % stride !== 0)
    )
      throw Error(c.name + "：网格未对齐");
  }
  const order = [target, ...sources.filter((c) => c !== target)],
    occupied = new Set<string>();
  let overlaps = 0;
  for (const c of order) {
    const delta = c.originTicks.map(
      (n, i) => (n - target.originTicks[i]) / stride,
    );
    for (const v of c.cells) {
      const k = [v.x + delta[0], v.y + delta[1], v.z + delta[2]].join(",");
      if (occupied.has(k)) overlaps++;
      occupied.add(k);
    }
  }
  return {
    order: order.map((c) => c.canvasId),
    overlaps,
    hidden: sources.filter((c) => !c.visible).map((c) => c.name),
    revision: model.revision,
  };
}
