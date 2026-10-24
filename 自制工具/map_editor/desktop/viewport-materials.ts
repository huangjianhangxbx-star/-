import * as T from "three";
import type { DisplayPreset } from "./viewport-display-state.ts";
import { attachVoxelClarity } from "./voxel-clarity.ts";
/** Variants own no source textures. Sources are restored after each render. */
export class ViewportMaterials {
  private cache = new Map<T.Material, Map<string, T.Material>>();
  private cleanup = new Map<T.Material, () => void>();
  readonly clarity = { value: 0 };
  get(source: T.Material, preset: DisplayPreset, paint = false): T.Material {
    const gray = preset === "studio-gray" || preset === "raking-gray",
      key = (gray ? "gray" : preset) + ":" + paint;
    let variants = this.cache.get(source);
    if (!variants) {
      variants = new Map();
      this.cache.set(source, variants);
      const release = () => {
        for (const m of this.cache.get(source)?.values() ?? []) m.dispose();
        this.cache.delete(source);
        source.removeEventListener("dispose", release);
        this.cleanup.delete(source);
      };
      this.cleanup.set(source, release);
      source.addEventListener("dispose", release);
    }
    let material = variants.get(key) as
      | T.MeshStandardMaterial
      | T.MeshBasicMaterial
      | undefined;
    const s = source as T.MeshStandardMaterial;
    if (!material) {
      material =
        preset === "albedo"
          ? new T.MeshBasicMaterial()
          : new T.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      material.name = "viewport:" + key;
      material.map = s.map ?? null;
      material.alphaMap = s.alphaMap ?? null;
      material.color.copy(
        paint ? new T.Color("white") : (s.color ?? new T.Color("white")),
      );
      material.vertexColors = !gray && s.vertexColors;
      const hook = source.onBeforeCompile,
        cacheKey = source.customProgramCacheKey();
      attachVoxelClarity(material, this.clarity);
      const grid = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        // Keep source custom shader hooks (including voxel clarity), then compose.
        if (!cacheKey.includes("workshop-voxel-clarity"))
          hook.call(source, shader, renderer);
        grid.call(material!, shader, renderer);
        if (gray) {
          const c = new T.Color("#a8a8a8");
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>\ndiffuseColor.rgb = vec3(${c.r},${c.g},${c.b});`,
          );
        }
      };
      material.customProgramCacheKey = () => `viewport-v1:${key}:${cacheKey}`;
      variants.set(key, material);
    }
    // Opacity and clipping belong to the current canvas state, not the preset.
    material.opacity = source.opacity;
    material.transparent = source.transparent;
    material.depthWrite = source.depthWrite;
    material.depthTest = source.depthTest;
    material.side = source.side;
    material.alphaTest = source.alphaTest;
    material.alphaHash = source.alphaHash;
    material.clippingPlanes = source.clippingPlanes;
    material.clipIntersection = source.clipIntersection;
    material.clipShadows = source.clipShadows;
    material.polygonOffset = source.polygonOffset;
    material.polygonOffsetFactor = source.polygonOffsetFactor;
    material.polygonOffsetUnits = source.polygonOffsetUnits;
    material.colorWrite = source.colorWrite;
    material.visible = source.visible;
    material.blending = source.blending;
    material.map = s.map ?? null;
    material.alphaMap = s.alphaMap ?? null;
    material.color.copy(
      paint ? new T.Color("white") : (s.color ?? new T.Color("white")),
    );
    material.fog = preset !== "albedo";
    const signature = [
      material.transparent,
      material.side,
      material.alphaTest,
      !!material.map,
      !!material.alphaMap,
      material.clippingPlanes?.length ?? 0,
    ].join(":");
    if (material.userData.displayFlags !== signature) {
      material.userData.displayFlags = signature;
      material.needsUpdate = true;
    }
    return material;
  }
  dispose() {
    for (const release of [...this.cleanup.values()]) release();
  }
}
