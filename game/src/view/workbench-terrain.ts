import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { meshMap } from "../../../自制工具/map_editor/core/mesher.ts";
import { getWorkbenchSample } from "../core/workbench-map";
import columnUrl from "../../../自制工具/map_editor/assets/ruins-m11/AR_COLUMN_02.glb?url";
import frameUrl from "../../../自制工具/map_editor/assets/ruins-m11/AR_FRAME_01.glb?url";
import rockUrl from "../../../自制工具/map_editor/assets/ruins-m11/EX_ROCK_01.glb?url";
import lightUrl from "../../../自制工具/map_editor/assets/ruins-m11/IT_LIGHT_01.glb?url";
import landmarkUrl from "../../../自制工具/map_editor/assets/ruins-m11/EX_LANDMARK_01.glb?url";
import emblemUrl from "../../../自制工具/map_editor/assets/ruins-m11/PT_EMBLEM_01.glb?url";
import decalUrl from "../../../自制工具/map_editor/assets/ruins-m11/PT_EMBLEM_01.png?url";
import catalog from "../../../自制工具/map_editor/assets/ruins-m11/.xinghai-assets.json";

const modelUrls: Record<string, string> = {
  "ruins:AR_COLUMN_02": columnUrl, "ruins:AR_FRAME_01": frameUrl,
  "ruins:EX_ROCK_01": rockUrl, "ruins:IT_LIGHT_01": lightUrl,
  "ruins:EX_LANDMARK_01": landmarkUrl, "ruins:PT_EMBLEM_01": emblemUrl,
};

/** Game rendering consumes exactly the editor's cells and palette. */
export function workbenchMesh(): THREE.Mesh {
  const { source, width, height } = getWorkbenchSample();
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  for (const q of meshMap(source)) {
    const axes = [0, 1, 2].filter((a) => a !== q.axis);
    const base = positions.length / 3;
    const color = new THREE.Color(source.palette[q.color]);
    for (const [a, b] of [[q.a, q.b], [q.a + q.w, q.b], [q.a + q.w, q.b + q.h], [q.a, q.b + q.h]]) {
      const p = [0, 0, 0], n = [0, 0, 0];
      p[q.axis] = q.plane; p[axes[0]] = a; p[axes[1]] = b; n[q.axis] = q.sign;
      positions.push(p[0] * 0.25 - width / 2, p[2] * 0.25, p[1] * 0.25 - height / 2);
      normals.push(n[0], n[2], n[1]); colors.push(color.r, color.g, color.b);
    }
    const order = q.sign === (q.axis === 1 ? 1 : -1)
      ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    indices.push(...order.map((i) => i + base));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/** Models are decoration only; source voxels and tags remain collision authority. */
export async function addWorkbenchDecorations(group: THREE.Group, stillCurrent: () => boolean) {
  const { source, width, height } = getWorkbenchSample();
  const loader = new GLTFLoader();
  const loaded = new Map<string, THREE.Group>();
  for (const p of source.instances) {
    const url = modelUrls[p.assetId];
    if (!url) throw Error(`工坊资产缺少游戏映射：${p.assetId}`);
    let model = loaded.get(url);
    if (!model) { model = (await loader.loadAsync(url)).scene; loaded.set(url, model); }
    if (!stillCurrent()) return;
    const object = model.clone(true);
    object.position.set(p.x - width / 2, p.z, p.y - height / 2);
    object.rotation.y = p.rotation * Math.PI / 180;
    if (p.anchor) object.position.sub(new THREE.Vector3(p.anchor[0], p.anchor[2], p.anchor[1]).applyEuler(object.rotation));
    object.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(object);
  }
  const texture = await new THREE.TextureLoader().loadAsync(decalUrl);
  if (!stillCurrent()) { texture.dispose(); return; }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  for (const p of source.decals) {
    if (catalog.assets.find(a => a.id === p.assetId)?.path !== "PT_EMBLEM_01.png")
      throw Error(`工坊贴花缺少游戏映射：${p.assetId}`);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1 }));
    plane.rotation.set(-Math.PI / 2, 0, -p.rotation * Math.PI / 180);
    plane.position.set(p.x - width / 2, p.z + 0.004, p.y - height / 2);
    group.add(plane);
  }
}
