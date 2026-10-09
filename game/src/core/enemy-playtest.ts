import {createEnemyFixture} from './en01-fixture';
import {registerEnemy,ZOMBIE,ARCHER} from './enemy-profiles';
import {navigate} from './navigation';
import {canStop,distance,clearShot} from './spatial';
export type EnemyPlaytestMode='zombie'|'ranged'|'mix';
/** Controlled named enemy placement on the existing main dungeon; no seed/terrain rewrite. */
export function createEnemyPlaytest(previousGeneration=0,mode:EnemyPlaytestMode='zombie',postureMode:'xinghai'|'reference'='xinghai'){
 const s=createEnemyFixture('melee',previousGeneration),h=s.units.find(u=>u.id==='hunter')!,template=s.units.find(u=>u.enemyV2)!;
 s.units=s.units.filter(u=>u.team==='ally');
 const families=mode==='mix'?['zombie','ranged'] as const:[mode];
 for(const family of families){const e=structuredClone(template),ranged=family==='ranged';
  const p=s.tiles.filter(t=>distance(t,h.pos)>=(ranged?5:3)&&distance(t,h.pos)<=(ranged?6:5)&&s.units.filter(u=>u.team==='enemy').every(u=>distance(t,u.pos)>1.5)&&canStop(s,t,e)&&clearShot(s,t,h.pos)&&navigate(s,h.pos,t,false,false).length).sort((a,b)=>(distance(a,h.pos)+Math.abs(a.y-h.pos.y)*.1)-(distance(b,h.pos)+Math.abs(b.y-h.pos.y)*.1)||b.x-a.x)[0];
  if(!p)throw Error('V2 playtest needs reachable main-map placement');e.pos={x:p.x,y:p.y};e.drawPos={...e.pos};e.heading=Math.atan2(h.pos.y-p.y,h.pos.x-p.x);e.id='v2-'+family;e.name=ranged?'骷髅弓':'僵尸';e.hp=e.maxHp=ranged?110:220;e.encounterRoom=s.exploration!.definition.encounters?.[0]?.room;registerEnemy(s,e,ranged?ARCHER:ZOMBIE);e.enemyV2!.readyAt=ranged?3:.6;s.units.push(e);
 }
 s.postureRuntime={generation:s.combatIdentity!.generation,mode:postureMode,trace:[]};
 for(const e of s.units.filter(u=>u.enemyV2)){e.maxPosture=e.posture=e.enemyVisualProfileId==='ranged'?60:90;}
 s.totalEnemies=families.length;s.notice='原僵尸／骷髅弓 · SOURCE＋SAMPLE · WASD / Z / RMB / Shift · Heavy未迁移';return s;
}
