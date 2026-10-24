import { validateAsset, type AssetDocument } from "./workshop-documents.ts";
import { appearanceColor } from "./appearance-color.ts";
import {
  faceGain,
  sourceFaceNormals,
  FACE_TONE_BUDGET,
  type FaceTone,
} from "./face-tone.ts";
import {
  regionalGroup,
  regionalGain,
  validateRegional,
  type RegionalOptions,
} from "./regional-color.ts";
export type AppearanceOptions =
  | { kind: "region"; regional: RegionalOptions }
  | {
      kind: "tone";
      preset: "up-down" | "directional";
      strength: number;
      light: number[];
      bands: number;
      affectPaint: boolean;
      faces?: number[];
    }
  | { kind: "clear" };
export type AppearancePlan = {
  sourceStamp: string;
  canvasId: string;
  options: AppearanceOptions;
  nextModel: AssetDocument;
  changed: number;
  groups: Record<string, string>;
  warnings: string[];
  scope: string[];
  computeMs: number;
};
const verified = new WeakMap<AppearancePlan, AppearancePlan>();
const key = (c: { x: number; y: number; z: number }) => `${c.x},${c.y},${c.z}`;
export const appearanceStamp = (model: AssetDocument) => JSON.stringify(model);
export function planAppearance(
  source: AssetDocument,
  canvasId: string,
  selection: ReadonlySet<string>,
  options: AppearanceOptions,
): AppearancePlan {
  const start = performance.now();
  validateAsset(source);
  const original = source.canvases?.find((c) => c.canvasId === canvasId);
  if (!original || !original.visible || original.locked)
    throw Error("目标画布不存在、已锁定或隐藏");
  const occupied = new Set(original.cells.map(key)),
    scope = new Set([...selection].filter((k) => occupied.has(k)));
  if (!scope.size)
    throw Error("请先选择需要上色的物体或体素；不会自动处理全部画布");
  const nextModel = structuredClone(source),
    canvas = nextModel.canvases!.find((c) => c.canvasId === canvasId)!,
    warnings: string[] = [],
    groups: Record<string, string> = {};
  let changed = 0;
  if (options.kind === "region") {
    const o = options.regional;
    validateRegional(o);
    const owners = new Map<string, string>(),
      sizes = new Map<string, number>();
    for (const object of source.objects ?? [])
      if (object.canvasIds.includes(canvasId)) {
        sizes.set(object.objectId, object.cellKeys?.length ?? 0);
        for (const k of object.cellKeys ?? []) owners.set(k, object.objectId);
      }
    if (source.sideColor !== undefined)
      warnings.push(
        "侧面使用固定色：区域色差只改变体素底色，侧面仍保留固定色；可显式切换侧面继承体素",
      );
    if (
      o.mode === "objects" &&
      [...scope].every((k) => (sizes.get(owners.get(k) ?? "") ?? 0) === 1)
    )
      warnings.push("一物体一格，效果接近逐格随机；建议使用虚拟砖块或成片色斑");
    const gainByKey = new Map<string, number>();
    for (const c of original.cells) {
      if (!scope.has(key(c))) continue;
      const point = [c.x, c.y, c.z].map(
        (v, i) =>
          (v + 0.5) * original.voxelStepM + original.originTicks[i] * 0.03125,
      );
      const group = regionalGroup(point, o, owners.get(key(c)));
      groups[key(c)] = group;
      gainByKey.set(key(c), regionalGain(group, o));
    }
    const slots = new Map<string, number>(),
      needs = new Map<string, { color: number; gain: number; hex: string }>();
    for (const cells of [
      canvas.cells,
      ...(canvas.baseCells ? [canvas.baseCells] : []),
      ...(canvas.voxelCopies ?? []).map((v) => v.cells),
    ])
      for (const c of cells) {
        const gain = gainByKey.get(key(c));
        if (gain === undefined || gain === 1) continue;
        const hex = appearanceColor(source.palette[c.color], undefined, {
          gain,
          affectPaint: false,
        });
        if (hex === source.palette[c.color].toLowerCase()) continue;
        needs.set(c.color + ":" + gain, { color: c.color, gain, hex });
      }
    if (source.materialProfile.colors.length + needs.size > 64)
      throw Error("区域色差超出64个材质色槽预算；请减少源材质、色阶或幅度");
    for (const [id, v] of [...needs].sort(([a], [b]) => a.localeCompare(b))) {
      const slot = nextModel.palette.length;
      slots.set(id, slot);
      nextModel.palette.push(v.hex);
      const material = structuredClone(source.materialProfile.colors[v.color]);
      material.colorId = material.colorId + "-region-" + slot;
      material.baseColor_sRGB = [1, 3, 5].map(
        (i) => parseInt(v.hex.slice(i, i + 2), 16) / 255,
      );
      nextModel.materialProfile.colors.push(material);
    }
    for (const cells of [
      canvas.cells,
      ...(canvas.baseCells ? [canvas.baseCells] : []),
      ...(canvas.voxelCopies ?? []).map((v) => v.cells),
    ])
      for (const c of cells) {
        const slot = slots.get(c.color + ":" + gainByKey.get(key(c)));
        if (slot !== undefined) {
          c.color = slot;
          changed++;
        }
      }
    if (needs.size) nextModel.materialProfile.paletteRevision++;
  } else {
    const tone: FaceTone = structuredClone(
      canvas.faceTone ?? { schema: "xinghai-face-tone-1", faces: {} },
    );
    let toneCount = Object.keys(tone.faces).length;
    if (
      options.kind === "tone" &&
      (options.faces?.some((f) => !Number.isInteger(f) || f < 0 || f > 5) ||
        ![2, 3].includes(options.bands) ||
        typeof options.affectPaint !== "boolean")
    )
      throw Error("暗面参数无效");
    for (const cell of original.cells) {
      if (!scope.has(key(cell))) continue;
      for (let f = 0; f < 6; f++) {
        const id = key(cell) + "," + f;
        if (options.kind === "clear") {
          if (tone.faces[id]) {
            delete tone.faces[id];
            changed++;
          }
          continue;
        }
        if (options.faces && !options.faces.includes(f)) continue;
        const n = sourceFaceNormals[f];
        if (occupied.has(`${cell.x + n[0]},${cell.y + n[1]},${cell.z + n[2]}`))
          continue;
        const gain = faceGain(
            f,
            options.preset,
            options.strength,
            options.light,
            options.bands,
          ),
          value =
            gain === 1 ? undefined : { gain, affectPaint: options.affectPaint };
        if (JSON.stringify(tone.faces[id]) !== JSON.stringify(value)) {
          if (value) {
            if (!tone.faces[id] && ++toneCount > FACE_TONE_BUDGET)
              throw Error("按面暗面超过250000面预算，请拆分资产");
            tone.faces[id] = value;
          } else {
            delete tone.faces[id];
            toneCount--;
          }
          changed++;
        }
        groups[id] =
          gain === 1 ? "亮面" : gain === 1 - options.strength ? "暗面" : "侧面";
      }
    }
    if (Object.keys(tone.faces).length) canvas.faceTone = tone;
    else delete canvas.faceTone;
  }
  const paint = Object.values(original.paintSource?.faces ?? {});
  if (paint.length)
    warnings.push(
      options.kind === "tone" && options.affectPaint
        ? "本次暗面影响手绘显示，原始笔触不改；清除暗面后恢复"
        : "手绘像素默认保留；完全覆盖的面不会显露底色色差。可用“仅底色对照”检查",
    );
  const plan: AppearancePlan = {
    sourceStamp: appearanceStamp(source),
    canvasId,
    options: structuredClone(options),
    nextModel: validateAsset(nextModel),
    changed,
    groups,
    warnings,
    scope: [...scope],
    computeMs: performance.now() - start,
  };
  verified.set(plan, structuredClone(plan));
  return plan;
}
export function verifiedAppearancePlan(
  plan: AppearancePlan,
  source: AssetDocument,
): AppearancePlan {
  const safe = verified.get(plan);
  if (!safe || safe.sourceStamp !== appearanceStamp(source))
    throw Error("源模型已变化或上色预览无效，请重新打开工具");
  return structuredClone(safe);
}
