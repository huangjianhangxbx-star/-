import {validateEditorMetadata} from "./references.ts";
import { connectedTop, faceNormals, faceOffsets, resolveFace, supportsDecalFootprint, supportsHorizontalPlacement } from "./surface.ts";
export function createMap(): any {
  return {
    version: 1,
    mapId: crypto.randomUUID(),
    revision: 0,
    voxelSize: 0.25,
    cells: [],
    instances: [],
    surfaces: [],
    decals: [],
    palette: [
      "#59737a",
      "#cc8f38",
      "#b1b8a5",
      "#263640",
      "#547861",
      "#963f43",
      "#63c8d0",
      "#e4d8ba",
    ],
  };
}
export function validateMap(data: any): any {
  const fail = (s: string) => {
    throw new Error(s);
  };
  if (
    !data ||
    data.version !== 1 ||
    data.voxelSize !== 0.25 ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(data.mapId)
  )
    fail("地图版本、身份或体素规格无效");
  if (
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    data.revision > 2147483647
  )
    fail("修订号无效");
  if (!Array.isArray(data.cells) || data.cells.length > 250000)
    fail("体素预算为25万，请拆分模块");
  const palette = data.palette ?? createMap().palette;
  if (
    !Array.isArray(palette) ||
    palette.length < 1 ||
    palette.length > 4096 ||
    palette.some(
      (c: any) => typeof c !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c),
    )
  )
    fail("色板无效");
  if (
    data.sideColor != null &&
    (!Number.isInteger(data.sideColor) ||
      data.sideColor < 0 ||
      data.sideColor >= palette.length)
  )
    fail("侧面颜色无效");
  validateEditorMetadata(data.editor);
  const validCell = (c: any) => !!c &&
    ![c.x, c.y, c.z].some((v) => !Number.isSafeInteger(v) || Math.abs(v) > 8192) &&
    Number.isInteger(c.color) && c.color >= 0 && c.color < palette.length &&
    (c.owner == null || ["height", "volume"].includes(c.owner));
  const cells = new Set<string>();
  const cellMap = new Map<string, any>();
  for (const c of data.cells) {
    if (!validCell(c))
      fail("体素坐标或颜色无效");
    const k = key(c.x, c.y, c.z);
    if (cells.has(k)) fail("重复体素");
    cells.add(k);
    cellMap.set(k, c);
  }
  if (data.baseCells !== undefined || data.voxelCopies !== undefined) {
    if (!Array.isArray(data.baseCells) || !Array.isArray(data.voxelCopies) || data.voxelCopies.length > 10000)
      fail('重叠副本结构无效');
    const composed = new Map<string, any>(), ids = new Set<string>();
    let sourceCount = 0;
    for (const group of [{ cells: data.baseCells }, ...data.voxelCopies]) {
      if (!group || !Array.isArray(group.cells)) fail('重叠副本体素无效');
      const within = new Set<string>();
      for (const c of group.cells) {
        if (!validCell(c)) fail('重叠副本体素无效');
        const k = key(c.x, c.y, c.z);
        if (within.has(k)) fail('组内重复体素');
        within.add(k); composed.set(k, c); sourceCount++;
      }
    }
    for (const copy of data.voxelCopies) {
      if (!copy || typeof copy.copyId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(copy.copyId) || ids.has(copy.copyId) ||
          Object.keys(copy).some(k => !['copyId', 'cells'].includes(k))) fail('重叠副本身份无效');
      ids.add(copy.copyId);
    }
    if (sourceCount > 250000 || composed.size !== cellMap.size ||
        [...composed].some(([k, c]) => !cellMap.has(k) || cellMap.get(k).color !== c.color ||
          (cellMap.get(k).owner ?? 'height') !== (c.owner ?? 'height')))
      fail('重叠副本与可见体素不一致或预算超限');
  }
  const ids = new Set<string>();
  for (const name of ["instances", "decals"]) {
    if (data[name] != null && !Array.isArray(data[name])) fail("实例列表无效");
    if ((data[name]?.length ?? 0) > 10000) fail("实例预算超限");
    for (const p of data[name] ?? []) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id.trim() ||
        p.id.length > 80 ||
        ids.has(p.id) ||
        typeof p.assetId !== "string" ||
        !p.assetId.trim() ||
        p.assetId.length > 80 ||
        p.scale != null ||
        [p.x, p.y, p.z].some(
          (v) => !Number.isFinite(v) || Math.abs(v) > 2048,
        ) ||
        !Number.isInteger(p.rotation) ||
        p.rotation % 90 !== 0 ||
        Math.abs(p.rotation) > 360000
      )
        fail("实例身份或变换无效");
      ids.add(p.id);
      if (
        name === "decals" &&
        [p.width, p.height].some(
          (v) => !Number.isFinite(v) || v <= 0 || v > 256,
        )
      )
        fail("贴花尺寸无效");
    }
  }
  if (data.surfaces != null && !Array.isArray(data.surfaces))
    fail("表面属性无效");
  for (const p of data.instances ?? []) {
    if (
      p.kind === "event" &&
      (typeof p.registryKey !== "string" ||
        !p.registryKey.trim() ||
        p.registryKey.length > 80)
    )
      fail("事件缺少独立注册键");
    if (
      p.anchor != null &&
      (!Array.isArray(p.anchor) ||
        p.anchor.length !== 3 ||
        p.anchor.some((v: any) => !Number.isFinite(v) || Math.abs(v) > 2048))
    )
      fail("模型锚点无效");
  }
  const surfaceKeys = new Set<string>();
  for (const s of data.surfaces ?? []) {
    const k = key(s.x, s.y, s.z) + "," + s.face;
    if (
      [s.x, s.y, s.z, s.face].some(
        (v) => !Number.isInteger(v) || Math.abs(v) > 8192,
      ) ||
      s.face < 0 ||
      s.face > 5 ||
      !["walk", "deploy", "obstacle", "highground", "ground"].includes(s.tag) ||
      surfaceKeys.has(k)
    )
      fail("表面标签无效或重复");
    surfaceKeys.add(k);
    if (!resolveFace(cellMap, s.x, s.y, s.z, s.face)) fail("表面引用没有外露实体支撑");
  }
  for (const p of data.instances ?? [])
    if (!supportsHorizontalPlacement(cellMap, p.x, p.y, p.z)) fail("实例缺少水平表面支撑");
  for (const p of data.decals ?? [])
    if (!supportsDecalFootprint(cellMap, p)) fail("贴花缺少完整水平表面支撑");
  if (
    data.protectedColumns != null &&
    (!Array.isArray(data.protectedColumns) ||
      data.protectedColumns.some(
        (p: any) => typeof p !== "string" || !/^-?\d+,-?\d+$/.test(p),
      ))
  )
    fail("三维保护记录无效");
  return structuredClone({
    ...data,
    palette,
    instances: data.instances ?? [],
    decals: data.decals ?? [],
    surfaces: data.surfaces ?? [],
    protectedColumns: data.protectedColumns ?? [],
  });
}
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export class EditorDocument {
  data: any;
  cells = new Map<string, any>();
  baseCells = new Map<string, any>();
  overlayCells = new Map<string, any>();
  copyRemovalKeys = new Set<string>();
  columns = new Map<string, Set<string>>();
  protected = new Set<string>();
  skipped = new Set<string>();
  skip(reason: string, target: string) { this.skipped.add(`${reason}:${target}`); return { status: "skipped" as const, reason }; }
  before: any = null;
  past: any[] = [];
  future: any[] = [];
  dirty = new Set<string>();
  detached = { surfaces: 0, instances: 0, decals: 0 };
  bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  constructor(doc = createMap()) {
    this.restore(validateMap(doc));
  }
  get doc() {
    return { ...this.data, cells: [...this.cells.values()],
      ...(this.data.voxelCopies ? { baseCells: [...this.baseCells.values()] } : {}) };
  }
  restore(doc: any) {
    this.data = structuredClone(doc);
    this.baseCells = new Map((this.data.baseCells ?? this.data.cells).map((c: any) => [key(c.x, c.y, c.z), c]));
    this.recompose();
  }
  recompose() {
    this.copyRemovalKeys.clear();
    this.cells = new Map(this.baseCells);
    this.overlayCells = new Map();
    for (const copy of this.data.voxelCopies ?? [])
      for (const c of copy.cells) { this.overlayCells.set(key(c.x, c.y, c.z), c); this.cells.set(key(c.x, c.y, c.z), c); }
    this.bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const c of this.cells.values()) this.expandBounds(c.x, c.y, c.z);
    this.columns.clear();
    this.protected = new Set(this.data.protectedColumns ?? []);
    for (const [k, c] of this.cells) {
      const col = `${c.x},${c.y}`;
      if (!this.columns.has(col)) this.columns.set(col, new Set());
      this.columns.get(col)!.add(k);
      if (c.owner === "volume") this.protected.add(col);
    }
  }
  addVoxelCopy(copyId: string, cells: any[]) {
    this.check();
    if (!this.data.voxelCopies) {
      this.data.baseCells = [...this.baseCells.values()];
      this.data.voxelCopies = [];
    }
    this.data.voxelCopies.push({ copyId, cells: structuredClone(cells) });
    for (const c of cells) this.dirty.add(key(c.x, c.y, c.z));
    this.recompose();
    this.cleanSupport();
  }
  moveVoxelCopy(copyId: string, delta: [number, number, number]) {
    this.check();
    if (delta.some(n => !Number.isSafeInteger(n))) throw Error('移动量必须为整数格');
    const copy = this.data.voxelCopies?.find((row: any) => row.copyId === copyId);
    if (!copy) throw Error('副本不存在');
    for (const c of copy.cells) {
      this.dirty.add(key(c.x, c.y, c.z));
      c.x += delta[0]; c.y += delta[1]; c.z += delta[2];
      if ([c.x, c.y, c.z].some(n => Math.abs(n) > 8192)) throw Error('副本移出坐标范围');
      this.dirty.add(key(c.x, c.y, c.z));
    }
    this.recompose();
    this.cleanSupport();
  }
  replaceVoxelCopyCells(copyId: string, cells: any[]) {
    this.check();
    const copy = this.data.voxelCopies?.find((row: any) => row.copyId === copyId);
    if (!copy) throw Error('选中的体素组已变化，请重新选择');
    for (const c of [...copy.cells, ...cells]) this.dirty.add(key(c.x, c.y, c.z));
    copy.cells = structuredClone(cells);
    this.recompose();
    this.cleanSupport();
  }
  begin() {
    if (this.before) throw new Error("已有笔画");
    this.skipped.clear();
    this.before = structuredClone(this.doc);
    this.dirty.clear();
    this.detached = { surfaces: 0, instances: 0, decals: 0 };
  }
  commit() {
    if (!this.before) return;
    try {
      validateMap(this.doc);
    } catch (e) {
      this.cancel();
      throw e;
    }
    if (JSON.stringify(this.before) !== JSON.stringify(this.doc)) {
      this.past.push(this.before);
      while (
        this.past.length > 1 &&
        (this.past.length > 40 ||
          this.past.reduce((n, d) => n + d.cells.length, 0) > 1000000)
      )
        this.past.shift();
      this.future = [];
      this.data.revision++;
    }
    this.before = null;
  }
  cancel() {
    if (this.before) {
      this.restore(this.before);
      this.before = null;
      this.detached = { surfaces: 0, instances: 0, decals: 0 };
    }
  }
  undo() {
    this.cancel();
    const old = this.past.pop();
    if (old) {
      const rev = this.data.revision + 1;
      this.future.push(structuredClone(this.doc));
      this.restore(old);
      this.data.revision = rev;
    }
  }
  redo() {
    const next = this.future.pop();
    if (next) {
      const rev = this.data.revision + 1;
      this.past.push(structuredClone(this.doc));
      this.restore(next);
      this.data.revision = rev;
    }
  }
  check() {
    if (!this.before) throw new Error("请先开始笔画");
  }
  expandBounds(x: number, y: number, z: number) {
    [x, y, z].forEach((v, a) => {
      this.bounds.min[a] = Math.min(this.bounds.min[a], v);
      this.bounds.max[a] = Math.max(this.bounds.max[a], v + 1);
    });
  }
  put(
    x: number,
    y: number,
    z: number,
    color: number,
    owner: string,
    erase = false,
  ) {
    this.check();
    if (
      [x, y, z].some((v) => !Number.isSafeInteger(v) || Math.abs(v) > 8192) ||
      !Number.isInteger(color) ||
      color < 0 ||
      color >= this.data.palette.length
    )
      throw new Error("坐标或颜色无效");
    const k = key(x, y, z),
      col = `${x},${y}`;
    if (!erase && owner === "volume" && !this.protected.has(col)) {
      this.protected.add(col);
      this.data.protectedColumns.push(col);
    }
    if (erase && !this.cells.has(k)) return;
    if (!erase) {
      const old = this.cells.get(k);
      if (old && old.color === color && old.owner === owner) return;
    }
    // A pasted overlap is still one editable model. Editing a visible voxel
    // consumes that coordinate from every stored source layer so hidden copies
    // cannot reappear after erasing, moving, or scaling the selection.
    if (this.overlayCells.has(k)) {
      this.copyRemovalKeys.add(k);
      if (!this.batchDepth) this.flushCopyRemovals();
      this.overlayCells.delete(k);
    }
    if (erase) {
      this.baseCells.delete(k);
    } else {
      if (!this.cells.has(k) && this.cells.size >= 250000)
        throw new Error("体素预算超限");
      this.baseCells.set(k, { x, y, z, color, owner });
    }
    const visible = this.overlayCells.get(k) ?? this.baseCells.get(k);
    if (visible) {
      this.cells.set(k, visible);
      this.expandBounds(x, y, z);
      if (!this.columns.has(col)) this.columns.set(col, new Set());
      this.columns.get(col)!.add(k);
    } else {
      this.cells.delete(k);
      this.columns.get(col)?.delete(k);
    }
    if(!this.batchDepth)this.cleanSupport();
    this.dirty.add(k);
  }
  batchDepth = 0;
  flushCopyRemovals(){
    if(!this.copyRemovalKeys.size)return;
    const removed=this.copyRemovalKeys;
    for(const copy of this.data.voxelCopies??[])
      copy.cells=copy.cells.filter((cell:any)=>!removed.has(key(cell.x,cell.y,cell.z)));
    this.data.voxelCopies=this.data.voxelCopies.filter((copy:any)=>copy.cells.length);
    this.copyRemovalKeys=new Set();
  }
  batch(fn:()=>void){this.batchDepth++;try{return fn();}finally{if(--this.batchDepth===0){this.flushCopyRemovals();this.cleanSupport();}}}
  cleanSupport(){
    // Adding a neighbour can cover an already tagged face or a placed decal.
    // Removing support can affect any part of a decal, not just its centre.
    const beforeSurfaces = this.data.surfaces.length;
    this.data.surfaces = this.data.surfaces.filter((s: any) =>
      !!resolveFace(this.cells, s.x, s.y, s.z, s.face));
    this.detached.surfaces += beforeSurfaces - this.data.surfaces.length;
    const beforeInstances = this.data.instances.length;
    this.data.instances = this.data.instances.filter((p: any) =>
      supportsHorizontalPlacement(this.cells, p.x, p.y, p.z));
    this.detached.instances += beforeInstances - this.data.instances.length;
    const beforeDecals = this.data.decals.length;
    this.data.decals = this.data.decals.filter((p: any) => supportsDecalFootprint(this.cells, p));
    this.detached.decals += beforeDecals - this.data.decals.length;
  }
  height(x: number, y: number, h: number, t: number, color: number) {
    this.check();
    if (!Number.isInteger(h) || !Number.isInteger(t) || t < 1 || t > 256)
      throw new Error("高度为整数，厚度为1至256");
    const col = `${x},${y}`;
    if (this.protected.has(col))
      return this.skip("protected-column", col);
    for (const k of [...(this.columns.get(col) ?? [])]) {
      const z = this.cells.get(k).z;
      if (z < h - t || z >= h) this.put(x, y, z, 0, "height", true);
    }
    for (let z = h - t; z < h; z++) this.put(x, y, z, color, "height");
  }
  volume(x: number, y: number, z: number, color: number, erase = false) {
    this.put(x, y, z, color, "volume", erase);
    // Preserve the historical protected-column behavior for volume erase.
    const col = `${x},${y}`;
    if (!this.protected.has(col)) {
      this.protected.add(col);
      this.data.protectedColumns.push(col);
    }
  }
  stack(x: number, y: number, z: number, face: number, action: "add" | "remove", color: number) {
    this.check();
    const hit = resolveFace(this.cells, x, y, z, face);
    if (!hit) throw new Error("请命中已有的外露表面");
    const c = hit.cell;
    if (action === "remove") this.put(c.x, c.y, c.z, color, "volume", true);
    else {
      const n = faceNormals[face];
      this.volume(c.x + n[0], c.y + n[1], c.z + n[2], color);
    }
  }
  fillFace(x:number,y:number,z:number,face:number,color:number) {
    this.check();const start=resolveFace(this.cells,x,y,z,face);if(!start)throw Error('请命中已有体素表面');
    const axis=Math.floor(face/2),axes=[0,1,2].filter(a=>a!==axis),seed=start.cell;
    const pending=[[seed.x,seed.y,seed.z]],seen=new Set<string>(),targets:any[]=[];
    for(let i=0;i<pending.length;i++){
      const p=pending[i],k=p.join(',');if(seen.has(k))continue;seen.add(k);
      const c=this.cells.get(k);if(!c||c.color!==seed.color)continue;
      const surface=[...p];if(face%2===0)surface[axis]++;
      if(!resolveFace(this.cells,surface[0],surface[1],surface[2],face))continue;
      targets.push(c);for(const a of axes)for(const d of [-1,1]){const q=[...p];q[a]+=d;pending.push(q);}
    }
    this.batch(()=>{for(const c of targets)this.put(c.x,c.y,c.z,color,c.owner??'volume');});
  }
  fillTop(x: number, y: number, top: number, color: number, tag?: string) {
    this.check();
    const cells = connectedTop([...this.cells.values()], x, y, top);
    if (!cells.length) throw new Error("请命中已有的水平表面");
    for (const c of cells) {
      if (tag === undefined) this.put(c.x, c.y, c.z, color, c.owner ?? "height");
      else this.surface(c.x, c.y, top, 4, tag);
    }
    return cells.length;
  }
  eraseColumn(x: number, y: number) {
    this.check();
    const col = `${x},${y}`;
    if (this.protected.has(col)) return this.skip("protected-column", col);
    for (const k of [...(this.columns.get(col) ?? [])])
      this.put(x, y, this.cells.get(k).z, 0, "height", true);
  }
  flood(x: number, y: number, z: number, color: number) {
    this.check();
    const origin = this.cells.get(key(x, y, z));
    if (!origin || origin.color === color) return;
    const seen = new Set<string>();
    const queue = [[x, y]];
    while (queue.length) {
      const [a, b] = queue.pop()!;
      const k = key(a, b, z);
      if (seen.has(k)) continue;
      seen.add(k);
      const c = this.cells.get(k);
      if (!c || c.color !== origin.color) continue;
      this.put(a, b, z, color, c.owner ?? "height");
      queue.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  }
  surface(x: number, y: number, z: number, face: number, tag: string) {
    this.check();
    if (!["", "walk", "highground", "obstacle"].includes(tag)) throw new Error("新属性只允许普通地面、高台或阻挡；旧标签请迁移");
    if (!resolveFace(this.cells, x, y, z, face)) return this.skip("missing-support", `${x},${y},${z},${face}`);
    if (["walk", "highground"].includes(tag) && face !== 4) return this.skip("not-standing-face", `${x},${y},${z},${face}`);
    const previous = this.data.surfaces.find((s: any) => s.x === x && s.y === y && s.z === z && s.face === face);
    if ((previous?.tag ?? "") === tag) return;
    this.data.surfaces = this.data.surfaces.filter(
      (s: any) => !(s.x === x && s.y === y && s.z === z && s.face === face),
    );
    if (tag) this.data.surfaces.push({ x, y, z, face, tag });
  }
  place(instance: any) {
    this.check();
    if (!supportsHorizontalPlacement(this.cells, instance.x, instance.y, instance.z))
      throw new Error("实例缺少水平表面支撑");
    this.data.instances.push(instance);
  }
  decal(instance: any) {
    this.check();
    if (!supportsDecalFootprint(this.cells, instance))
      throw new Error("贴花缺少完整水平表面支撑");
    this.data.decals.push(instance);
  }
  remove(id: string) {
    this.check();
    this.data.instances = this.data.instances.filter((p: any) => p.id !== id);
    this.data.decals = this.data.decals.filter((p: any) => p.id !== id);
  }
}
