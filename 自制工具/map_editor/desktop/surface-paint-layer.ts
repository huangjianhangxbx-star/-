import {paintCount,paintSample} from "./paint-performance.ts";
import {appearanceColor} from '../core/appearance-color.ts';
import * as THREE from "three";
import type { AssetDocument, Vec3 } from "../core/workshop-documents.ts";
import { CANVAS_TICK, canvasParts } from "../core/workshop-canvases.ts";
import { paintResolution, type SurfacePaint } from "../core/surface-paint.ts";

/** Sparse editable face data becomes small independent textures, never a full GLB during a stroke. */
export class SurfacePaintLayer {
  readonly group = new THREE.Group();
  private faces = new Map<
    string,
    { mesh: THREE.Mesh; texture: THREE.CanvasTexture; signature: string; pixels:Record<string,string>; tone:unknown; base:string }
  >();
  private cellIndices = new WeakMap<object, Map<string,any>>();
  readonly stats={created:0,removed:0,updated:0};
  private opacityFor: (canvasId: string) => number;
  constructor(
    parent: THREE.Object3D,
    opacityFor: (canvasId: string) => number = () => 1,
  ) {
    this.opacityFor = opacityFor;
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
        const cells = this.cellIndices.get(c.cells) ?? new Map(
            c.cells.map((cell) => [[cell.x, cell.y, cell.z].join(","), cell]),
          ),
          factor = 0.25 / (frame?.voxelStepM ?? 0.25),
          origin = frame?.originTicks ?? [0, 0, 0];
        this.cellIndices.set(c.cells,cells);
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

              c.voxelStepM,
              c.originTicks,
              origin,
              factor,
            ]);
          keep.add(id);
          const existing = this.faces.get(id);
          if (existing?.signature === signature) {
            if(existing.pixels!==pixels||existing.tone!==c.faceTone?.faces[key]||existing.base!==base){
              const ctx=(existing.texture.image as HTMLCanvasElement).getContext('2d')!,n=paintResolution(c.voxelStepM);
              ctx.fillStyle=appearanceColor(base,undefined,c.faceTone?.faces[key]);ctx.fillRect(0,0,n,n);
              for(const [i,color] of Object.entries(pixels)){ctx.fillStyle=appearanceColor(base,color,c.faceTone?.faces[key]);ctx.fillRect(Number(i)%n,Math.floor(Number(i)/n),1,1);}
              existing.texture.needsUpdate=true;existing.pixels=pixels;existing.tone=c.faceTone?.faces[key];existing.base=base;this.stats.updated++;paintCount("textureUpdate");
            }
            this.applyOpacity(existing.mesh, c.canvasId);
            continue;
          }
          this.remove(id);
          const n = paintResolution(c.voxelStepM),
            canvas = document.createElement("canvas");
          canvas.width = canvas.height = n;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = appearanceColor(base,undefined,c.faceTone?.faces[key]);
          ctx.fillRect(0, 0, n, n);
          for (const [i, color] of Object.entries(pixels)) {
            ctx.fillStyle = appearanceColor(base,color,c.faceTone?.faces[key]);
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
          mesh.userData.canvasId = c.canvasId;
          this.applyOpacity(mesh, c.canvasId);
          this.group.add(mesh);
          this.faces.set(id, { mesh, texture, signature, pixels, tone:c.faceTone?.faces[key],base });
          this.stats.created++;paintCount("paintResourceCreate");
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
    this.stats.removed++;paintCount("paintResourceDispose");
  }
  private applyOpacity(mesh: THREE.Mesh, canvasId: string) {
    const material = mesh.material as THREE.Material,
      opacity = Math.max(0, Math.min(1, this.opacityFor(canvasId)));
    if (material.transparent !== opacity < 1) material.needsUpdate = true;
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.depthWrite = opacity === 1;
  }
  clear() {
    for (const id of this.faces.keys()) this.remove(id);
  }
  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
