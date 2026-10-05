import {healHealth} from './pressure';
import type {GameState,Unit,Weapon,ResolvedSkill,SkillRun,SkillEcho,Status,SkillId} from './types';
import {currentSkill} from './progression';
import {positionVisible} from './visibility';
import {resolveSkill} from './skill-catalog';
import {distance,inWeaponRange,surface,radius,clearShot,segmentClear,faceToward,canStop} from './spatial';
import {planReapPath,reapReturnPath,segmentDistance,REAP_SPACE} from './reap-path';
import {navigate} from './navigation';

export type HitOptions={hitOrigin?:Unit['pos'];originKind?:'direct'|'delayed'|'field';impact?:import('./impact').ImpactSpec;postureDamage?:number;reclaimRate?:number;reclaimBudget?:number;eventId?:number;castId?:number;skillId?:SkillId;derived?:boolean;ignore?:number;at?:number;kind?:'hit'|'basic'|'arrow'};
export type SkillHost={hit:(s:GameState,t:Unit,w:Weapon,power:number,u?:Unit,options?:HitOptions)=>boolean};
const cp=(p:{x:number;y:number})=>({...p});
const alive=(u:Unit)=>u.life==='active'&&!u.shadowResident;
const level=(r:ResolvedSkill,b:string)=>r.branches[b]||0;
function enemies(s:GameState,u:Unit,p=u.pos,range=u.weapons[u.weaponIndex].range,remote=true){return s.units.filter(a=>a.team!==u.team&&alive(a)&&inWeaponRange(s,{...u,pos:p},a.pos,{range,remote})).sort((a,b)=>Number(b.engagement?.targetId===u.id)-Number(a.engagement?.targetId===u.id)||distance(a.pos,p)-distance(b.pos,p)||a.id.localeCompare(b.id));}
const allies=(s:GameState,u:Unit,p=u.pos,r=3)=>s.units.filter(a=>a.team===u.team&&alive(a)&&distance(a.pos,p)<=r+1e-7);
export function status(u:Unit,kind:Status['kind'],power:number,remaining:number,source:string,name:string){
 if(remaining<=0)return;const found=u.statuses.find(st=>st.kind===kind&&st.source===source);
 if(found)Object.assign(found,{power,remaining,duration:remaining,name});else u.statuses.push({kind,power,remaining,duration:remaining,source,name});
}
export function attackStrength(u:Unit){return u.weapons[u.weaponIndex].damage*(u.mental==='inspired'?1.25:u.mental==='distressed'?.8:1)*(1+u.statuses.filter(a=>a.kind==='attack'&&a.remaining>0).reduce((n,a)=>n+a.power,0));}
export function newRun(s:GameState,u:Unit):SkillRun{
 const spec=resolveSkill(u);return {id:s.nextId++,spec:structuredClone(spec),power:attackStrength(u),maxHp:u.maxHp,weapon:{...u.weapons[u.weaponIndex],postureDamage:spec.postureDamage,reclaimRate:spec.reclaimRate,reclaimBudget:spec.reclaimBudget},origin:cp(u.pos),heading:u.heading||0,elapsed:0,nextSlot:0,fired:0,nextTrace:.4,counts:{},inside:{},seen:[]};
}
function feedback(s:GameState,u:Unit,center=u.pos,color='#9cd4c4'){
 s.effects.push({id:s.nextId++,sourceId:u.id,asset:u.asset,action:'skill',from:cp(center),to:cp(center),color,kind:'burst',remaining:.45});
}
function heal(s:GameState,u:Unit,a:Unit,value:number,r:ResolvedSkill){
 const over=Math.max(0,value-(a.maxHp-a.hp));healHealth(a,value);
 const b=level(r,'C');if(r.id==='pain'&&b&&over>0){const source='pain-shield:'+u.id,old=a.statuses.find(st=>st.kind==='shield'&&st.source===source);status(a,'shield',Math.min(a.maxHp*(b===2?.12:.08),(old?.power||0)+over*(b===2?.75:.5)),b===2?5:4,source,'余愈结晶');}
}
function painWave(s:GameState,u:Unit,run:SkillRun,factor:number){
 const r=run.spec,targets=allies(s,u,run.origin,r.range),amount=run.maxHp*run.fired*.02*factor;
 for(const a of targets){heal(s,u,a,amount,r);const A=level(r,'A');if(A)status(a,'warding',A===2?.35:.2,4,'pain-ward:'+u.id,'合契护纹');}
 const B=level(r,'B'),lowest=targets.slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id.localeCompare(b.id));
 if(B&&lowest[0])heal(s,u,lowest[0],amount*(B===2?.55:.35),r);
 if(B===2&&lowest[1])heal(s,u,lowest[1],amount*.25,r);
 feedback(s,u,run.origin);
}
function echo(s:GameState,u:Unit,run:SkillRun,kind:SkillEcho['kind'],delay:number,factor=1){
 (s.skillEffects??=[]).push({id:s.nextId++,castId:run.id,sourceId:u.id,source:structuredClone(u),skillId:run.spec.id,at:s.time+delay,kind,center:cp(run.origin),heading:run.heading,spec:structuredClone(run.spec),power:run.power,maxHp:run.maxHp,weapon:{...run.weapon},hits:[],factor});
}
export function castSpecial(s:GameState,u:Unit):boolean{
 const st=currentSkill(u),r=resolveSkill(u);
 if(r.id==='pain'){
  if(st.counter<=0)return false;const run=newRun(s,u);run.fired=st.counter;st.counter=0;
  painWave(s,u,run,1);if(r.tier>=1){echo(s,u,run,'painEcho',.7,.35);s.skillEffects!.at(-1)!.power=run.fired;}
  if(r.tier>=2){echo(s,u,run,'painEcho',1.4,.25);s.skillEffects!.at(-1)!.power=run.fired;}
  u.attackFlash=.35;s.stats.skills=(s.stats.skills||0)+1;return true;
 }
 if(r.id==='sanctuary'){st.run=newRun(s,u);st.snapshot=structuredClone(r);st.time=r.duration;st.cd=0;u.attackPending=undefined;feedback(s,u);s.stats.skills=(s.stats.skills||0)+1;return true;}
 return false;
}
function field(s:GameState,u:Unit,run:SkillRun,dt:number){
 const r=run.spec,prev={...run.inside};run.elapsed+=dt;
 const enemies=s.units.filter(a=>a.team!==u.team&&alive(a));
 for(const e of enemies){const inField=inWeaponRange(s,{...u,pos:run.origin},e.pos,{range:r.range,remote:true}),source='field:'+u.id;
  if(inField){run.inside[e.id]=(run.inside[e.id]||0)+dt;
   const core=r.tier===2&&distance(run.origin,e.pos)<=1.6;
   const B=level(r,'B'),growth=B?Math.min(3,Math.floor((run.inside[e.id]+1e-8)/2))*(B===2?.1:.06):0;
   status(e,'resistBreak',Math.min(.7,.25+(core?.15:0)+growth),r.tier>0?2:.1,source,'静钟削抗');status(e,'slow',.3,r.tier>0?2:.1,source,'静钟迟滞');
   const A=level(r,'A');if(A&&!run.seen.includes(e.id)){status(e,'slow',A===2?.8:.65,A===2?1.5:1,'field-entry:'+run.id,'迟滞涟漪');run.seen.push(e.id);}
  }else if(prev[e.id]){delete run.inside[e.id];if(r.tier>0){status(e,'resistBreak',.25,2,source,'静钟残响');status(e,'slow',.3,2,source,'静钟残响');}else e.statuses=e.statuses.filter(a=>a.source!==source);}
 }
 const covered=allies(s,u,run.origin,r.range),C=level(r,'C');
 for(const a of covered){run.inside['ally:'+a.id]=1;a.statuses=a.statuses.filter(b=>b.source!=='field-trail:'+u.id);}
 if(C)for(const [key] of Object.entries(prev)){if(!key.startsWith('ally:'))continue;const a=s.units.find(a=>a.id===key.slice(5));if(!a||!alive(a)||covered.includes(a))continue;delete run.inside[key];status(a,'regen',run.maxHp*.01,C===2?5:3,'field-trail:'+u.id,'接力烛火');
  if(C===2){const other=allies(s,u,a.pos,1).filter(b=>b.id!==a.id).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id.localeCompare(b.id))[0];if(other)healHealth(other,run.maxHp*.02);}
 }
 while(run.nextSlot+.5<=run.elapsed+1e-8){run.nextSlot+=.5;for(const a of covered)healHealth(a,run.maxHp*.005);if(r.tier===2&&Math.abs(run.nextSlot/3-Math.round(run.nextSlot/3))<1e-7)for(const a of covered.filter(a=>distance(a.pos,run.origin)<=1.6))healHealth(a,run.maxHp*.005);feedback(s,u,run.origin);}
}
/** Timed fields own their clock; legacy timed skills keep the existing clock. */
export function tickSpecial(s:GameState,u:Unit,dt:number,host:SkillHost):boolean{
 const st=currentSkill(u),r=st.snapshot||resolveSkill(u);
 if(r.id==='rain')return rain(s,u,dt,host);
 if(r.id==='dance'){if(!st.enabled&&st.cd<=1e-8&&!u.crossing&&!u.recall&&!u.loadout&&u.ready<=0){st.enabled=true;feedback(s,u,u.pos,'#d685bc');}return false;}
 if(r.id==='reap')return reap(s,u,dt,host);
 if(r.id==='sanctuary'&&st.run&&st.time>0){const used=Math.min(dt,st.time);field(s,u,st.run,used);st.time=Math.max(0,st.time-used);if(st.time<=1e-8){st.time=0;st.cd=st.max;st.run=undefined;st.snapshot=undefined;settleFields(s);}return true;}
 return false;
}
export function tickEchoes(s:GameState,host:SkillHost){
 settleFields(s);
 const remaining:SkillEcho[]=[];
 for(const e of s.skillEffects||[]){if(e.at>s.time+1e-8){remaining.push(e);continue;}const present=s.units.find(a=>a.id===e.sourceId),u=present||e.source;if(!u||!present&&e.kind==='seat')continue;
  if(e.kind==='painEcho'){const run:SkillRun={id:e.castId,spec:e.spec,power:0,maxHp:e.maxHp,weapon:e.weapon,origin:e.center,heading:e.heading,elapsed:0,nextSlot:0,fired:e.power,nextTrace:0,counts:{},inside:{},seen:[]};painWave(s,u,run,e.factor||1);}
  if(e.kind==='snipeEcho')for(const t of lineTargets(s,u,e.center,e.heading,e.spec.range).slice(0,2))host.hit(s,t,e.weapon,e.power*.25,u,{derived:true,skillId:'snipe',castId:e.castId,ignore:level(e.spec,'A')===2?.55:level(e.spec,'A')?.35:0});
  if(e.kind==='rainTrace'){
   if((e.expires||0)<=s.time)continue;
   for(const t of enemies(s,u,e.center,e.radius||.6).filter(t=>!e.hits.includes(t.id))){e.hits.push(t.id);for(let i=0;i<(level(e.spec,'C')===2?6:4);i++)host.hit(s,t,e.weapon,e.power*.025,u,{derived:true,skillId:'rain',castId:e.castId});}
   remaining.push(e);
  }
  if(e.kind==='backslash')for(const t of scytheTargets(s,u,e.center,e.heading,e.spec.range,e.spec.tier===2))host.hit(s,t,e.weapon,e.power*.35,u,{derived:true,skillId:'dance',castId:e.castId});
  if(e.kind==='scytheTrace'||e.kind==='seat'){
   if((e.expires||0)<=s.time||e.kind==='seat'&&!e.detached&&currentSkill(u).run?.id!==e.castId)continue;
   const targets=e.kind==='seat'?enemies(s,u,e.center,.9,false):scytheTargets(s,u,e.center,e.heading,e.spec.range).filter(t=>distance(t.pos,e.center)>=e.spec.range-.3);
   for(const t of targets.filter(t=>!e.hits.includes(t.id))){e.hits.push(t.id);const hit=host.hit(s,t,e.weapon,e.power,u,{derived:true,skillId:e.skillId,castId:e.castId});if(hit&&e.kind==='seat')status(t,'slow',level(e.spec,'C')===2?.4:.25,level(e.spec,'C')===2?1:.6,'seat:'+e.castId,'留席月轮');}
   remaining.push(e);
  }
 }
 s.skillEffects=remaining;
}

