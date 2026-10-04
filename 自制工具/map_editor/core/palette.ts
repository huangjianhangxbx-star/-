export type MaterialColor = {
  colorId: string;
  baseColor_sRGB: number[];
  alpha: number;
  roughness: number;
  metallic: number;
  emissive: number[];
  emissiveStrength: number;
  alphaMode: string;
  doubleSided: boolean;
};
export const srgbToLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
function color(colorId: string, rgb: number[], spec: any = {}): MaterialColor {
  return {
    colorId,
    baseColor_sRGB: rgb.slice(0, 3),
    alpha: rgb[3] ?? 1,
    roughness: spec.roughness ?? 0.85,
    metallic: spec.metallic ?? 0,
    emissive: spec.emissive ?? rgb.slice(0, 3).map(srgbToLinear),
    emissiveStrength: spec.emissiveStrength ?? spec.emission ?? 0,
    alphaMode: spec.alphaMode ?? ((rgb[3] ?? 1) < 1 ? "BLEND" : "OPAQUE"),
    doubleSided: spec.doubleSided ?? false,
  };
}
export function validatePalette(p: any): any {
  if (
    !p ||
    p.schema !== "xinghai-palette-1" ||
    p.unit !== "meters" ||
    p.axes !== "RH_Z_UP" ||
    !Number.isFinite(p.gridStep) ||
    p.gridStep <= 0 ||
    !Array.isArray(p.colors) ||
    !p.colors.length ||
    p.colors.length > 64
  )
    throw Error("Invalid material profile");
  for (const k of ["profileId", "paletteId"])
    if (typeof p[k] !== "string" || !p[k].trim())
      throw Error("Invalid palette identity");
  for (const k of ["profileRevision", "paletteRevision"])
    if (!Number.isSafeInteger(p[k]) || p[k] < 1)
      throw Error("Invalid palette revision");
  const ids = new Set();
  for (const c of p.colors) {
    if (!c || typeof c.colorId !== "string" || !c.colorId || ids.has(c.colorId))
      throw Error("Invalid color identity");
    ids.add(c.colorId);
    for (const a of [c.baseColor_sRGB, c.emissive])
      if (
        !Array.isArray(a) ||
        a.length !== 3 ||
        a.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
      )
        throw Error("Invalid color values");
    if (
      [c.alpha, c.roughness, c.metallic].some(
        (v) => !Number.isFinite(v) || v < 0 || v > 1,
      ) ||
      !Number.isFinite(c.emissiveStrength) ||
      c.emissiveStrength < 0 ||
      !["OPAQUE", "BLEND", "MASK"].includes(c.alphaMode) ||
      typeof c.doubleSided !== "boolean"
    )
      throw Error("Invalid material parameters");
  }
  return structuredClone(p);
}
export function paletteFromMap(doc: any): any {
  if (
    !Array.isArray(doc.palette) ||
    doc.palette.some(
      (c: any) => typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c),
    )
  )
    throw Error("Invalid map palette");
  if (doc.materialProfile) {
    const p = validatePalette(doc.materialProfile);
    if (p.colors.length > doc.palette.length)
      throw Error("Palette length changed; explicit material mapping required");
    let changed = false;
    while (p.colors.length < doc.palette.length) {
      const index = p.colors.length;
      let id = `color-${index}`;
      while (p.colors.some((c: any) => c.colorId === id)) id += "-new";
      const rgb = [1, 3, 5].map(
        (n) => parseInt(doc.palette[index].slice(n, n + 2), 16) / 255,
      );
      p.colors.push(color(id, rgb));
      changed = true;
    }
    p.colors.forEach((c: any, i: number) => {
      const rgb = [1, 3, 5].map(
        (n) => parseInt(doc.palette[i].slice(n, n + 2), 16) / 255,
      );
      if (rgb.some((v, n) => Math.abs(v - c.baseColor_sRGB[n]) > 1e-10)) {
        c.baseColor_sRGB = rgb;
        changed = true;
      }
    });
    if (changed) p.paletteRevision++;
    return p;
  }
  return validatePalette({
    schema: "xinghai-palette-1",
    profileId: "map-editor",
    profileRevision: 1,
    unit: "meters",
    gridStep: doc.voxelSize,
    axes: "RH_Z_UP",
    paletteId: `map:${doc.mapId}`,
    paletteRevision: Math.max(1, (doc.revision ?? 0) + 1),
    colors: doc.palette.map((hex: string, i: number) =>
      color(
        `color-${i}`,
        [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255),
      ),
    ),
  });
}
export function paletteFromProfile(p: any): any {
  if (p.unit !== "METERS") throw Error("Profile unit must be METERS");
  return validatePalette({
    schema: "xinghai-palette-1",
    profileId: p.id,
    profileRevision: p.revision,
    unit: "meters",
    gridStep: p.grid_step,
    axes: "RH_Z_UP",
    paletteId: `profile:${p.id}`,
    paletteRevision: p.revision,
    colors: Object.entries(p.palette).map(([id, spec]: [string, any]) =>
      color(id, spec.color, spec),
    ),
  });
}
