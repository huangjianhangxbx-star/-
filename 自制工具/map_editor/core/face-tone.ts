import { parsePaintFaceKey } from "./surface-paint.ts";
import type { FaceToneValue } from "./appearance-color.ts";
export type FaceTone = {
  schema: "xinghai-face-tone-1";
  faces: Record<string, FaceToneValue>;
};
export const FACE_TONE_BUDGET = 250000;
export const sourceFaceNormals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;
export function validateFaceTone(
  input: any,
  owners?: ReadonlySet<string>,
): FaceTone {
  if (
    !input ||
    input.schema !== "xinghai-face-tone-1" ||
    Object.keys(input).some((k) => !["schema", "faces"].includes(k)) ||
    !input.faces ||
    typeof input.faces !== "object" ||
    Array.isArray(input.faces) ||
    Object.keys(input.faces).length > FACE_TONE_BUDGET
  )
    throw Error("按面暗面格式或预算无效");
  for (const [key, value] of Object.entries(input.faces) as [string, any][]) {
    const p = parsePaintFaceKey(key);
    if (
      key !== p.join(",") ||
      (owners && !owners.has(p.slice(0, 3).join(","))) ||
      !value ||
      Object.keys(value).length !== 2 ||
      Object.keys(value).some((k) => !["gain", "affectPaint"].includes(k)) ||
      typeof value.gain !== "number" ||
      !Number.isFinite(value.gain) ||
      value.gain < 0 ||
      value.gain > 1 ||
      typeof value.affectPaint !== "boolean"
    )
      throw Error("按面暗面键、归属或系数无效");
  }
  return input;
}
export function faceGain(
  face: number,
  preset: "up-down" | "directional",
  strength: number,
  light: readonly number[],
  bands = 3,
): number {
  if (
    !["up-down", "directional"].includes(preset) ||
    ![2, 3].includes(bands) ||
    !Number.isInteger(face) ||
    face < 0 ||
    face > 5 ||
    !Number.isFinite(strength) ||
    strength < 0 ||
    strength > 0.8 ||
    light.length !== 3 ||
    light.some((v) => !Number.isFinite(v)) ||
    Math.hypot(...light) < 1e-8
  )
    throw Error("暗面强度或参考方向无效");
  if (preset === "up-down")
    return face === 4 ? 1 : face === 5 ? 1 - strength : 1 - strength / 2;
  const n = sourceFaceNormals[face],
    d =
      n.reduce<number>((s, v, i) => s + v * light[i], 0) / Math.hypot(...light);
  return d > 0.35
    ? 1
    : d < -0.35 || bands === 2
      ? 1 - strength
      : 1 - strength / 2;
}
export function filterFaceTone(
  tone: FaceTone | undefined,
  keys: ReadonlySet<string>,
): FaceTone | undefined {
  if (!tone) return;
  return {
    ...tone,
    faces: Object.fromEntries(
      Object.entries(tone.faces).filter(([k]) =>
        keys.has(k.split(",").slice(0, 3).join(",")),
      ),
    ),
  };
}
export function remapFaceTone(
  tone: FaceTone | undefined,
  mapping: ReadonlyMap<string, string>,
  axis?: number,
  turns = 0,
): FaceTone | undefined {
  if (!tone) return;
  const faces: FaceTone["faces"] = {},
    dest = new Set(mapping.values());
  for (const [key, value] of Object.entries(tone.faces)) {
    const p = parsePaintFaceKey(key),
      owner = p.slice(0, 3).join(","),
      target = mapping.get(owner);
    if (!target) {
      if (!dest.has(owner)) faces[key] = { ...value };
      continue;
    }
    const n: number[] = [...sourceFaceNormals[p[3]]];
    if (axis !== undefined)
      for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
        const a = (axis + 1) % 3,
          b = (axis + 2) % 3,
          old = n[a];
        n[a] = -n[b];
        n[b] = old;
      }
    const a = n.findIndex((v) => v !== 0),
      face = a * 2 + (n[a] < 0 ? 1 : 0);
    faces[target + "," + face] = { ...value };
  }
  return { ...tone, faces };
}
export function reconcileFaceTone(
  tone: FaceTone | undefined,
  before: { x: number; y: number; z: number }[],
  after: { x: number; y: number; z: number }[],
): FaceTone | undefined {
  if (!tone) return;
  const old = new Set(before.map((c) => `${c.x},${c.y},${c.z}`)),
    live = new Set(after.map((c) => `${c.x},${c.y},${c.z}`));
  return {
    ...tone,
    faces: Object.fromEntries(
      Object.entries(tone.faces).filter(([key]) => {
        const [x, y, z, f] = parsePaintFaceKey(key),
          owner = `${x},${y},${z}`,
          n = sourceFaceNormals[f],
          neighbor = `${x + n[0]},${y + n[1]},${z + n[2]}`;
        return (
          live.has(owner) &&
          !(old.has(owner) && old.has(neighbor) && !live.has(neighbor))
        );
      }),
    ),
  };
}
