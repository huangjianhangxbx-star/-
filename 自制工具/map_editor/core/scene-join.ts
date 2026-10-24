import {
  createAsset,
  validateAsset,
  validateScene,
  type AssetDocument,
  type SceneDocument,
  type SceneInstance,
  type Vec3,
  type Cell,
} from "./workshop-documents.ts";
import {
  canvasParts,
  CANVAS_TICK,
  type ModelCanvas,
} from "./workshop-canvases.ts";
import { isVoxelAligned, transformPoint } from "./coordinates.ts";

const key = (p: readonly number[]) => p.join(",");
const ticks = (value: number) => {
  const n = Math.round(value / CANVAS_TICK);
  if (Math.abs(n * CANVAS_TICK - value) > 1e-8)
    throw Error("所选模型的网格位置不兼容，无法无损合并；请先对齐网格");
  return n;
};
/** Bake independent scene instances without changing their source assets or resampling voxels. */
export function mergeSceneInstances(
  scene: SceneDocument,
  assets: ReadonlyMap<string, AssetDocument>,
  ids: readonly string[],
  assetId: string,
  instanceId: string,
): { asset: AssetDocument; instance: SceneInstance; scene: SceneDocument } {
  validateScene(scene);
  if (ids.length < 2 || new Set(ids).size !== ids.length)
    throw Error("至少选择两个不同的模型");
  if (
    assets.has(assetId) ||
    scene.assets.some((a) => a.assetId === assetId) ||
    scene.instances.some((i) => i.instanceId === instanceId) ||
    scene.decals.some((i) => i.decalId === instanceId)
  )
    throw Error("合并资产或实例身份已存在");
  const selected = ids.map((id) => {
    const instance = scene.instances.find((i) => i.instanceId === id);
    if (!instance) throw Error("所选模型不存在");
    const row = scene.assets.find((a) => a.assetId === instance.assetId),
      source = assets.get(instance.assetId);
    if (row?.kind !== "voxel" || !source) throw Error("只能合并可编辑体素模型");
    if (
      !isVoxelAligned(source.anchorM, instance.positionM, instance.rotationDeg)
    )
      throw Error("所选模型未对齐场景0.25米网格；请先对齐后合并");
    return { instance, source: validateAsset(source) };
  });
  const visibility = new Set(
    selected.map(
      ({ instance }) =>
        scene.groups.find((g) => g.groupId === instance.groupId)!.visible,
    ),
  );
  if (visibility.size > 1)
    throw Error("所选模型的场景分组显隐不同；请先统一显隐状态");
  const result = createAsset(assetId),
    paletteKeys = new Map<string, number>();
  result.palette = [];
  result.materialProfile.colors = [];
  // Keep material values as well as RGB; identical colors with different roughness remain distinct.
  const color = (source: AssetDocument, index: number) => {
    const material = source.materialProfile.colors[index],
      { colorId, ...properties } = material;
    const signature = JSON.stringify([
      source.palette[index].toLowerCase(),
      properties,
    ]);
    let mapped = paletteKeys.get(signature);
    if (mapped === undefined) {
      mapped = result.palette.length;
      if (mapped >= 64) throw Error("合并材质色板超过64色预算");
      paletteKeys.set(signature, mapped);
      result.palette.push(source.palette[index]);
      result.materialProfile.colors.push({
        ...structuredClone(material),
        colorId: "joined-" + mapped,
      });
    }
    return mapped;
  };
  let side: number | undefined,
    sideSet = false,
    base: Vec3 | undefined,
    total = 0;
  type Part = { canvas: ModelCanvas; occupied: Map<string, Cell> };
  const groups = new Map<string, Part>();
  for (const { instance, source } of selected) {
    const mappedSide =
      source.sideColor === undefined
        ? undefined
        : color(source, source.sideColor);
    if (sideSet && mappedSide !== side)
      throw Error("所选模型的侧面颜色设置不兼容；请先统一侧面颜色");
    side = mappedSide;
    sideSet = true;
    const remap = new Map<number, number>();
    for (const sourceCanvas of canvasParts(source)) {
      if (!sourceCanvas.cells.length) continue;
      const step = sourceCanvas.voxelStepM,
        stepTicks = step / CANVAS_TICK;
      // Rotating the lower corner alone places cubes one cell too far on negative axes.
      const quarter = (((instance.rotationDeg / 90) % 4) + 4) % 4;
      const correction: Vec3 =
        quarter === 1
          ? [-step, 0, 0]
          : quarter === 2
            ? [-step, -step, 0]
            : quarter === 3
              ? [0, -step, 0]
              : [0, 0, 0];
      const rotatedOrigin = transformPoint(
        sourceCanvas.originTicks.map((n) => n * CANVAS_TICK) as Vec3,
        source.anchorM,
        instance.positionM,
        instance.rotationDeg,
      ).map((n, i) => n + correction[i]) as Vec3;
      // SceneSession transforms the asset frame on the .25 m lattice. Fine canvas
      // offsets belong inside that frame, never in the replacement instance position.
      base ??= rotatedOrigin.map((n) => Math.round(n / 0.25) * 0.25) as Vec3;
      const origin = rotatedOrigin.map((n, i) => ticks(n - base![i])) as Vec3;
      const phase = origin.map(
        (n) => ((n % stepTicks) + stepTicks) % stepTicks,
      );
      const signature = key([step, ...phase, Number(sourceCanvas.visible)]);
      let part = groups.get(signature);
      if (!part) {
        if (groups.size >= 32) throw Error("合并画布超过32张预算");
        const canvas: ModelCanvas = {
          canvasId: "joined-canvas-" + groups.size,
          name: "合并画布 " + (groups.size + 1),
          visible: sourceCanvas.visible,
          locked: false,
          voxelStepM: step,
          originTicks: origin,
          cells: [],
          protectedColumns: [],
        };
        part = { canvas, occupied: new Map() };
        groups.set(signature, part);
      }
      for (const cell of sourceCanvas.cells) {
        const [x, y, z] = [cell.x, cell.y, cell.z];
        const rotated =
          quarter === 1
            ? [-y, x, z]
            : quarter === 2
              ? [-x, -y, z]
              : quarter === 3
                ? [y, -x, z]
                : [x, y, z];
        const xyz = rotated.map(
          (n, i) => n + (origin[i] - part!.canvas.originTicks[i]) / stepTicks,
        );
        let mapped = remap.get(cell.color);
        if (mapped === undefined) {
          mapped = color(source, cell.color);
          remap.set(cell.color, mapped);
        }
        const k = key(xyz);
        if (!part.occupied.has(k) && ++total > 250000)
          throw Error("合并体素超过250000格预算");
        part.occupied.set(k, {
          x: xyz[0],
          y: xyz[1],
          z: xyz[2],
          color: mapped,
          ...(cell.owner ? { owner: cell.owner } : {}),
        });
      }
    }
  }
  if (!base) throw Error("所选模型没有体素");
  result.schema = "xinghai-workshop-asset-2";
  result.name = (selected.at(-1)!.source.name || "模型") + " · 合并";
  result.canvases = [...groups.values()].map((p) => ({
    ...p.canvas,
    cells: [...p.occupied.values()],
  }));
  result.objects = result.canvases.map((c, i) => ({
    objectId: "joined-object-" + i,
    name: result.name,
    canvasIds: [c.canvasId],
    originTicks: [...c.originTicks] as Vec3,
    cellKeys: c.cells.map((v) => key([v.x, v.y, v.z])),
  }));
  if (side !== undefined) result.sideColor = side;
  const asset = validateAsset(result),
    instance: SceneInstance = {
      instanceId,
      assetId,
      positionM: base,
      rotationDeg: 0,
      groupId: selected.at(-1)!.instance.groupId,
    };
  const next = structuredClone(scene),
    removed = new Set(ids);
  next.instances = next.instances.filter((i) => !removed.has(i.instanceId));
  next.instances.push(instance);
  next.assets.push({
    kind: "voxel",
    assetId,
    source: `assets/${assetId}.xhmodule.json`,
  });
  const activeId = ids.at(-1)!;
  next.collections = next.collections
    ?.map((c) => ({
      ...c,
      memberIds: c.memberIds.flatMap((id) =>
        id === activeId ? [instanceId] : removed.has(id) ? [] : [id],
      ),
    }))
    .filter((c) => c.memberIds.length);
  if (next.collections === undefined) delete next.collections;
  next.revision++;
  return {
    asset,
    instance: structuredClone(instance),
    scene: validateScene(next),
  };
}