/** Remove live-only growth/core bonuses once a field ends, without renewing its tail. */
export function settleFields(s:GameState){for(const target of s.units){target.statuses=target.statuses.filter(st=>{
 if(!st.source?.startsWith('field:')||st.name==='静钟残响')return true;
 const source=st.source;const caster=s.units.find(u=>u.id===source.slice(6));if(caster?.skillStates?.sanctuary?.run&&alive(caster))return true;
 if((st.duration||0)<1)return false;st.name='静钟残响';st.power=st.kind==='resistBreak'?.25:.3;st.remaining=Math.min(2,st.remaining);return true;
});}}

/** A cancelled body slide settles physically; ordinary navigation resumes afterwards. */
export function advanceReapLanding(s:GameState,u:Unit,dt:number):boolean{
 const landing=u.skillLanding;if(!landing)return false;
 if(canStop(s,u.pos,u)){const after=landing.after;u.skillLanding=undefined;if(after){u.path=navigate(s,u.pos,after,false,true,radius(u));u.destination=u.path.length?cp(after):null;u.intent=u.path.length?'move':null;}return false;}
 let path=landing.path;if(!path?.length||!segmentClear(s,u.pos,path[0],false,false,radius(u)))path=landing.path=reapReturnPath(s,u,u.pos,landing.origin)||[];
 if(!path.length){u.skillLanding=undefined;u.direct=undefined;s.notice='回镰落位通路受阻，请重新指定移动';return true;}
 let travel=REAP_SPACE.speed*dt;
 while(travel>1e-8&&path.length){const next=path[0],len=distance(u.pos,next),used=Math.min(travel,len);if(!segmentClear(s,u.pos,next,false,false,radius(u))){landing.path=undefined;break;}
  faceToward(u,next);const f=len>1e-8?used/len:1;u.pos={x:u.pos.x+(next.x-u.pos.x)*f,y:u.pos.y+(next.y-u.pos.y)*f};u.drawPos=cp(u.pos);travel-=used;if(used>=len-1e-8)path.shift();
 }
 return true;
}

