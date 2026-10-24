import * as THREE from "three";
import type { AssetDocument, Vec3 } from "../core/workshop-documents.ts";
import { CANVAS_TICK, canvasParts } from "../core/workshop-canvases.ts";
import { paintResolution, type SurfacePaint } from "../core/surface-paint.ts";

/** Sparse editable face data becomes small independent textures, never a full GLB during a stroke. */
export class SurfacePaintLayer {
  readonly group = new THREE.Group();
  private faces = new Map<
    string,
    { mesh: THREE.Mesh; texture: THREE.CanvasTexture; signature: string }
  >();
  constructor(parent: THREE.Object3D) {
    parent.add(this.group);
    this.group.userData.surfacePaint = true;
  }
  update(
    asset: AssetDocument | null,
    frame?: { voxelStepM: number; originTicks: readonly number[] },
    override?: { canvasId: string; source: SurfacePaint },
  ) {
    const keep = new Set<string>();
    if (asset)
      for (const c of canvasParts(asset)) {
        if (!c.visible) continue;
        const paint =
          override?.canvasId === c.canvasId ? override.source : c.paintSource;
        if (!paint) continue;
        const cells = new Map(
            c.cells.map((cell) => [[cell.x, cell.y, cell.z].join(","), cell]),
          ),
          factor = 0.25 / (frame?.voxelStepM ?? 0.25),
          origin = frame?.originTicks ?? [0, 0, 0];
        for (const [key, pixels] of Object.entries(paint.faces)) {
          if (!Object.keys(pixels).length) continue;
          const p = key.split(",").map(Number),
            face = p[3],
            axis = face >> 1,
            sign = face % 2 === 0 ? 1 : -1,
            cell = cells.get(p.slice(0, 3).join(","));
          if (!cell) continue;
          const neighbor = p.slice(0, 3);
          neighbor[axis] += sign;
          if (cells.has(neighbor.join(","))) continue;
          const id = c.canvasId + "|" + key,
            base =
              asset.palette[
                face === 4 ? cell.color : (asset.sideColor ?? cell.color)
              ],
            signature = JSON.stringify([
              pixels,
              base,
              c.voxelStepM,
              c.originTicks,
              origin,
              factor,
            ]);
          keep.add(id);
          if (this.faces.get(id)?.signature === signature) continue;
          this.remove(id);
          const n = paintResolution(c.voxelStepM),
            canvas = document.createElement("canvas");
          canvas.width = canvas.height = n;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = base;
          ctx.fillRect(0, 0, n, n);
          for (const [i, color] of Object.entries(pixels)) {
            ctx.fillStyle = color;
            ctx.fillRect(Number(i) % n, Math.floor(Number(i) / n), 1, 1);
          }
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          texture.magFilter = texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          const axes = [0, 1, 2].filter((i) => i !== axis),
            corners = [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
            positions: number[] = [],
            uvs: number[] = [],
            order =
              sign === (axis === 1 ? -1 : 1)
                ? [0, 1, 2, 0, 2, 3]
                : [0, 2, 1, 0, 3, 2];
          for (const index of order) {
            const v = p.slice(0, 3);
            v[axis] += sign === 1 ? 1 : 0;
            v[axes[0]] += corners[index][0];
            v[axes[1]] += corners[index][1];
            const world = v.map(
              (x, i) =>
                (x * c.voxelStepM +
                  (c.originTicks[i] - origin[i]) * CANVAS_TICK) *
                factor,
            );
            world[axis] += sign * 0.0003;
            positions.push(world[0], world[2], -world[1]);
            uvs.push(...corners[index]);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
          );
          geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
              map: texture,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            }),
          );
          mesh.raycast = () => {};
          mesh.userData.surfacePaint = true;
          this.group.add(mesh);
          this.faces.set(id, { mesh, texture, signature });
        }
      }
    for (const id of this.faces.keys()) if (!keep.has(id)) this.remove(id);
  }
  private remove(id: string) {
    const entry = this.faces.get(id);
    if (!entry) return;
    entry.mesh.removeFromParent();
    entry.mesh.geometry.dispose();
    (entry.mesh.material as THREE.Material).dispose();
    entry.texture.dispose();
    this.faces.delete(id);
  }
  clear() {
    for (const id of this.faces.keys()) this.remove(id);
  }
  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
