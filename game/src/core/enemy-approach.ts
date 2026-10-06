import type {GameState,Unit} from './types';
import {isStandaloneExploration} from './exploration-party';
import {distance,faceToward,surface,radius} from './spatial';
import {combatStep} from './combat-step';
import {initialAbilityOffset} from './enemy-combat';
export type EnemyApproach={phase:'probe'|'burst';until:number;burstSeconds:number;speed:number;side:number;serial:number};
/** Short, deterministic pressure variation; skill/reaction/forced movement always own their clock. */
export function tickEnemyApproach(s:GameState,u:Unit,target:Unit|undefined,dt:number){
 const c=u.enemyCombat;if(!isStandaloneExploration(s)||!c)return false;
 if(!target||u.role==='ranged'||u.enemyMotion==='return'||u.attackIntent||c.reaction||u.forcedMotion||u.stagger>0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)){c.approach=undefined;return false;}
 const d=distance(u.pos,target.pos),serial=c.attackSerial??0;
 if(!c.approach&&c.approachSerial!==serial&&u.attackTimer<=0&&d>=1.8&&d<=3.2){
  const sample=initialAbilityOffset(u.id+':'+serial,s.explorationSeed??s.seed)/1.2;
  c.approachSerial=serial;const phase=sample<.65?'probe':'burst',burstSeconds=.2+sample*.2;
  c.approach={phase,until:s.time+(phase==='probe'?.2+sample*.25:burstSeconds),burstSeconds,speed:1.45+sample*.25,side:sample<.325?-1:1,serial};
 }
 const a=c.approach;if(!a)return false;faceToward(u,target.pos);
 if(d<=u.weapons[u.weaponIndex].range||d>4){c.approach=undefined;return false;}
 if(s.time>=a.until){if(a.phase==='probe'){a.phase='burst';a.until=s.time+a.burstSeconds;u.navWait=0;}else{c.approach=undefined;return false;}}
 if(a.phase==='burst')return false;
 u.path=[];u.destination=null;const dx=target.pos.x-u.pos.x,dy=target.pos.y-u.pos.y,len=Math.hypot(dx,dy)||1,from={...u.pos};
 const wanted={x:from.x-dy/len*a.side*1.1*dt,y:from.y+dx/len*a.side*1.1*dt},layer=surface(s,from)?.layer;
 const next=combatStep(s,u,from,wanted,layer,p=>!s.units.some(b=>b!==u&&b.life==='active'&&!b.shadowResident&&distance(b.pos,p)<radius(b)+radius(u)));
 u.pos=next;u.drawPos={...next};return true;
}
