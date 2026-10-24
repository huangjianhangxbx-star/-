import { DEFAULT_ROCK_OPTIONS, type RockCell, type RockOptions } from '../../core/rock-shaping.ts';

export const FIXTURES = [
  { id: 'block', name: '厚矩形体 · 40 × 24 × 48', size: [40,24,48] },
  { id: 'wall', name: '单侧岩壁 · 40 × 24 × 48', size: [40,24,48] },
  { id: 'platform', name: '矩形平台 · 64 × 48 × 24', size: [64,48,24] },
  { id: 'l-platform', name: 'L 形平台 · 64 × 48 × 24', size: [64,48,24] },
  { id: 'thin', name: '失败样例 · 过薄板体', size: [40,1,32] },
  { id: 'overhang', name: '失败样例 · 悬挑平台', size: [48,32,24] },
] as const;

/** Original authored fixtures, integer voxel coordinates with Z up. */
export function createFixture(id: string): RockCell[] {
  const fixture=FIXTURES.find(f=>f.id===id) ?? FIXTURES[0];
  const [w,d,h]=fixture.size;
  const cells: RockCell[]=[];
  for(let z=0;z<h;z++) for(let y=0;y<d;y++) for(let x=0;x<w;x++) {
    if(id==='l-platform' && x>=32 && y>=24) continue;
    if(id==='overhang' && z<12 && (x<12||x>=36||y<8||y>=24)) continue;
    cells.push({x,y,z,color:0});
  }
  return cells;
}

export const makeRockFixture=createFixture;
export function presetSampleOptions(preset:RockOptions['preset']):RockOptions {
  return {...DEFAULT_ROCK_OPTIONS,preset,seed:17,maxDepth:3,chips:0,cellSize:0.25,sides:[0,1,2,3]};
}
