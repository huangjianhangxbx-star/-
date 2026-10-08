import {createEnemyFixture} from './en01-fixture';
import {registerEnemy,ZOMBIE} from './enemy-profiles';
import {navigate} from './navigation';
import {canStop,distance,clearShot} from './spatial';
/** Controlled enemy placement on the existing main dungeon. No terrain/seed rewrite. */
export function createEnemyPlaytest(previousGeneration=0){
 const s=createEnemyFixture('melee',previousGeneration),h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.enemyV2)!;
 const p=s.tiles.filter(t=>distance(t,h.pos)>=3&&distance(t,h.pos)<=5&&canStop(s,t,e)&&clearShot(s,t,h.pos)&&navigate(s,h.pos,t,false,false).length).sort((a,b)=>distance(a,h.pos)-distance(b,h.pos))[0];
 if(!p)throw Error('V2 playtest needs reachable main-map placement');e.pos={x:p.x,y:p.y};e.drawPos={...e.pos};e.id='v2-zombie';e.name='僵尸';e.hp=e.maxHp=220;e.encounterRoom=s.exploration!.definition.encounters?.[0]?.room;registerEnemy(s,e,ZOMBIE);e.enemyV2!.readyAt=.6;s.notice='EN02 原僵尸 · SOURCE＋SAMPLE · WASD / Z / RMB / Shift';return s;
}
