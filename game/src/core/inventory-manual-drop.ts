import type {GameState,Pos} from './types';
import {commitInventoryMove,type InventoryMoveRequest} from './inventory-operations';
import {terrainFits,clearShot,surface} from './spatial';
export function dropInventoryItem(s:GameState,r:InventoryMoveRequest,point?:Pos){
 const w=s.world,m=w?.backpack?.inventory,u=s.units.find(u=>u.id===s.controlledBodyId),i=m?.items[r.id];
 if(!w||!m||!u||!i||!['team','safe','reserve'].includes(i.location.container)||u.crossing||u.forcedMotion)return {ok:false,reason:'当前物品不能丢弃'};
 const p=point??u.pos;if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!terrainFits(s,p,.08)||surface(s,p)?.layer!==surface(s,u.pos)?.layer||!clearShot(s,u.pos,p))return {ok:false,reason:'鼠标处不是同层可见的合法地面'};
 const d=m.definitions[i.definitionId],id=`drop:manual:${w.visit.generation}:${m.serial+1}:${i.id}`;if(m.containers[id])return {ok:false,reason:'掉落请求已处理'};
 m.containers[id]={id,name:d.name,kind:'grid',columns:d.width,rows:d.height,revision:0,placeId:w.visit.placeId,pos:{...u.pos}};
 const q=commitInventoryMove(s,{...r,to:id,toRevision:0,position:undefined,slot:undefined});if(!q.ok)delete m.containers[id];else m.containers[id].pos={...p};return q;
}
export function clearManualDrops(s:GameState){const m=s.world?.backpack?.inventory;if(!m)return;for(const id of Object.keys(m.containers).filter(id=>id.startsWith('drop:manual:'))){for(const i of Object.values(m.items))if(i.location.container===id)delete m.items[i.id];delete m.containers[id];}}
