import {createGame,command} from './engine';
import {canStop,clearShot} from './spatial';
import {configureCombatTrace,resetCombatTrace} from './combat-identity';
import type {EnemyV2Profile} from './enemy-action';

/** All numbers here are EN01 FIXTURE, not original enemy timing or balance. */
export const EN01_MELEE:EnemyV2Profile={id:'en01-sector',source:'EN01 FIXTURE',kind:'melee',range:1.8,minRange:0,detection:6,angle:.65,cooldown:2.5,power:5,arc:Math.PI*5/9,radius:.6,life:.1,travel:.9,spawnDelay:.35,deathPolicy:'retain',cancelPolicy:'retain',hurtSeconds:.24,events:[{kind:'prepare',at:0},{kind:'lock',at:0},{kind:'attack',at:.6},{kind:'attack-ready',at:1},{kind:'move-ready',at:1.1},{kind:'finish',at:1.2}]};
export const EN01_TRANSPORT:EnemyV2Profile={...EN01_MELEE,id:'en01-transport',kind:'transport',range:5,radius:.7,cooldown:3.5};
export function createEnemyFixture(kind:'melee'|'transport'='melee',previousGeneration=0){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});
 configureCombatTrace(s,true);if(previousGeneration){s.combatIdentity!.generation=previousGeneration;resetCombatTrace(s);}
 const h=s.units.find(u=>u.id==='hunter')!,enemy=s.units.find(u=>u.team==='enemy')!;
 const pos=Array.from({length:16},(_,i)=>({x:h.pos.x+Math.cos(i*Math.PI/8)*1.3,y:h.pos.y+Math.sin(i*Math.PI/8)*1.3})).find(p=>canStop(s,p,enemy)&&clearShot(s,h.pos,p));
 if(!pos)throw Error('EN01 fixture requires a reachable entry point');
 s.units=s.units.filter(u=>u.team==='ally');enemy.id='en01-enemy';enemy.name='单敌动作验证';enemy.role='melee';enemy.pos=pos;enemy.drawPos={...pos};enemy.hp=enemy.maxHp=40;enemy.heading=Math.atan2(h.pos.y-pos.y,h.pos.x-pos.x);enemy.directionalProfileId='neutral';
 enemy.enemyCombat=undefined;enemy.attackIntent=undefined;enemy.attackPending=undefined;enemy.engagement=undefined;enemy.pursuitTargetId=undefined;enemy.path=[];enemy.route=[];enemy.destination=null;enemy.ready=0;enemy.rewardKey=undefined;enemy.encounterRoom=undefined;enemy.encounterId=undefined;enemy.enemySense=undefined;
 enemy.enemyV2={profile:kind==='melee'?EN01_MELEE:EN01_TRANSPORT,generation:s.combatIdentity!.generation,readyAt:2,hurtUntil:0,trace:[]};s.units.push(enemy);
 s.totalEnemies=1;s.context='explorationBattle';s.notice='EN01 FIXTURE · WASD 移动，Z 切人，右键防御／射击，Shift 闪避，Space 暂停。';return s;
}
