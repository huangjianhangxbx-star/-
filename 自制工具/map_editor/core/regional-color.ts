export type RegionalOptions = {
  mode: "objects" | "brick" | "patch";
  plane: "XY" | "XZ" | "YZ";
  width: number;
  height: number;
  depth: number;
  stagger: number;
  origin: number[];
  scale: number;
  amount: number;
  ratio: number;
  steps: number;
  seed: number;
  layoutSeed: number;
  maskSeed: number;
  colorSeed: number;
};
export const regionalDefaults = (): RegionalOptions => ({
  mode: "brick",
  plane: "XZ",
  width: 1,
  height: 0.5,
  depth: 0.5,
  stagger: 0.5,
  origin: [0, 0, 0],
  scale: 1.5,
  amount: 0.18,
  ratio: 0.35,
  steps: 5,
  seed: 17,
  layoutSeed: 0,
  maskSeed: 0,
  colorSeed: 0,
});
export function stableHash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export function validateRegional(o: RegionalOptions) {
  if (
    !["objects", "brick", "patch"].includes(o.mode) ||
    !["XY", "XZ", "YZ"].includes(o.plane) ||
    [o.width, o.height, o.depth, o.scale].some(
      (v) => !Number.isFinite(v) || v < 0.03125 || v > 512,
    ) ||
    !Number.isFinite(o.amount) ||
    o.amount < 0 ||
    o.amount > 0.8 ||
    !Number.isFinite(o.ratio) ||
    o.ratio < 0 ||
    o.ratio > 1 ||
    ![3, 5].includes(o.steps) ||
    o.origin.length !== 3 ||
    o.origin.some((v) => !Number.isFinite(v) || Math.abs(v) > 4096) ||
    [o.seed, o.layoutSeed, o.maskSeed, o.colorSeed].some(
      (v) => !Number.isSafeInteger(v) || v < 0 || v > 2147483647,
    ) ||
    !Number.isFinite(o.stagger) ||
    o.stagger < 0 ||
    o.stagger > 1
  )
    throw Error("区域尺度、种子、幅度或比例无效");
}
/** Group identities use physical source coordinates, never mesh rectangles or traversal order. */
export function regionalGroup(
  point: readonly number[],
  o: RegionalOptions,
  owner?: string,
): string {
  if (o.mode === "objects") {
    if (!owner) throw Error("作者分块需要明确物体成员");
    return "object:" + owner;
  }
  const p = point.map((v, i) => v - o.origin[i]);
  if (o.mode === "brick") {
    const axes =
        o.plane === "XY" ? [0, 1, 2] : o.plane === "XZ" ? [0, 2, 1] : [1, 2, 0],
      row = Math.floor(p[axes[1]] / o.height),
      stagger = (((row % 2) + 2) % 2) * o.stagger * o.width;
    return `brick:${Math.floor((p[axes[0]] - stagger) / o.width)},${row},${Math.floor(p[axes[2]] / o.depth)}`;
  }
  const q = p.map((v) => v / o.scale),
    center = q.map(Math.floor);
  let distance = Infinity,
    id = "";
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const c = [center[0] + x, center[1] + y, center[2] + z],
          key = c.join(","),
          seed = o.layoutSeed || o.seed;
        const d = c.reduce(
          (s, v, i) =>
            s +
            (q[i] - v - (0.25 + 0.5 * stableHash(`${seed}:${key}:${i}`))) ** 2,
          0,
        );
        if (d < distance) {
          distance = d;
          id = key;
        }
      }
  return "patch:" + id;
}
export function regionalGain(group: string, o: RegionalOptions): number {
  if (
    !o.amount ||
    stableHash(`${o.maskSeed || o.seed}:mask:${group}`) >= o.ratio
  )
    return 1;
  const value = stableHash(`${o.colorSeed || o.seed}:color:${group}`),
    band =
      o.steps === 3
        ? value < 0.5
          ? -1
          : 1
        : [-1, -0.5, 0.5, 1][Math.min(3, Math.floor(value * 4))];
  return 1 + band * o.amount;
}
