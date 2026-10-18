import type { AssetDocument } from '../core/workshop-documents.ts';
import type { SceneV2 } from '../core/workshop-v2.ts';

/** A lightweight thumbnail drawn from the editable cells; never substitutes for the source. */
export function drawAssetPreview(canvas: HTMLCanvasElement, asset: AssetDocument) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  ctx.fillStyle = '#171d22';
  ctx.fillRect(0, 0, width, height);
  if (!asset.cells.length || asset.cells.length > 20000) {
    ctx.fillStyle = '#9eabb2';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(asset.cells.length ? '预览待生成' : '空模型', width / 2, height / 2);
    return;
  }
  const project = (x: number, y: number, z: number) => [0.866 * (x - y), 0.5 * (x + y) - z] as const;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cell of asset.cells) for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
    const [x, y] = project(cell.x + dx, cell.y + dy, cell.z + dz);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const scale = Math.min((width - 24) / Math.max(1, maxX - minX), (height - 24) / Math.max(1, maxY - minY));
  const px = (point: readonly [number, number]) => [12 + (point[0] - minX) * scale + (width - 24 - (maxX - minX) * scale) / 2,
    12 + (point[1] - minY) * scale + (height - 24 - (maxY - minY) * scale) / 2] as const;
  const cells = [...asset.cells].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
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
  for (const cell of cells) {
    const { x, y, z } = cell, color = asset.palette[cell.color] ?? '#789494';
    if (!occupied.has(`${x + 1},${y},${z}`)) face([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], tint(color, 0.68));
    if (!occupied.has(`${x},${y + 1},${z}`)) face([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], tint(color, 0.82));
    if (!occupied.has(`${x},${y},${z + 1}`)) face([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], tint(color, 1));
  }
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
  const scale = Math.min((w - 32) / Math.max(1, maxX - minX), (h - 32) / Math.max(1, maxY - minY));
  for (const [i, point] of points.entries()) {
    const x = w / 2 + (point[0] - (minX + maxX) / 2) * scale;
    const y = h / 2 - (point[1] - (minY + maxY) / 2) * scale;
    ctx.fillStyle = i < scene.instances.length ? '#b88a4c' : '#60b8c4';
    ctx.fillRect(x - 5, y - 5, 10, 10);
  }
}
