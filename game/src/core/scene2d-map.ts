import type {GameState,Pos,Tile} from './types';
export const SCENE2D={width:48,height:32,seed:91,spawn:{x:10,y:12},bookmarks:[{x:11,y:11},{x:25,y:16},{x:37,y:13}]} as const;
export function normalizeWallMask(mask:number){if(!Number.isInteger(mask)||mask<0||mask>255)throw Error('Invalid neighbor mask');for(const [corner,edges] of [[1,10],[4,18],[32,72],[128,80]])if((mask&edges)!==edges)mask&=~corner;return mask;}
export function validateWallMapping(mapping:Record<string,number>){const legal=new Set(Array.from({length:256},(_,i)=>normalizeWallMask(i)));if(Object.keys(mapping).length!==47||[...legal].some(k=>!Number.isInteger(mapping[k])||mapping[k]<1||mapping[k]>47)||new Set(Object.values(mapping)).size!==47)throw Error('47-state mapping missing or invalid');}
export function groundVariant(x:number,y:number,seed=SCENE2D.seed){let h=Math.imul(x+1,73856093)^Math.imul(y+1,19349663)^seed;h=Math.imul(h^(h>>>13),1274126177);return 1+((h^(h>>>16))>>>0)%3;}
export const sortBaseline=(p:Pos)=>p.y*100+p.x*.001;
export function wallBounds(p:Pos,meta:{width:number;height:number;ppu:number;pivot:Pos},scale:number){if(!Number.isFinite(scale)||scale<=0||meta.ppu<=0)throw Error('Invalid wall scale/PPU');const w=meta.width/meta.ppu*scale,h=meta.height/meta.ppu*scale;return {left:p.x-w*meta.pivot.x,right:p.x+w*(1-meta.pivot.x),top:p.y-h*(1-meta.pivot.y),bottom:p.y+h*meta.pivot.y};}
export function scene2DLayout(){const walls=new Set<string>(),add=(x:number,y:number)=>walls.add(`${x},${y}`),line=(x1:number,y1:number,x2:number,y2:number,gaps:number[]=[])=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)if(!gaps.includes(x1===x2?y:x))add(x,y);};
 line(0,0,47,0);line(0,31,47,31);line(0,0,0,31);line(47,0,47,31);
 line(6,8,18,8,[14]);line(6,8,6,19,[15]);line(18,8,18,19,[12]);line(6,19,18,19,[11]);
 line(24,5,24,26,[16,17]);line(21,13,30,13,[27]);line(31,7,42,7,[36]);line(31,7,31,22,[15]);line(42,7,42,22,[12]);line(33,22,42,22);line(35,17,38,17);line(38,14,38,17);
 const tiles:Tile[]=Array.from({length:48*32},(_,i)=>({x:i%48,y:Math.floor(i/48),layer:0,obstacle:walls.has(`${i%48},${Math.floor(i/48)}`)}));return {walls,tiles};}
/** Source Y is up; simulation Y is down. Flip dy, preserve original bit identities. */
export function wallMask(walls:ReadonlySet<string>,p:Pos){let mask=0;for(const [dx,dy,bit] of [[0,-1,2],[-1,0,8],[0,1,64],[1,0,16],[-1,-1,1],[1,-1,4],[-1,1,32],[1,1,128]])if(walls.has(`${p.x+dx},${p.y+dy}`))mask|=bit;return normalizeWallMask(mask);}
const installed=new WeakMap<GameState,string>();
export function installScene2D(s:GameState){if(s.phase!=='battle'||!s.world?.visit.active||!s.exploration)return;const token=`${s.world.id}:${s.world.visit.generation}`;if(installed.get(s)===token)return;const firstInWorld=!installed.get(s)?.startsWith(s.world.id+':');installed.set(s,token);const {tiles}=scene2DLayout(),r=s.exploration;
 const definition={...r.definition,width:48,height:32,tiles,name:'2D分层验证 · 已探索诊断地图',entry:{...SCENE2D.spawn},exit:{x:11,y:12},points:[],enemies:[],encounters:[],victoryCondition:'exit' as const};r.definition=definition;s.world.places[s.world.visit.placeId].definition=definition;
 s.width=48;s.height=32;s.tiles=tiles;s.goal={...definition.exit};s.gate={...definition.exit};s.spawns=[];s.units=s.units.filter(u=>u.team==='ally'&&!u.cloneOf);s.totalEnemies=0;s.context='explorationIdle';r.memory.seen=tiles.map(t=>`${t.x},${t.y}`);
 for(const u of s.units){if(firstInWorld&&['hunter','ranger'].includes(u.id)){u.pos={x:10+(u.id==='ranger'?.7:0),y:12};u.drawPos={...u.pos};u.ready=0;u.path=[];u.destination=null;u.direct=undefined;u.following=false;}}
}
