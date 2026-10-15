import type {GameState} from './types';
import {commitInventoryMove,type InventoryMoveRequest} from './inventory-operations';
import {terrainFits,clearShot,surface,distance} from './spatial';
export function dropInventoryItem(s:GameState,r:InventoryMoveRequest){
 const w=s.world,m=w?.backpack?.inventory,u=s.units.find(u=>u.id===s.controlledBodyId),i=m?.items[r.id];
 if(!w||!m||!u||!i||!['team','safe','reserve'].includes(i.location.container)||u.crossing||u.forcedMotion)return {ok:false,reason:'当前物品不能丢弃'};
 const p=s.tiles.filter(t=>terrainFits(s,t,.08)&&surface(s,t)?.layer===surface(s,u.pos)?.layer&&distance(u.pos,t)<=1.5&&clearShot(s,u.pos,t)).sort((a,b)=>distance(a,u.pos)-distance(b,u.pos))[0];if(!p)return {ok:false,reason:'附近没有合法落地点'};
 const d=m.definitions[i.definitionId],id=`drop:manual:${w.visit.generation}:${m.serial+1}:${i.id}`;if(m.containers[id])return {ok:false,reason:'掉落请求已处理'};
 m.containers[id]={id,name:d.name,kind:'grid',columns:d.width,rows:d.height,revision:0,placeId:w.visit.placeId,pos:{x:p.x,y:p.y}};
 const q=commitInventoryMove(s,{...r,to:id,toRevision:0,position:undefined,slot:undefined});if(!q.ok)delete m.containers[id];return q;
}
export function clearManualDrops(s:GameState){const m=s.world?.backpack?.inventory;if(!m)return;for(const id of Object.keys(m.containers).filter(id=>id.startsWith('drop:manual:'))){for(const i of Object.values(m.items))if(i.location.container===id)delete m.items[i.id];delete m.containers[id];}}
