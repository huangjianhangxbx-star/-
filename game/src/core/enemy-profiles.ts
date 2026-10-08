import type {GameState,Unit} from './types';
import type {EnemyV2Profile} from './enemy-action';
/** SOURCE event times / dash; all AI, geometry, recovery and hardness are declared SAMPLE. */
export const ZOMBIE:EnemyV2Profile={id:'僵尸_攻击',source:'SOURCE + SAMPLE',visual:'zombie',kind:'melee',range:1.6,minRange:0,detection:8,angle:35*Math.PI/180,cooldown:1.5,power:5,arc:1.6,radius:.6,life:.1,travel:0,spawnDelay:0,deathPolicy:'clear',cancelPolicy:'retain',hurtSeconds:.24,dash:{distance:.7,duration:.2},events:[{kind:'prepare',at:0},{kind:'lock',at:0},{kind:'dash',at:.5667},{kind:'attack',at:.5667},{kind:'attack-ready',at:2},{kind:'move-ready',at:2},{kind:'finish',at:2}]};
/** Original Hit/Lock, duration and nominal attack; geometry/AI/recovery are AL03 SAMPLE. */
export const ARCHER:EnemyV2Profile={id:'骷髅弓射箭',source:'SOURCE + SAMPLE',visual:'ranged',kind:'transport',range:9,minRange:1,detection:9,angle:35*Math.PI/180,cooldown:4.2,power:3,arc:0,radius:.8,life:.1,travel:.92,spawnDelay:0,deathPolicy:'retain',cancelPolicy:'retain',hurtSeconds:.24,events:[{kind:'prepare',at:0},{kind:'lock',at:.6333},{kind:'attack',at:.6333},{kind:'attack-ready',at:1.2},{kind:'move-ready',at:1.2},{kind:'finish',at:1.2}]};
export function registerEnemy(s:GameState,u:Unit,p:EnemyV2Profile){
 if(p.source==='SOURCE + SAMPLE'&&!p.visual)throw Error('Named enemy needs an explicit original visual profile');
 u.enemyVisualProfileId=p.visual;u.enemyCombat=undefined;u.attackIntent=undefined;u.attackPending=undefined;u.enemySense=undefined;u.engagement=undefined;u.path=[];u.route=[];u.destination=null;u.directionalProfileId='neutral';u.speed=1.2;u.ready=0;
 u.enemyV2={profile:p,generation:s.combatIdentity?.generation??1,readyAt:s.time+2.5,hurtUntil:0,trace:[],brain:{home:{...u.pos},decision:'idle',repathAt:0}};
}
