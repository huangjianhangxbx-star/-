import type {Action,LabWorld,Vec} from '../world';
import type {AttackEvent} from '../attack-events';
import type {Projectile,ProjectileContact} from '../projectiles';
import {EventTrack} from '../kernel';
import {al04 as p} from '../../profiles/al04';
import {ironRound} from '../../profiles/al04-rmb';
import type {PlayerController,PlayerProfile,ResourceRow} from '../player-controller';
/** Q1-approved runtime projection. Ammo is not a LabResources / frost variant. */
export class CannoneerController implements PlayerController {
 readonly profile:PlayerProfile={kind:'cannoneer',characterId:p.source.characterId,actorId:'yellow',label:'魔弹射手（内部ID：小黄）',family:'yellow',hp:p.source.hp,speed:p.source.speed,builds:false};
 private ammo=p.source.ammo as number;private rollCd=0;private rocketCd=0;private idle=0;private reloadLeft=0;private secondaryHeld=false;
 private sources=new Map<number,AttackEvent>();private rocket?:number;
 constructor(private readonly w:LabWorld){}
 suspend():void{this.secondaryHeld=false;}
 presentationPose():string|undefined{return this.reloadLeft&&!this.w.player.action?'_reload':undefined;}
 resourceRows():ResourceRow[]{return [{name:'弹夹',value:`${this.ammo} / 4${this.reloadLeft?' · 装弹 '+this.reloadLeft.toFixed(1)+'s':''}`},{name:'翻滚',value:this.rollCd?this.rollCd.toFixed(1)+'s':'就绪'},{name:'火箭弹射',value:this.rocketCd?this.rocketCd.toFixed(1)+'s':'就绪'}];}
 private available():boolean {const w=this.w,a=w.player;return !w.paused&&a.hp>0&&w.simTime>=a.hurtUntil&&(!a.action||a.action.attackUnlocked);}
 private begin(kind:Action['kind'],pose:string,duration:number,events:readonly {at:number;kind:string}[],skill:string,stage=-1):Action {
  const w=this.w,request=kind==='basic'?w.input.requestId:w.nextIdentity();
  if(kind!=='basic')w.note(w.player,'input-request',kind,0,null,null,null,request);
  const a=w.special(kind,pose,duration,[...events]);a.executedSkillId=skill;a.slotSkillId=skill;a.stage=stage;a.requestId=request;
  Object.assign(w.log.at(-1)!,{executedSkillId:skill,slotSkillId:skill,stage,inputRequestId:request});return a;
 }
 private basic():void {
  const w=this.w,stage=w.nextStage,clip=p.clips[stage],action=this.begin('basic',clip.pose,clip.duration,clip.events,`小黄a${stage+1}`,stage);
  action.requestId=w.input.requestId;w.input.accept();w.nextStage=(stage+1)%3;w.comboDeadline=Infinity;
 }
 secondary(held:boolean):boolean {
  this.secondaryHeld=held;if(!held)return true;
  if(!this.available()||!this.ammo){this.w.note(this.w.player,'reject','shot-unavailable');return false;}
  const action=this.begin('cannon-shot',ironRound.pose,ironRound.duration,ironRound.events,ironRound.skillId);
  action.slotSkillId='小黄远程找子弹';this.w.log.at(-1)!.slotSkillId=action.slotSkillId;return true;
 }
 mobility():boolean {
  const w=this.w,a=w.player;if(!this.available()||this.rollCd){w.note(a,'reject','roll-unavailable');return false;}
  const action=this.begin('roll','_dash',.3667,[],'小黄翻滚');this.rollCd=p.source.dashCd;w.input.accept();
  const len=Math.hypot(w.move.x,w.move.y),facing=len?Math.atan2(w.move.y,w.move.x):action.facing;
  w.motion={source:'character-roll',actionId:action.id,facing,distance:p.source.dashDistance,duration:p.source.dashDuration,elapsed:0};
  w.defense.protect(action.id,w.simTime+p.sample.rollInvulnerability);w.note(a,'dodge','roll-cooldown',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'roll-ready'});return true;
 }
 active():boolean {
  const w=this.w;if(!this.available()||this.rocketCd){w.note(w.player,'reject','rocket-unavailable');return false;}
  const action=this.begin('rocket-jump',p.rocket.pose,p.rocket.duration,p.rocket.events,p.source.rocket.skill);
  const len=Math.hypot(w.aim.x,w.aim.y),distance=Math.min(p.source.rocket.range,len),facing=action.facing;
  action.targetSnapshot={x:w.player.x+Math.cos(facing)*distance,y:w.player.y+Math.sin(facing)*distance};return true;
 }
 releaseActive():boolean{return false;}
 cancel():boolean{const a=this.w.player.action;if(a?.kind!=='rocket-jump')return false;this.w.interrupt(this.w.player,'active-cancel');return true;}
 private attack(action:Action,left=false):AttackEvent {
  const w=this.w,event:AttackEvent={id:w.nextIdentity(),generation:w.generation,casterId:w.player.id,actionId:action.id,rootId:action.rootId,parentId:action.parentId,slotSkillId:action.slotSkillId!,executedSkillId:action.executedSkillId!,isLeftMouse:left,tags:[],suppressBuff:false,facing:action.facing};
  w.identityNote(event,'attack-event');w.log.at(-1)!.inputRequestId=action.requestId;w.publishAttack(event);return event;
 }
 private hazard(source:AttackEvent,kind:Action['kind'],position:Vec,damage:number,range:number,halfAngle:number,lifetime:number,id=this.w.nextIdentity()):void {
  const w=this.w;w.hazards.push({source,kind,id,actionId:source.actionId,rootId:source.rootId,parentId:source.parentId,owner:source.casterId,stage:w.player.action?.stage??-1,facing:source.facing,damage,range,halfAngle,expires:w.simTime+lifetime,generation:w.generation,requestId:w.player.action?.requestId??null,hit:false,origin:{...position}});
  w.identityNote(source,'hazard-created',id);
 }
 updateAction(dt:number):void {
  const w=this.w,a=w.player,action=a.action;if(!action)return;
  for(const event of action.track.advance(dt,w.generation)){
   w.note(a,'track-event',event.kind);
   if(event.kind==='Hit'){
    if(action.kind==='cannon-shot'){
     if(!this.ammo){w.interrupt(a,'empty-ammo');return;}this.ammo--;this.idle=0;
     w.note(a,'resource-payment','shot-Hit',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'ammo'});
     const source=this.attack(action),id=w.nextIdentity();this.sources.set(id,source);
     w.projectiles.spawn({id,generation:w.generation,ownerId:a.id,sourceActionId:action.id,rootActionId:action.rootId,sourceSkillId:source.executedSkillId,position:{x:a.x,y:a.y},velocity:{x:Math.cos(action.facing)*ironRound.speed,y:Math.sin(action.facing)*ironRound.speed},radius:ironRound.radius,damage:ironRound.damage,spawnedAt:w.simTime,expiresAt:w.simTime+ironRound.range/ironRound.speed,ownerDeath:'end'});
     w.identityNote(source,'projectile-created',id);w.log.at(-1)!.projectileId=id;
     w.identityNote(source,'yellow-fire',id);w.log.at(-1)!.projectileId=id;
    }else if(action.kind==='rocket-jump'){
     this.rocketCd=p.source.rocket.cd;const source=this.attack(action),id=w.nextIdentity();this.sources.set(id,source);this.rocket=id;
     w.projectiles.spawn({id,generation:w.generation,ownerId:a.id,sourceActionId:action.id,rootActionId:action.rootId,sourceSkillId:p.source.rocket.skill,kind:'ballistic',landing:action.targetSnapshot!,duration:p.source.rocket.duration,height:p.source.rocket.height,position:{x:a.x,y:a.y},velocity:{x:0,y:0},radius:0,damage:0,spawnedAt:w.simTime,expiresAt:w.simTime+p.source.rocket.duration,ownerDeath:'end'});
     w.defense.protect(action.id,w.simTime+(.4667-.1));w.identityNote(source,'projectile-created',id);w.log.at(-1)!.projectileId=id;
    }else if(action.kind==='basic')this.hazard(this.attack(action,true),'basic',a,p.source.damage[action.stage],p.sample.basicRange,p.sample.basicHalfAngle,.15);
   }
   if(event.kind==='Break')action.attackUnlocked=true;
   if(event.kind==='End'){action.moveUnlocked=true;action.attackUnlocked=true;if(action.kind==='rocket-jump')w.defense.revoke(action.id);}
  }
  if(action.kind==='roll'&&!w.motion){action.moveUnlocked=true;action.attackUnlocked=true;}
  if(action.track.finished){w.note(a,'finish');a.action=undefined;if(action.kind==='basic')w.comboDeadline=w.realTime+p.source.comboRetention;}
 }
 projectileContact(contact:ProjectileContact):void {
  const w=this.w,source=this.sources.get(contact.projectile.id),target=w.enemies.find(e=>e.id===contact.targetId);if(!source||!target||target.hp<=0)return;
  this.hazard(source,'cannon-shot',target,ironRound.damage,.01,Math.PI,.02,contact.projectile.id);
  this.w.hazards.at(-1)!.onlyTargetId=target.id;
  // One shot ends on its first target; area explosions have their own per-wave target gate.
  w.projectiles.entities=w.projectiles.entities.filter(e=>e.id!==contact.projectile.id);this.sources.delete(contact.projectile.id);
 }
 landing(projectile:Projectile):boolean {
  const w=this.w,source=this.sources.get(projectile.id);if(!source)return false;
  if(projectile.id===this.rocket){w.moveActor(w.player,projectile.position.x-w.player.x,projectile.position.y-w.player.y);this.rocket=undefined;}
  const childId=w.nextIdentity(),child:AttackEvent={...source,id:w.nextIdentity(),actionId:childId,parentId:source.actionId,executedSkillId:p.source.rocket.child,isLeftMouse:false};
  w.identityNote(child,'attack-event',childId);w.publishAttack(child);this.hazard(child,'rocket-explosion',projectile.position,p.source.rocket.damage,p.sample.rocketRadius,Math.PI,p.source.rocket.lifetime,childId);
  w.identityNote(child,'explosion-created',childId);Object.assign(w.log.at(-1)!,{projectileId:projectile.id,explosionId:childId});this.sources.delete(projectile.id);return true;
 }
 interrupted(action:Action,_reason:string):void {
  const w=this.w;if(action.kind==='basic')w.comboDeadline=w.realTime+p.source.comboRetention;
  w.defense.revoke(action.id);if(w.motion?.actionId===action.id)w.motion=undefined;
  if(action.kind==='rocket-jump'){w.projectiles.entities=w.projectiles.entities.filter(e=>e.sourceActionId!==action.id);for(const [id,source] of this.sources)if(source.actionId===action.id)this.sources.delete(id);this.rocket=undefined;}
  w.hazards=w.hazards.filter(h=>h.actionId!==action.id);
 }
 step(dt:number):void {
  const w=this.w,a=w.player;this.rollCd=Math.max(0,this.rollCd-dt);this.rocketCd=Math.max(0,this.rocketCd-dt);
  if(a.hp<=0){this.secondaryHeld=false;return;}this.idle+=dt;
  // Bounded source map: expired ordinary shots cannot accumulate across a long session.
  for(const id of this.sources.keys())if(id!==this.rocket&&!w.projectiles.entities.some(p=>p.id===id))this.sources.delete(id);
  const flying=w.projectiles.entities.find(p=>p.id===this.rocket);
  if(flying){w.moveActor(a,flying.position.x-a.x,flying.position.y-a.y);return;}
  if(w.simTime<a.hurtUntil)return;
  if(!a.action&&w.realTime>w.comboDeadline){w.nextStage=0;w.comboDeadline=Infinity;}
  if(this.available()&&!w.motion){if(w.input.request(w.realTime))this.basic();else if(this.secondaryHeld&&this.ammo)this.secondary(true);}
  if(w.motion){const motion=w.motion,before=motion.elapsed/motion.duration;motion.elapsed=Math.min(motion.duration,motion.elapsed+dt);const distance=motion.distance*(motion.elapsed/motion.duration-before);w.moveActor(a,Math.cos(motion.facing)*distance,Math.sin(motion.facing)*distance);if(motion.elapsed>=motion.duration)w.motion=undefined;}
  const len=Math.hypot(w.move.x,w.move.y);
  if(len&&!w.motion&&(!a.action||a.action.moveUnlocked)){if(a.action)w.interrupt(a,'move');a.facing=Math.atan2(w.move.y,w.move.x);w.moveActor(a,w.move.x/len*p.source.speed*dt,w.move.y/len*p.source.speed*dt);}
  else if(!a.action)a.facing=Math.atan2(w.aim.y,w.aim.x);
  if(!a.action&&!w.motion&&this.ammo<4&&(!this.ammo||this.idle>=p.source.idleReload)){
   if(!this.reloadLeft){this.reloadLeft=p.source.reload;w.note(a,'reload-start','ammo reload');}this.reloadLeft=Math.max(0,this.reloadLeft-dt);
   if(!this.reloadLeft){const gain=4-this.ammo;this.ammo=4;w.note(a,'reload-complete','SAMPLE refill',gain,null,null,null,null,{rootId:0,parentId:null,resourceName:'ammo'});}
  }
 }
}
