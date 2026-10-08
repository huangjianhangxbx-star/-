import type {GameState,Unit,Pos} from './types';
import {distance,segmentClear,radius} from './spatial';
import {interruptEnemyV2} from './enemy-attack-entity';
/** Main map sweep, never a visual-only root-motion correction. No body teleports. */
export function moveEnemy(s:GameState,u:Unit,to:Pos,budget:number){
 const d=distance(u.pos,to);if(d<1e-8)return;
 const p={x:u.pos.x+(to.x-u.pos.x)*Math.min(1,budget/d),y:u.pos.y+(to.y-u.pos.y)*Math.min(1,budget/d)};
 if(segmentClear(s,u.pos,p,false,false,radius(u))){u.pos=p;u.drawPos={...p};}else u.path=[];
}
export function advanceEnemyDash(s:GameState,u:Unit){const st=u.enemyV2!;for(const key of ['dash','knock'] as const){const a=st[key];if(!a)continue;const until=Math.min(a.at+a.duration,s.time),elapsed=Math.max(0,until-a.lastAt);a.lastAt=until;moveEnemy(s,u,{x:u.pos.x+Math.cos(a.facing)*a.distance,y:u.pos.y+Math.sin(a.facing)*a.distance},a.distance*elapsed/a.duration);if(until>=a.at+a.duration)st[key]=undefined;}}
/** Incoming hardness and defensive hardness are separate SAMPLE fields; HP loss alone isn't interruption. */
export function reactEnemyContact(s:GameState,u:Unit,incoming:number,lost:number,origin?:Pos){if(lost<=0)return;const st=u.enemyV2!;st.hurtShownUntil=s.time+.12;if(incoming>(st.defensiveHardness??0)){interruptEnemyV2(s,u,'hurt');st.hurtAt=s.time;st.dash=undefined;if(origin)st.knock={at:s.time,lastAt:s.time,duration:.24,distance:.3,facing:Math.atan2(u.pos.y-origin.y,u.pos.x-origin.x)};}}
