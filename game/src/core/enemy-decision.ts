import type {GameState,Unit,Pos} from './types';
import {decideEnemyTarget,enemyCanMove} from './enemy-action';
import {distance,terrainFits,clearShot} from './spatial';
import {navigate} from './navigation';
import {moveEnemy,advanceEnemyDash,enemySpaceAvailable} from './enemy-motion';
/** SAMPLE: 3s memory, 12U leash, .6s replanning. No hidden live target position is consumed. */
export function tickEnemyDecision(s:GameState,u:Unit,dt:number):Unit|undefined{
 const st=u.enemyV2!,b=st.brain;if(!b)return decideEnemyTarget(s,u);const rootMotion=!!st.dash||!!st.knock;advanceEnemyDash(s,u);
 if(!enemyCanMove(u)||s.time<st.hurtUntil){u.path=[];return;}
 const senseDue=s.time>=(b.senseAt??-Infinity);
 // Lifecycle invalidation is not target-position knowledge. A dead known body
 // must not consume the stickiness window when a living body is actually seen.
 if(b.known&&!s.units.some(t=>t.id===b.known!.id&&t.life==='active'&&!t.shadowResident))b.known=undefined;
 const seen=distance(u.pos,b.home)<=12?decideEnemyTarget(s,u,t=>senseDue?(distance(u.pos,t.pos)<.1||navigate(s,u.pos,t.pos,false,false,undefined,{remaining:500}).length>0):t.id===b.seenId):undefined;
 if(senseDue){b.senseAt=s.time+.2;b.seenId=seen?.id;}
 // Target stickiness cannot keep a newly isolated visible body forever. Unseen
 // targets retain only their last observed point; do not query their live path.
 if(senseDue&&b.known&&b.known.id!==seen?.id){const old=s.units.find(t=>t.id===b.known!.id);if(old&&old.life==='active'&&!old.shadowResident&&old.ready<=0&&distance(u.pos,old.pos)<=st.profile.detection&&clearShot(s,u.pos,old.pos)&&distance(u.pos,old.pos)>=.1&&!navigate(s,u.pos,old.pos,false,false,undefined,{remaining:500}).length)b.known=undefined;}
 if(seen){if(b.known?.id===seen.id||!b.known||s.time-(b.chosenAt??-Infinity)>.6&&distance(u.pos,seen.pos)+.8<distance(u.pos,b.known.point)){if(b.known?.id!==seen.id)b.chosenAt=s.time;b.known={id:seen.id,point:{...seen.pos},at:s.time};}else {const old=s.units.find(t=>t.id===b.known!.id);if(old&&old.life==='active'&&!old.shadowResident&&old.ready<=0&&distance(u.pos,old.pos)<=st.profile.detection&&clearShot(s,u.pos,old.pos))b.known={id:old.id,point:{...old.pos},at:s.time};}}
 const k=b.known,known=k&&s.time-k.at<=3&&distance(u.pos,b.home)<=12;let goal:Pos|undefined,target:Unit|undefined;
 if(known){const current=s.units.find(t=>t.id===k.id);target=current&&current.life==='active'&&!current.shadowResident&&current.ready<=0&&distance(u.pos,current.pos)<=st.profile.detection&&clearShot(s,u.pos,current.pos)?current:undefined;u.pursuitTargetId=k.id;u.enemyMotion='engaged';
  const d=distance(u.pos,k.point),ranged=st.profile.kind==='transport';
  if(ranged&&target&&d<4){const cached=b.decision==='retreat'&&b.goal&&u.path.length&&s.time<b.repathAt&&enemySpaceAvailable(s,u,b.goal);b.decision='retreat';const away=Math.atan2(u.pos.y-k.point.y,u.pos.x-k.point.x);goal=cached?b.goal:Array.from({length:9},(_,i)=>{const a=away+(i===0?0:Math.ceil(i/2)*Math.PI/8*(i%2?1:-1));return {x:u.pos.x+Math.cos(a)*1.5,y:u.pos.y+Math.sin(a)*1.5};}).find(p=>terrainFits(s,p)&&enemySpaceAvailable(s,u,p)&&navigate(s,u.pos,p,false,false,undefined,{remaining:250}).length>0);}
  else if(target&&d<= (ranged?6:1.3)){b.decision='ready';u.path=[];}
  else {b.decision=target?'approach':'search';goal={...k.point};}
 }else{b.known=undefined;u.pursuitTargetId=undefined;u.enemyMotion='return';b.decision=distance(u.pos,b.home)<.1?'idle':'return';goal=b.decision==='return'?b.home:undefined;}
 if(goal){if(s.time>=b.repathAt||!b.goal||distance(b.goal,goal)>.8){b.goal={...goal};b.repathAt=s.time+.6;u.path=navigate(s,u.pos,goal,false,false,undefined,{remaining:500});}if(u.path.length&&!rootMotion){const p=u.path[0];moveEnemy(s,u,p,u.speed*dt,true);if(distance(u.pos,p)<.03)u.path.shift();}}
 else u.path=[];
 const point=known?k.point:u.path[0];if(point){const desired=Math.atan2(point.y-u.pos.y,point.x-u.pos.x),delta=Math.atan2(Math.sin(desired-(u.heading??0)),Math.cos(desired-(u.heading??0)));u.heading=(u.heading??0)+Math.max(-dt*3,Math.min(dt*3,delta));}
 return target;
}
