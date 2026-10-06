import type {GameState,Pos,Unit} from './types';
import {aimActor,usesExplorationControl} from './exploration-control';
import {navigate} from './navigation';
import {canStop,near,radius} from './spatial';
import {positionKnown} from './visibility';
import {activeEncounters,pathSafeFromInactiveEncounters} from './encounter-domain';

export type PathAimPreview={valid:boolean;path:Pos[];destination:Pos|null;reason?:string};
/** Pure destination legality. Readiness is intentionally checked only at commit. */
export function queryPathAimPreview(s:GameState,u:Unit,to:Pos):PathAimPreview {
 const fail=(reason:string):PathAimPreview=>({valid:false,path:[],destination:null,reason});
 if(!usesExplorationControl(s)||u.life!=='active'||u.cloneOf||!Number.isFinite(to.x)||!Number.isFinite(to.y))return fail('无效选路目标');
 if(!positionKnown(s,to))return fail('未知区域，请直接移动探索');
 if(!canStop(s,to,u))return fail('落点受地形、单位或预留位置阻挡');
 const path=navigate(s,u.pos,to,false,true,radius(u));
 if(!path.length&&!near(u.pos,to))return fail('路径受阻，无法抵达');
 if(s.explorationControl?.aim?.source==='command'&&aimActor(s)?.id===u.id&&!pathSafeFromInactiveEncounters(s,[u.pos,...path],false))return fail('指令路径会进入未交战敌人的警戒范围');
 return {valid:true,path,destination:{...to}};
}
/** One-entry presentation cache. No runtime path/hover state; confirm bypasses it. */
export class PathAimPreviewCache {
 private key='';private value:PathAimPreview|undefined;
 query(s:GameState,u:Unit,to:Pos){
  const key=JSON.stringify([s.phase,s.context,s.controlledBodyId,s.explorationControl,s.explorationCompanionId,u.id,u.pos,radius(u),s.tiles.map(t=>[t.x,t.y,t.layer,t.obstacle]),s.barricades,s.units.map(a=>[a.id,a.team,a.life,a.cloneOf,a.shadowResident,a.pos,a.destination,radius(a),a.encounterRoom]),s.lights,s.exploration?.memory.seen,activeEncounters(s).map(a=>a.room),to]);
  if(key!==this.key||!this.value){this.key=key;this.value=queryPathAimPreview(s,u,to);}
  return this.value;
 }
}
