import sourceJson from "../../../自制工具/map_editor/samples/tower-ruins/遗迹双路.xhmap.json";
import contentJson from "../../../自制工具/map_editor/samples/tower-ruins/tower-content.json";
import { validateMap } from "../../../自制工具/map_editor/core/document.ts";
import { towerWaves } from "./tower-content";
import type { Pos, Tile } from "./types";

export type WorkbenchSample = { source: any; content: any; width: number; height: number;
  tiles: Tile[]; heights: number[]; goal: Pos; spawns: Pos[]; start: Pos;
  routes: Pos[][]; waves: ReturnType<typeof towerWaves> };
let cached: WorkbenchSample | null = null;
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function route(points: Pos[]): Pos[] {
  const out: Pos[] = [{ ...points[0] }];
  for (const end of points.slice(1)) {
    const p = { ...out.at(-1)! };
    if (p.x !== end.x && p.y !== end.y) throw Error("工坊路线只能正交连接");
    while (p.x !== end.x || p.y !== end.y) {
      if (p.x !== end.x) p.x += Math.sign(end.x - p.x);
      else p.y += Math.sign(end.y - p.y);
      out.push({ ...p });
    }
  }
  return out;
}
export function getWorkbenchSample(): WorkbenchSample {
  if (cached) return cached;
  const source: any = validateMap(sourceJson);
  const content: any = contentJson;
  if (source.mapId !== content.mapId || source.voxelSize !== 0.25 || content.metersPerUnit !== 1)
    throw Error("工坊地图身份或米/U比例不匹配");
  const width = content.width, height = content.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8)
    throw Error("工坊地图尺寸无效");
  const byCell = new Map<string, any>(source.cells.map((c: any) => [key(c.x, c.y, c.z), c]));
  const tags = new Map<string, string>(source.surfaces.filter((s: any) => s.face === 4)
    .map((s: any) => [key(s.x, s.y, s.z), s.tag]));
  const tiles: Tile[] = [], heights: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let groupTop: number | null = null;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      const gx = x * 4 + dx, gy = y * 4 + dy;
      let top = -Infinity;
      for (let z = -32; z <= 32; z++) if (byCell.has(key(gx, gy, z))) top = Math.max(top, z + 1);
      if (!Number.isFinite(top)) throw Error(`工坊地图缺少地面：${x},${y}`);
      if (groupTop != null && groupTop !== top) throw Error(`首图不支持单个游戏U内混合高度：${x},${y}`);
      groupTop = top;
    }
    const top = groupTop!;
    const tag = tags.get(key(x * 4 + 2, y * 4 + 2, top));
    const obstacle = tag === "obstacle";
    tiles.push({ x, y, layer: tag === "highground" ? 1 : 0, obstacle });
    heights.push(top * 0.25);
  }
  const marker = (registryKey: string): Pos => {
    const found = source.instances.filter((p: any) => p.registryKey === registryKey);
    if (found.length !== 1) throw Error(`工坊地图标记缺失或重复：${registryKey}`);
    return { x: Math.floor(found[0].x), y: Math.floor(found[0].y) };
  };
  const goal = marker("tower.goal"), spawns = [marker("tower.spawn.a"), marker("tower.spawn.b")],
    start = marker("tower.ally.start");
  const routes = content.routes.map((points: Pos[]) => route(points));
  for (let i = 0; i < routes.length; i++) {
    if (routes[i][0].x !== spawns[i]?.x || routes[i][0].y !== spawns[i]?.y ||
      routes[i].at(-1)!.x !== goal.x || routes[i].at(-1)!.y !== goal.y)
      throw Error(`工坊路线 ${i + 1} 与源标记不一致`);
    for (const p of routes[i]) if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height || tiles[p.y * width + p.x].obstacle)
      throw Error(`工坊路线 ${i + 1} 穿过阻挡：${p.x},${p.y}`);
  }
  if (tiles[start.y * width + start.x].obstacle || tiles[goal.y * width + goal.x].obstacle)
    throw Error("工坊友方出生点或水晶不可站立");
  return cached = { source, content, width, height, tiles, heights, goal, spawns,
    start, routes, waves: towerWaves(1, routes) };
}
