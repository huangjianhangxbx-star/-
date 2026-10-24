import {canvasParts,CANVAS_TICK} from "../core/workshop-canvases.ts";
import type { AssetDocument } from '../core/workshop-documents.ts';
import type { SceneV2 } from '../core/workshop-v2.ts';

/** A lightweight thumbnail drawn from the editable cells; never substitutes for the source. */
export function drawAssetPreview(canvas: HTMLCanvasElement, asset: AssetDocument) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  const displayCells=canvasParts(asset).flatMap(c=>c.cells.map(cell=>({...cell,x:cell.x*c.voxelStepM+c.originTicks[0]*CANVAS_TICK,y:cell.y*c.voxelStepM+c.originTicks[1]*CANVAS_TICK,z:cell.z*c.voxelStepM+c.originTicks[2]*CANVAS_TICK,size:c.voxelStepM,local:[cell.x,cell.y,cell.z],paint:c.paintSource})));
  ctx.fillStyle = '#171d22';
  ctx.fillRect(0, 0, width, height);
  if (!displayCells.length || displayCells.length > 20000) {
    ctx.fillStyle = '#9eabb2';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayCells.length ? '预览待生成' : '空模型', width / 2, height / 2);
    return;
  }
  const project = (x: number, y: number, z: number) => [0.866 * (x - y), 0.5 * (x + y) - z] as const;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cell of displayCells) for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
    const [x, y] = project(cell.x + dx*cell.size, cell.y + dy*cell.size, cell.z + dz*cell.size);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const scale = Math.min((width - 24) / Math.max(.001, maxX - minX), (height - 24) / Math.max(.001, maxY - minY));
  const px = (point: readonly [number, number]) => [12 + (point[0] - minX) * scale + (width - 24 - (maxX - minX) * scale) / 2,
    12 + (point[1] - minY) * scale + (height - 24 - (maxY - minY) * scale) / 2] as const;
  const cells = [...displayCells].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  const occupied = new Set(cells.map((cell) => `${cell.x},${cell.y},${cell.z}`));
  function face(points: [number, number, number][], color: string) {
    ctx!.beginPath();
    points.forEach(([x, y, z], i) => { const [u, v] = px(project(x, y, z)); if (i) ctx!.lineTo(u, v); else ctx!.moveTo(u, v); });
    ctx!.closePath(); ctx!.fillStyle = color; ctx!.fill();
  }
  function tint(hex: string, factor: number) {
    const match = /^#([a-f0-9]{6})/i.exec(hex);
    if (!match) return '#789494';
    const value = match[1];
    return `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(value.slice(i, i + 2), 16) * factor)).join(',')})`;
  }
  function paintedFace(cell:typeof cells[number],direction:number,factor:number){
    const pixels=cell.paint?.faces[[...cell.local,direction].join(',')];if(!pixels)return;
    const n=cell.size*64,axis=direction>>1,axes=[0,1,2].filter(i=>i!==axis),position=[cell.x,cell.y,cell.z];
    for(const [index,color]of Object.entries(pixels)){
      const u=Number(index)%n,v=Math.floor(Number(index)/n),points:[number,number,number][]=[];
      for(const [du,dv]of [[0,0],[1,0],[1,1],[0,1]]){const p=[...position];p[axis]+=direction%2===0?cell.size:0;p[axes[0]]+=(u+du)*cell.size/n;p[axes[1]]+=(v+dv)*cell.size/n;points.push(p as [number,number,number]);}
      face(points,tint(color,factor));
    }
  }
  for (const cell of cells) {
    const { x, y, z, size } = cell, color = asset.palette[cell.color] ?? '#789494';
    if (asset.canvases || !occupied.has(`${x + size},${y},${z}`)) {face([[x + size, y, z], [x + size, y + size, z], [x + size, y + size, z + size], [x + size, y, z + size]], tint(color, 0.68));paintedFace(cell,0,.68);}
    if (!occupied.has(`${x},${y + size},${z}`)) {face([[x, y + size, z], [x + size, y + size, z], [x + size, y + size, z + size], [x, y + size, z + size]], tint(color, 0.82));paintedFace(cell,2,.82);}
    if (!occupied.has(`${x},${y},${z + size}`)) {face([[x, y, z + size], [x + size, y, z + size], [x + size, y + size, z + size], [x, y + size, z + size]], tint(color, 1));paintedFace(cell,4,1);}
  }
}

export function assetPreviewImage(asset: AssetDocument): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 140;
  drawAssetPreview(canvas, asset);
  const image = document.createElement('img');
  image.src = canvas.toDataURL('image/png');
  image.alt = `资产预览：${asset.name}`;
  return image;
}

export function drawScenePreview(canvas: HTMLCanvasElement, scene: SceneV2) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#171d22'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2d3941'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const points = [...scene.instances, ...scene.decals].map((item) => item.positionM);
  if (!points.length) { ctx.fillStyle = '#9eabb2'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('空试摆场景', w / 2, h / 2); return; }
  const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
  const scale = Math.min((w - 32) / Math.max(.001, maxX - minX), (h - 32) / Math.max(.001, maxY - minY));
  for (const [i, point] of points.entries()) {
    const x = w / 2 + (point[0] - (minX + maxX) / 2) * scale;
    const y = h / 2 - (point[1] - (minY + maxY) / 2) * scale;
    ctx.fillStyle = i < scene.instances.length ? '#b88a4c' : '#60b8c4';
    ctx.fillRect(x - 5, y - 5, 10, 10);
  }
}
