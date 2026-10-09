import type {GameState,Unit,Pos} from './types';
import {distance,segmentClear,radius,surface} from './spatial';
import {interruptEnemyV2} from './enemy-attack-entity';
/** Main map sweep, never a visual-only root-motion correction. No body teleports. */
export function enemySpaceAvailable(s:GameState,u:Unit,p:Pos){return !s.postureRuntime||s.units.every(b=>b.id===u.id||b.shadowResident||b.life!=='active'||surface(s,b.pos)?.layer!==surface(s,p)?.layer||distance(b.pos,p)>=radius(u)+radius(b)-1e-7||distance(b.pos,u.pos)<radius(u)+radius(b)-1e-7&&distance(b.pos,p)>distance(b.pos,u.pos)+1e-7);}
export function moveEnemy(s:GameState,u:Unit,to:Pos,budget:number,slide=false){
 const d=distance(u.pos,to);if(d<1e-8||budget<=0)return;
 const start={...u.pos},length=Math.min(d,budget),facing=Math.atan2(to.y-start.y,to.x-start.x);
 const sweep=(angle:number)=>{const end={x:start.x+Math.cos(angle)*length,y:start.y+Math.sin(angle)*length};if(!segmentClear(s,start,end,false,false,radius(u)))return start;
  let p=start;const n=Math.max(1,Math.ceil(length/.025));for(let i=1;i<=n;i++){const next={x:start.x+(end.x-start.x)*i/n,y:start.y+(end.y-start.y)*i/n};if(!enemySpaceAvailable(s,u,next))break;p=next;}return p;};
 let p=sweep(facing);
 // Ordinary path following can go around bodies. Locked dash/knock never steer.
 if(slide&&s.postureRuntime&&distance(start,p)<length*.9){const sign=u.id.length%2?1:-1;for(const angle of [Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2]){const candidate=sweep(facing+angle*sign);if(distance(start,candidate)>distance(start,p)+.05){p=candidate;break;}}}
 if(distance(start,p)>1e-8){u.pos=p;u.drawPos={...p};}else u.path=[];
}
export function advanceEnemyDash(s:GameState,u:Unit){const st=u.enemyV2!;if(st.knock)st.dash=undefined;for(const key of ['knock','dash'] as const){const a=st[key];if(!a)continue;const until=Math.min(a.at+a.duration,s.time),elapsed=Math.max(0,until-a.lastAt);a.lastAt=until;moveEnemy(s,u,{x:u.pos.x+Math.cos(a.facing)*a.distance,y:u.pos.y+Math.sin(a.facing)*a.distance},a.distance*elapsed/a.duration);if(until>=a.at+a.duration)st[key]=undefined;}}
/** Incoming hardness and defensive hardness are separate SAMPLE fields; HP loss alone isn't interruption. */
export function reactEnemyContact(s:GameState,u:Unit,incoming:number,lost:number,origin?:Pos){if(lost<=0)return;const st=u.enemyV2!;st.hurtShownUntil=s.time+.12;if(incoming>(st.defensiveHardness??0)){interruptEnemyV2(s,u,'hurt');st.hurtAt=s.time;st.dash=undefined;if(origin)st.knock={at:s.time,lastAt:s.time,duration:.24,distance:.3,facing:Math.atan2(u.pos.y-origin.y,u.pos.x-origin.x)};}}
