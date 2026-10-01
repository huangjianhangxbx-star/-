import type {Pos,Tile,Wave} from './types';
export const MAP_WIDTH=22,MAP_HEIGHT=12;
export const MAP_GOAL:Pos={x:0,y:5};
export const MAP_SPAWNS:Pos[]=[{x:21,y:2},{x:21,y:9}];
export const ALLY_START:Pos={x:2,y:4};
function polyline(points:Pos[]):Pos[]{const out:Pos[]=[{...points[0]}];for(const end of points.slice(1)){const p={...out.at(-1)!};while(p.x!==end.x||p.y!==end.y){if(p.x!==end.x)p.x+=Math.sign(end.x-p.x);else p.y+=Math.sign(end.y-p.y);out.push({...p});}}return out;}
export const MAP_ROUTES:ReadonlyArray<ReadonlyArray<Pos>>=[
 polyline([{x:21,y:2},{x:10,y:2},{x:10,y:6},{x:16,y:6},{x:16,y:8},{x:2,y:8},{x:2,y:5},MAP_GOAL]),
 polyline([{x:21,y:9},{x:18,y:9},{x:18,y:8},{x:2,y:8},{x:2,y:5},MAP_GOAL]),
];
/** Ground courts share one palette. Walls enforce a looping north cloister and a joining south lane. */
const layout:string[][]=Array.from({length:MAP_HEIGHT},()=>Array.from({length:MAP_WIDTH},()=>'#'));
for(const route of MAP_ROUTES)for(const p of route)layout[p.y][p.x]='.';
for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)layout[y][x]='.';
for(let y=3;y<=5;y++)for(let x=11;x<=15;x++)layout[y][x]='^';
for(let y=9;y<=10;y++)for(let x=8;x<=11;x++)layout[y][x]='^';
for(let x=2;x<=5;x++)layout[1][x]='^';
export const MAP_LAYOUT:ReadonlyArray<string>=layout.map(row=>row.join(''));
export function createMapTiles():Tile[]{return MAP_LAYOUT.flatMap((row,y)=>[...row].map((symbol,x)=>({x,y,layer:symbol==='^'?1:0,obstacle:symbol==='#'})));}
export function routeFromSpawn(spawn:Pos):Pos[]{const route=MAP_ROUTES.find(r=>r[0].x===spawn.x&&r[0].y===spawn.y);return route?route.slice(1).map(p=>({...p})):[];}
export {towerWaves as createWaves} from './tower-content';