function scytheTargets(s:GameState,u:Unit,p:Unit['pos'],heading:number,range:number,back=false){return enemies(s,u,p,range,false).filter(t=>{const theta=Math.atan2(t.pos.y-p.y,t.pos.x-p.x)-heading,angle=Math.atan2(Math.sin(theta),Math.cos(theta));return Math.abs(angle)<=Math.PI/3+1e-8||back&&Math.abs(angle)>=Math.PI*.75-1e-8;});}
export function scytheSweep(s:GameState,u:Unit,target:Unit,host:SkillHost):boolean{
 const r=resolveSkill(u),st=currentSkill(u);if(r.id!=='dance'||!st.enabled)return false;
 const run=newRun(s,u);run.heading=Math.atan2(target.pos.y-u.pos.y,target.pos.x-u.pos.x);run.power*=1.15;
 let count=0;const A=level(r,'A');
 for(const t of scytheTargets(s,u,u.pos,run.heading,r.range)){
  const crack=t.statuses.some(a=>a.kind==='crack'&&a.source==='crack:'+u.id&&a.remaining>0);
  if(host.hit(s,t,run.weapon,run.power+(A&&crack?attackStrength(u)*(A===2?.35:.2):0),u,{skillId:'dance',castId:run.id,kind:'basic'})){count++;if(A&&alive(t))status(t,'crack',1,A===2?4:3,'crack:'+u.id,'裂帛');}
 }
 const B=level(r,'B');if(B)healHealth(u,Math.min(B===2?5:3,count)*u.maxHp*(B===2?.0125:.01));
 if(r.tier>0)echo(s,u,run,'backslash',.2);
 const C=level(r,'C');if(C){s.skillEffects=(s.skillEffects||[]).filter(e=>e.kind!=='scytheTrace'||e.sourceId!==u.id);echo(s,u,run,'scytheTrace',0);const trace=s.skillEffects!.at(-1)!;trace.expires=s.time+(C===2?1:.6);trace.power=attackStrength(u)*(C===2?.4:.25);}
 return true;
}
function reapHit(s:GameState,u:Unit,run:SkillRun,a:Unit['pos'],b:Unit['pos'],back:boolean,host:SkillHost){
 const hits=back?run.backHits!:run.outHits!,r=run.spec;
 for(const t of s.units.filter(t=>t.team!==u.team&&alive(t)&&!hits.includes(t.id)&&surface(s,t.pos)?.layer===surface(s,a)?.layer&&segmentDistance(t.pos,a,b)<=radius(t)+REAP_SPACE.width&&clearShot(s,a,t.pos))){
  hits.push(t.id);const A=level(r,'A'),factor=back?1.4*(A&&run.outHits!.includes(t.id)?1+(A===2?.65:.4):1):2;
  host.hit(s,t,run.weapon,run.power*factor,u,{derived:true,skillId:'reap',castId:run.id});
 }
 const B=level(r,'B');if(back&&B)for(const friend of s.units.filter(t=>t.team===u.team&&t.id!==u.id&&alive(t)&&!run.healed!.includes(t.id)&&segmentDistance(t.pos,a,b)<=(B===2?1.2:.9))){run.healed!.push(friend.id);healHealth(friend,run.maxHp*(B===2?.05:.03));}
}
function reapBurst(s:GameState,u:Unit,run:SkillRun,p:Unit['pos'],range:number,host:SkillHost){for(const t of enemies(s,u,p,range,false))host.hit(s,t,run.weapon,run.power*.8,u,{derived:true,skillId:'reap',castId:run.id});feedback(s,u,p,'#d685bc');}
function endReap(s:GameState,u:Unit,run:SkillRun,normal:boolean,host:SkillHost){
 if(normal&&run.spec.tier===2)reapBurst(s,u,run,u.cloneOf?run.virtual!:u.pos,1.2,host);
 const st=currentSkill(u);st.run=undefined;st.snapshot=undefined;u.destination=null;u.intent=null;u.attackPending=undefined;
 if(!u.cloneOf&&!canStop(s,u.pos,u))u.skillLanding={origin:cp(u.pos)};
}
function reap(s:GameState,u:Unit,dt:number,host:SkillHost):boolean{
 const st=currentSkill(u);if(!st.run){if(st.counter<5||u.ready>0||u.direct||u.path.length||u.crossing||u.recall||u.loadout||u.rescueTarget)return false;const choice=planReapPath(s,u);if(!choice)return false;
  const run=st.run=newRun(s,u);run.heading=choice.heading;run.route=[choice.end];run.phase='out';run.cursor=0;run.virtual=cp(u.pos);run.outHits=[];run.backHits=[];run.healed=[];st.counter=0;st.snapshot=run.spec;u.attackPending=undefined;u.attackTimer=u.weapons[u.weaponIndex].attackPeriod??u.attackPeriod;if(!u.cloneOf)u.destination=cp(run.origin);s.stats.skills=(s.stats.skills||0)+1;
  const C=level(run.spec,'C');if(C){echo(s,u,run,'seat',0);const seat=s.skillEffects!.at(-1)!;seat.power=run.power*(C===2?.8:.5);seat.expires=s.time+2;}
 }
 const run=st.run;run.elapsed+=dt;
 if(run.phase==='turn'){run.nextSlot+=dt;if(run.nextSlot<REAP_SPACE.pause-1e-8)return true;
  const from=u.cloneOf?run.virtual!:u.pos;const path=u.cloneOf?[cp(run.origin)]:reapReturnPath(s,u,from,run.origin);if(path===null){endReap(s,u,run,false,host);s.notice='回镰返程受阻，停在可达位置';return true;}run.route=path;run.cursor=0;run.phase='back';}
 let left=dt*REAP_SPACE.speed;
 while(left>1e-8){const from=cp(u.cloneOf?run.virtual!:u.pos),next=run.route?.[run.cursor||0];
  if(!next){if(run.phase==='out'){if(run.spec.tier>0)reapBurst(s,u,run,from,1,host);run.phase='turn';run.nextSlot=0;}else endReap(s,u,run,true,host);break;}
  if(!segmentClear(s,from,next,false,false,radius(u))||surface(s,from)?.layer!==surface(s,next)?.layer){if(run.phase==='back'){const path=u.cloneOf?null:reapReturnPath(s,u,from,run.origin);if(path){run.route=path;run.cursor=0;continue;}}endReap(s,u,run,false,host);s.notice='回镰路径变化，行动已结束';break;}
  const len=distance(from,next),travel=Math.min(left,len),p=len<1e-8?cp(next):{x:from.x+(next.x-from.x)*travel/len,y:from.y+(next.y-from.y)*travel/len};
  reapHit(s,u,run,from,p,run.phase==='back',host);run.virtual=p;if(!u.cloneOf){faceToward(u,next);u.pos=cp(p);u.drawPos=cp(p);}left-=travel;
  if(len<=travel+1e-8){run.cursor=(run.cursor||0)+1;if(run.phase==='back'&&!u.cloneOf&&run.cursor===run.route!.length&&!canStop(s,p,u)){const path=reapReturnPath(s,u,p,run.origin);if(path){run.route=path;run.cursor=0;continue;}endReap(s,u,run,false,host);break;}}
  if(run.elapsed-(run.counts.fx||0)>=.1){run.counts.fx=run.elapsed;s.effects.push({id:s.nextId++,kind:'shot',sourceId:u.id,from,to:cp(p),color:'#d685bc',remaining:.15});}
 }
 return true;
}

function lineTargets(s:GameState,u:Unit,p:Unit['pos'],heading:number,range:number){
 const dx=Math.cos(heading),dy=Math.sin(heading);
 return enemies(s,u,p,range).filter(t=>{const x=t.pos.x-p.x,y=t.pos.y-p.y;return x*dx+y*dy>0&&Math.abs(x*dy-y*dx)<=.25;}).sort((a,b)=>distance(a.pos,p)-distance(b.pos,p)||a.id.localeCompare(b.id));
}
/** Called once for an original shot; every follow-up carries a derived source. */
export function sniper(s:GameState,u:Unit,target:Unit,power:number,host:SkillHost):boolean{
 const r=resolveSkill(u),st=currentSkill(u);if(r.id!=='snipe'||!st.enabled)return false;
 const run=newRun(s,u);run.heading=Math.atan2(target.pos.y-u.pos.y,target.pos.x-u.pos.x);run.power=power;
 const A=level(r,'A'),ignore=A===2?.55:A?.35:0,hit=host.hit(s,target,run.weapon,power,u,{skillId:'snipe',castId:run.id,ignore,kind:'basic',impact:{distance:1.6,origin:cp(u.pos),wallPin:true,wallPinStagger:1.4}});
 const B=level(r,'B');if(hit&&alive(target)&&B&&(st.targetClocks?.[target.id]??-Infinity)<=s.time){status(target,'slow',B===2?.8:.65,B===2?1.5:1,'pin:'+u.id,'钉影');(st.targetClocks??={})[target.id]=s.time+3;}
 if(r.tier>=1){const behind=lineTargets(s,u,u.pos,run.heading,r.range).filter(t=>t.id!==target.id&&distance(t.pos,u.pos)>distance(target.pos,u.pos)+1e-7)[0];if(behind)host.hit(s,behind,run.weapon,power*.35,u,{derived:true,skillId:'snipe',castId:run.id,ignore});}
 if(r.tier>=2)echo(s,u,run,'snipeEcho',.35);
 const C=level(r,'C');if(hit&&target.life==='dead'&&C){const other=enemies(s,u,u.pos,r.range).filter(t=>positionVisible(s,t.pos)&&distance(t.pos,target.pos)<=(C===2?2.8:2)).sort((a,b)=>distance(a.pos,target.pos)-distance(b.pos,target.pos)||a.id.localeCompare(b.id))[0];if(other)host.hit(s,other,run.weapon,power*(C===2?.7:.45),u,{derived:true,skillId:'snipe',castId:run.id,ignore});}
 return true;
}
function rain(s:GameState,u:Unit,dt:number,host:SkillHost):boolean{
 const st=currentSkill(u);if(!st.run){if(st.cd>1e-8||u.ready>0||u.recall||u.crossing||u.loadout||u.rescueTarget)return false;const run=st.run=newRun(s,u);run.startedAt=Math.max(st.readyAt??s.time-dt,s.time-dt);st.snapshot=run.spec;st.time=run.spec.duration;u.attackPending=undefined;s.stats.skills=(s.stats.skills||0)+1;}
 const run=st.run,r=run.spec,elapsed=Math.min(r.duration,s.time-run.startedAt!);
 while(run.nextSlot*.008<elapsed-1e-8&&run.nextSlot*.008<r.duration-1e-8){
  const slot=run.nextSlot++,at=run.startedAt!+slot*.008;
  if(u.direct||u.path.length||u.crossing||u.recall||u.loadout||(u.stagger>0||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)))continue;
  const target=enemies(s,u,u.pos,r.range).find(t=>positionVisible(s,t.pos));if(!target)continue;
  run.fired++;s.stats.rainArrows=(s.stats.rainArrows||0)+1;
  const A=level(r,'A'),wedge=A>0&&run.fired%(A===2?16:24)===0;
  const hit=host.hit(s,target,run.weapon,run.power*(wedge?(A===2?.35:.25):.025),u,{originKind:'field',skillId:'rain',castId:run.id,ignore:wedge?.5:0,at,kind:'arrow'});
  run.virtual=cp(target.pos);run.counts.traceFire=(run.counts.traceFire||0)+1;
  const B=level(r,'B');if(hit&&alive(target)&&B){run.counts[target.id]=(run.counts[target.id]||0)+1;if(run.counts[target.id]>=(B===2?12:20)){run.counts[target.id]=0;status(target,'slow',B===2?.4:.25,1,'rain-net:'+u.id,'织网');}}
  if(r.tier>0&&run.fired%(r.tier===2?12:16)===0)for(const other of enemies(s,u,u.pos,r.range).filter(t=>t.id!==target.id&&positionVisible(s,t.pos)).sort((a,b)=>distance(a.pos,target.pos)-distance(b.pos,target.pos)||a.id.localeCompare(b.id)).slice(0,r.tier===2?2:1))host.hit(s,other,run.weapon,run.power*.025*.6,u,{derived:true,skillId:'rain',castId:run.id,at});
  if(slot%10===0){s.effects.push({id:s.nextId++,kind:'shot',sourceId:u.id,asset:u.asset,action:'attack',from:cp(u.pos),to:cp(target.pos),remaining:.12,color:'#c7e9e8'});u.attackFlash=.15;}
 }
 run.elapsed=elapsed;st.time=Math.max(0,r.duration-elapsed);
 const C=level(r,'C');while(run.nextTrace<=elapsed+1e-8){if(C&&run.counts.traceFire&&run.virtual){const trace:SkillEcho={id:s.nextId++,castId:run.id,sourceId:u.id,source:structuredClone(u),skillId:'rain',at:s.time,expires:s.time+(C===2?1.5:1),kind:'rainTrace',center:cp(run.virtual),heading:0,spec:r,power:run.power,maxHp:run.maxHp,weapon:run.weapon,hits:[],radius:C===2?.9:.6};(s.skillEffects??=[]).push(trace);const own=s.skillEffects.filter(e=>e.kind==='rainTrace'&&e.sourceId===u.id);while(own.length>(C===2?3:2)){const old=own.shift()!;s.skillEffects=s.skillEffects.filter(e=>e!==old);}}
  run.counts.traceFire=0;run.nextTrace+=.4;
 }
 if(st.time<=1e-8){st.time=0;st.cd=st.max;st.run=undefined;st.snapshot=undefined;}
 return true;
}
