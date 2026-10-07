import {createPlayerController,type PlayerController,type PlayerKind} from './player-controller';
import {al03 as rangedProfile} from '../profiles/al03';
import {ProjectileRuntime,type Projectile} from './projectiles';
import {landingPoints} from './ranged';
import {AttackInput,EventTrack} from './kernel';
import {reference} from '../profiles/reference';
import {sample,zombieClip} from '../profiles/sample';

import type {LabResources} from './resources';
import {LabDefense,type ActionKind,type Motion} from './abilities';
import {HitEffects,energyReturn} from './hit-effects';
import {AttackEvents,AxeEquipment,type AttackEvent} from './attack-events';
import {al02 as x,type LabBuild} from '../profiles/al02';
export interface Vec {x:number;y:number}
export interface Action {targetSnapshot?:Vec;executedSkillId?:string;slotSkillId?:string;kind:ActionKind;pose:string;rootId:number;parentId:number|null;releasing?:boolean;requestId:number|null;id:number;stage:number;track:EventTrack;facing:number;attackUnlocked:boolean;moveUnlocked:boolean;dashLeft:number;dashSpeed:number}
export type Encounter="melee"|"ranged"|"mixed";
export interface Actor extends Vec {enemyKind?:"zombie-melee"|"ranged-reference";resources?:LabResources;id:string;toughness:number;hp:number;maxHp:number;facing:number;action?:Action;hurtUntil:number;cooldown:number;enabled:boolean;reject:string;knock:Vec;hurtRealTime:number}
export interface Hazard {onlyTargetId?:string;projectileId?:number;incomingAngle?:number;skillTags?:readonly string[];source?:AttackEvent;origin?:Vec;persistent?:boolean;readyAt?:number;columnHits?:Set<number>;kind:ActionKind;rootId:number;parentId:number|null;damage:number;id:number;actionId:number;owner:Actor['id'];stage:number;facing:number;range:number;halfAngle:number;expires:number;generation:number;requestId:number|null;hit:boolean;hitTargets?:Set<string>}
export interface IceColumn extends Vec {id:number;hp:number;expires:number;generation:number;source:AttackEvent}
export interface DerivedEffect extends Vec {id:number;kind:"axe"|"ice-burst";source:AttackEvent;facing:number;readyAt:number;expires:number;spawned:boolean}
export interface LabEvent {projectileId?:number;explosionId?:number;loadoutRevision?:number;equipmentInstanceId?:string;waveId?:number;sourceSkillId?:string;executedSkillId?:string;slotSkillId?:string;attackEventId?:number;effectId?:number;sequence:number;worldGeneration:number;actorId:Actor['id'];actionInstanceId:number|null;parentActionId:number|null;rootActionId:number|null;resourceName:string|null;ruleProfile:string;timeScale:number;inputRequestId:number|null;eventKind:string;result:string;rejectReason:string|null;realTime:number;simTime:number;actionTime:number|null;position:Vec;facing:number;resourceDelta:number;targetId:Actor['id']|null;stage:number|null}
function actor(id:Actor['id'],x:number,hp:number,enemy=true):Actor {return {id,enemyKind:enemy?'zombie-melee':undefined,toughness:0,x,y:0,hp,maxHp:hp,facing:enemy?Math.PI:0,hurtUntil:0,cooldown:enemy?2.5:0,enabled:true,reject:'',knock:{x:0,y:0},hurtRealTime:-Infinity};}
export function angleDelta(a:number,b:number):number {return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function canInterrupt(incoming:number,defensive:number):boolean {return incoming>defensive;}
export class LabWorld {
  constructor(){this.player.resources=this.controller.resources;}
  private eventSequence=0;
  encounter:Encounter="melee";projectiles=new ProjectileRuntime();
  setEncounter(value:Encounter):void {this.encounter=value;this.reset();}
  build:LabBuild="base";columns:IceColumn[]=[];effects:DerivedEffect[]=[];
  private attacks=new AttackEvents();private axe?:AxeEquipment;
  private delayed:{due:number;position:Vec;source:AttackEvent}[]=[];
  get axeCooldown():number{return this.axe?.cooldown??0;}
  setBuild(build:LabBuild,close=false):void {this.build=build;this.growthEnabled=build==="energy";this.reset(close);}
  get iceEnabled():boolean{return this.build==="ice"||this.build==="ice-axe";}
  player=actor('blue',-2,sample.hp.blue,false);playerKind:PlayerKind='isdara';controller:PlayerController=createPlayerController('isdara',this);
  get blue():Actor{return this.player;}
  set blue(value:Actor){this.player=value;}
  setPlayer(kind:PlayerKind):void{this.playerKind=kind;this.build='base';this.growthEnabled=false;this.reset();}
  enemies:Actor[]=[actor('zombie',2,sample.hp.zombie)];
  /** Legacy first-enemy view; gameplay resolves the finite collection by identity. */
  get enemy():Actor{return this.enemies[0];}
  set enemy(value:Actor){this.enemies[0]=value;}
  private findActor(id:string):Actor|undefined{return id===this.player.id?this.player:this.enemies.find(e=>e.id===id);}
  /** Legacy blue-only accessor; new HUD reads controller.resourceRows instead. */
  get resources():LabResources{if(!this.controller.resources)throw new Error('No legacy blue resources');return this.controller.resources;}
  defense=new LabDefense();motion?:Motion;growthEnabled=false;
  private hits=new HitEffects();private detachGrowth?:()=>void;
  aim:Vec={x:1,y:0}; move:Vec={x:0,y:0};
  nextStage=0; log:LabEvent[]=[]; hazards:Hazard[]=[]; generation=1; simTime=0;realTime=0;
  input=new AttackInput(reference.inputLifetime); paused=false; speed=1;comboDeadline=Infinity;finalRecoveryUntil=0;
  private serial=0; private hitstopUntil=0;private hitstopScale=1;
  note(a:Actor,kind:string,result='',delta=0,target:Actor|null=null,actionId=a.action?.id??null,stage=a.action?.stage??null,requestId=a.action?.requestId??null,identity?:{rootId:number;parentId:number|null;resourceName?:string}):void {
    this.log.push({executedSkillId:a.action?.executedSkillId,slotSkillId:a.action?.slotSkillId,sequence:++this.eventSequence,worldGeneration:this.generation,actorId:a.id,actionInstanceId:actionId,parentActionId:identity?identity.parentId:a.action?.parentId??null,rootActionId:identity?.rootId??a.action?.rootId??null,resourceName:identity?.resourceName??(kind==='damage'?'HP':null),ruleProfile:a.enemyKind==='ranged-reference'?rangedProfile.sample.label:a===this.player?this.controller.profile.kind+' SOURCE + SAMPLE':sample.label,timeScale:this.speed*(this.realTime<this.hitstopUntil?this.hitstopScale:1),inputRequestId:requestId,eventKind:kind,result,rejectReason:kind==='reject'?result:null,realTime:this.realTime,simTime:this.simTime,actionTime:a.action?.id===actionId?a.action.track.time:null,position:{x:a.x,y:a.y},facing:a.facing,resourceDelta:delta,targetId:target?.id??null,stage});
    if(this.log.length>600)this.log.splice(0,this.log.length-600);
  }
  press():void {if(this.paused||this.player.hp<=0)return;this.input.press(this.realTime);this.note(this.player,'input-request','',0,null,null,null,this.input.requestId);}
  release():void {this.input.release();}
  pause(value:boolean):void {
    this.paused=value;this.input.clear();this.move={x:0,y:0};
    if(value){this.controller.suspend?.();if(this.player.action&&this.player.action.kind!=='basic')this.interrupt(this.player,'pause');this.motion=undefined;this.defense.clear();}
  }
  private bindGrowth():void {
    this.detachGrowth?.();this.detachGrowth=undefined;
    if(this.growthEnabled&&this.controller.resources)this.detachGrowth=energyReturn(this.hits,this.generation,id=>id===this.player.id?this.player.resources:undefined,(hit,delta)=>this.note(this.player,'frost-return','energy-growth',delta,this.findActor(hit.targetId)??null,hit.actionId,null,null,{rootId:hit.rootId,parentId:hit.rootId,resourceName:'frost'}),id=>this.hazards.some(h=>h.id===id&&h.expires>this.simTime));
  }
  /** Construct changes are atomic only at the explicit safe reset point. */
  resetBuild(growth:boolean,close=false):void {this.build=growth?"energy":"base";this.growthEnabled=growth;this.reset(close);}

  special(kind:ActionKind,pose:string,duration:number,events:{at:number;kind:string}[],rootId?:number,parentId:number|null=null):Action {
    const a=this.player;if(a.action)this.interrupt(a,kind);
    const id=++this.serial,facing=Math.atan2(this.aim.y,this.aim.x);
    a.facing=facing;a.action={kind,pose,rootId:rootId??id,parentId,requestId:null,id,stage:-1,track:new EventTrack(events,duration,this.generation),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
    this.note(a,'accepted',kind);return a.action;
  }

  reset(close=false):void {
    this.projectiles.reset();this.axe?.detach();this.axe=undefined;this.delayed=[];this.columns=[];this.effects=[];
    this.generation++;this.controller=createPlayerController(this.playerKind,this);this.player=actor(this.controller.profile.actorId,close?0:-2,this.controller.profile.hp,false);this.player.resources=this.controller.resources;this.enemies=[actor('zombie',close?1.3:2,sample.hp.zombie)];
    if(this.encounter!=='melee'){
      const ranged=actor('ranged-1',close?1.3:3,rangedProfile.sample.enemyHp);ranged.enemyKind='ranged-reference';ranged.cooldown=rangedProfile.reference.initialCooldown;
      this.enemies=this.encounter==='ranged'?[ranged]:[...this.enemies,ranged];
      if(this.encounter==='mixed'){this.enemy.x=close?1.3:0;this.enemy.y=-1.5;ranged.y=1;}
    }
    if(this.controller.profile.builds&&(this.build==="axe"||this.build==="ice-axe"))this.axe=new AxeEquipment(this.attacks,this.generation,this.player.id,event=>{
      const effect:DerivedEffect={id:++this.serial,kind:"axe",source:event,x:this.player.x,y:this.player.y,facing:event.facing,readyAt:this.simTime+x.source.axeDelay,expires:this.simTime+x.source.axeLifetime,spawned:false};this.effects.push(effect);this.identityNote(event,"axe-created",effect.id);
      const auxiliary:AttackEvent={...event,id:++this.serial,actionId:effect.id,parentId:event.actionId,executedSkillId:"兽人的大斧挥舞一",isLeftMouse:false,tags:[]};
      this.identityNote(auxiliary,"attack-event",effect.id);this.attacks.publish(auxiliary);
    },(event,reason)=>{this.identityNote(event,'axe-rejected');this.log.at(-1)!.result=reason;this.log.at(-1)!.rejectReason=reason;});
    this.motion=undefined;this.defense.clear();this.bindGrowth();
    this.simTime=this.realTime=0;this.nextStage=0;this.comboDeadline=Infinity;this.finalRecoveryUntil=0;this.hitstopUntil=0;this.hitstopScale=1;this.log=[];this.hazards=[];this.input.clear();this.move={x:0,y:0};this.aim={x:1,y:0};this.paused=false;
  }

  nextIdentity():number{return ++this.serial;}
  get equipmentIdentity():string|undefined{return this.axe?`${this.player.id}-axe-${this.generation}`:undefined;}
  publishAttack(event:AttackEvent):void{this.attacks.publish(event);}
  scheduleColumn(source:AttackEvent):void{this.delayed.push({due:this.simTime+x.source.iceDelay,position:{x:this.player.x+Math.cos(source.facing)*x.sample.columnOffset,y:this.player.y+Math.sin(source.facing)*x.sample.columnOffset},source});}
  dodge():boolean{return this.controller.mobility();}
  shield(held:boolean):boolean{return this.controller.secondary(held);}
  prepareActive():boolean{return this.controller.active();}
  releaseActive():boolean{return this.controller.releaseActive();}
  cancelUpper():boolean{return this.controller.cancel();}
  enemyReady(skipFacing:boolean,e:Actor=this.enemy):boolean {
    if(e.hp<=0||this.player.hp<=0||!e.enabled){e.reject='dead/disabled';return false;}
    if(e.action||this.simTime<e.hurtUntil){e.reject='control';return false;}
    if(e.cooldown>0){e.reject='cooldown';return false;}
    const d=Math.hypot(this.player.x-e.x,this.player.y-e.y);
    if(d>(e.enemyKind==='ranged-reference'?rangedProfile.reference.castRange:sample.castRange)||e.enemyKind==='ranged-reference'&&d<rangedProfile.reference.minRange){e.reject='range';return false;}
    if(!skipFacing&&Math.abs(angleDelta(Math.atan2(this.player.y-e.y,this.player.x-e.x),e.facing))>(e.enemyKind==='ranged-reference'?rangedProfile.sample.finalAngle:sample.finalAngle)){e.reject='facing';return false;}
    e.reject='';return true;
  }
  interrupt(a:Actor,reason:string):void {
    const action=a.action;if(!action)return;
    this.note(a,'cancel',reason);action.track.cancel();a.action=undefined;
    if(a===this.player)this.controller.interrupted(action,reason);
  }
  private accept(a:Actor,_stage:number):void {
    const ranged=a.enemyKind==='ranged-reference',clip=ranged?{duration:rangedProfile.sample.actionRecovery,events:[{at:0,kind:'Flash'},{at:rangedProfile.reference.spawnEventTime,kind:'Hit'},{at:rangedProfile.reference.spawnEventTime,kind:'Lock'}]}:zombieClip;
    const facing=Math.atan2(this.player.y-a.y,this.player.x-a.x),id=++this.serial;
    a.facing=facing;a.action={kind:'enemy-attack',pose:'attack',executedSkillId:ranged?rangedProfile.reference.rootSkill:'僵尸攻击',slotSkillId:ranged?rangedProfile.reference.rootSkill:'僵尸攻击',rootId:id,parentId:null,requestId:null,id,stage:0,track:new EventTrack(clip.events,clip.duration,this.generation,sample.animationRate),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
    a.cooldown=ranged?rangedProfile.reference.repeatCooldown:sample.zombieCd;if(ranged)a.action.targetSnapshot={x:this.player.x,y:this.player.y};this.note(a,'accepted');
  }
  moveActor(a:Actor,dx:number,dy:number):void {
    const r=sample.actorRadius;
    // Arena boundaries and one explicit block; no visual-only correction or root-motion accumulation.
    const nx=Math.max(-sample.arenaHalfWidth+r,Math.min(sample.arenaHalfWidth-r,a.x+dx));
    const ny=Math.max(-sample.arenaHalfHeight+r,Math.min(sample.arenaHalfHeight-r,a.y+dy));
    const blocked=(x:number,y:number)=>x>-1.1-r&&x<1.1+r&&y>2-r&&y<2.65+r;
    if(!blocked(nx,a.y))a.x=nx;if(!blocked(a.x,ny))a.y=ny;
  }
  private updateAction(a:Actor,dt:number):void {
    const action=a.action;if(!action)return;
    for(const event of action.track.advance(dt,this.generation)){
      this.note(a,'track-event',event.kind);
      if(event.kind==='Dash'){action.dashLeft=sample.zombieDashDuration;action.dashSpeed=sample.zombieDashDistance/sample.zombieDashDuration;}
      if(event.kind==='Hit'){
        if(a.enemyKind==='ranged-reference')this.spawnRanged(a,action);
        else {this.hazards.push({kind:action.kind,rootId:action.rootId,parentId:action.parentId,damage:sample.zombieDamage,id:++this.serial,actionId:action.id,owner:a.id,stage:action.stage,facing:action.facing,range:1.6,halfAngle:.8,expires:this.simTime+sample.hazardLifetime,generation:this.generation,requestId:null,hit:false});this.note(a,'hazard-created');}
      }
      if(event.kind==='Break')action.attackUnlocked=true;if(event.kind==='End')action.moveUnlocked=true;
    }
    if(action.dashLeft>0){const step=Math.min(dt,action.dashLeft);this.moveActor(a,Math.cos(action.facing)*action.dashSpeed*step,Math.sin(action.facing)*action.dashSpeed*step);action.dashLeft-=step;}
    if(action.track.finished){this.note(a,'finish');a.action=undefined;}
  }
  identityNote(source:AttackEvent,kind:string,effectId?:number):void {
    this.note(this.findActor(source.casterId)??this.player,kind,source.executedSkillId,0,null,source.actionId,null,null,{rootId:source.rootId,parentId:source.parentId});
    Object.assign(this.log.at(-1)!,{loadoutRevision:source.loadoutRevision,equipmentInstanceId:source.equipmentInstanceId,executedSkillId:source.executedSkillId,slotSkillId:source.slotSkillId,attackEventId:source.id,effectId});
  }
  private advanceDerived():void {
    const due=this.delayed.filter(t=>t.due<=this.simTime);this.delayed=this.delayed.filter(t=>t.due>this.simTime);
    for(const task of due)if(task.source.generation===this.generation&&this.player.hp>0){const column:IceColumn={...task.position,id:++this.serial,hp:x.source.columnHp,expires:this.simTime+x.source.columnLifetime,generation:this.generation,source:task.source};this.columns.push(column);this.identityNote(task.source,'column-created',column.id);}
    this.columns=this.columns.filter(c=>{if(c.expires<=this.simTime){this.identityNote(c.source,'column-expired',c.id);return false;}return c.hp>0&&c.generation===this.generation;});
    for(const effect of this.effects)if(!effect.spawned&&effect.readyAt<=this.simTime&&effect.expires>this.simTime){
      effect.spawned=true;const axe=effect.kind==='axe';
      this.hazards.push({source:effect.source,kind:effect.kind,rootId:effect.source.rootId,parentId:effect.source.actionId,damage:axe?x.source.axeDamage:x.source.burstDamage,id:effect.id,actionId:effect.id,owner:effect.source.casterId,stage:-1,facing:effect.facing,range:axe?x.sample.axeRange:x.sample.burstRange,halfAngle:axe?x.sample.axeHalfAngle:Math.PI,expires:effect.expires,generation:this.generation,requestId:null,hit:false,origin:{x:effect.x,y:effect.y},persistent:true});
      this.identityNote(effect.source,'derived-hazard-created',effect.id);
    }
    this.effects=this.effects.filter(e=>e.expires>this.simTime&&e.source.generation===this.generation);
  }
  private spawnRanged(owner:Actor,action:Action):void {
    const points=landingPoints(action.targetSnapshot!,action.id);
    points.forEach((landing,index)=>{
      const spawnedAt=this.simTime+(index===2?rangedProfile.reference.childInterval:0),duration=rangedProfile.reference.transportDuration;
      const projectile=this.projectiles.spawn({id:++this.serial,generation:this.generation,ownerId:owner.id,sourceActionId:action.id,rootActionId:action.rootId,
        sourceSkillId:rangedProfile.reference.children[index===0?0:1],kind:'ballistic',position:{x:owner.x,y:owner.y},landing,
        velocity:{x:(landing.x-owner.x)/duration,y:(landing.y-owner.y)/duration},radius:0,damage:rangedProfile.reference.damage,
        spawnedAt,expiresAt:spawnedAt+duration,duration,height:rangedProfile.reference.transportHeight,ownerDeath:rangedProfile.sample.ownerDeathPolicy});
      this.note(owner,'projectile-created',projectile.sourceSkillId,0,null,action.id,null,null,{rootId:action.rootId,parentId:action.id});
      Object.assign(this.log.at(-1)!,{projectileId:projectile.id,sourceSkillId:projectile.sourceSkillId});
    });
  }
  private advanceProjectiles():void {
    const contacts=this.projectiles.advance(this.simTime,this.generation,this.enemies.filter(e=>e.hp>0).map(e=>({id:e.id,position:e,radius:sample.actorRadius})));
    for(const contact of contacts)this.controller.projectileContact?.(contact);
    for(const p of this.projectiles.landings){
      if(this.controller.landing?.(p))continue;
      const owner=this.findActor(p.ownerId);if(!owner)continue;
      const dx=p.position.x-this.player.x,dy=p.position.y-this.player.y;
      const incoming=Math.hypot(dx,dy)>rangedProfile.sample.guardCoincidenceEpsilon?Math.atan2(dy,dx):Math.atan2(-p.velocity.y,-p.velocity.x);
      const id=++this.serial;
      this.hazards.push({kind:'ranged-explosion',rootId:p.rootActionId,parentId:p.sourceActionId,damage:p.damage,id,projectileId:p.id,actionId:p.sourceActionId,
        owner:p.ownerId,stage:-1,facing:0,range:rangedProfile.sample.explosionRadius,halfAngle:Math.PI,expires:p.expiresAt+rangedProfile.sample.explosionLifetime,
        generation:p.generation,requestId:null,hit:false,origin:{...p.position},incomingAngle:incoming,persistent:true});
      this.note(owner,'explosion-created',rangedProfile.reference.explosionSkill,0,null,p.sourceActionId,null,null,{rootId:p.rootActionId,parentId:p.sourceActionId});
      Object.assign(this.log.at(-1)!,{projectileId:p.id,explosionId:id,executedSkillId:rangedProfile.reference.explosionSkill,sourceSkillId:p.sourceSkillId});
    }
  }
  private collideColumns():void {
    for(const h of this.hazards){if(h.kind==='ice-burst'||h.skillTags?.includes('不碎冰')||h.damage<=0||h.generation!==this.generation||h.expires<=this.simTime)continue;
      const owner=this.findActor(h.owner);if(!owner)continue;const origin=h.origin??owner;
      for(const c of this.columns){if(c.hp<=0||h.columnHits?.has(c.id))continue;
        const dx=c.x-origin.x,dy=c.y-origin.y,d=Math.hypot(dx,dy);
        if(d>h.range+x.sample.columnRadius||Math.abs(angleDelta(Math.atan2(dy,dx),h.facing))>h.halfAngle+Math.asin(Math.min(1,x.sample.columnRadius/Math.max(.001,d))))continue;
        (h.columnHits??=new Set()).add(c.id);c.hp-=h.owner===this.player.id&&h.skillTags?.includes('盾击')?999:1;
        if(c.hp<=0){this.identityNote(c.source,'column-shattered',c.id);this.effects.push({id:++this.serial,kind:'ice-burst',source:c.source,x:c.x,y:c.y,facing:0,readyAt:this.simTime,expires:this.simTime+x.sample.burstLifetime,spawned:false});}
      }
    }
    this.columns=this.columns.filter(c=>c.hp>0);
  }
  tagProjectileContact(h:Hazard):void {if(h.projectileId&&h.kind==='ranged-explosion')Object.assign(this.log.at(-1)!,{projectileId:h.projectileId,explosionId:h.id,executedSkillId:rangedProfile.reference.explosionSkill,sourceSkillId:rangedProfile.reference.rootSkill,ruleProfile:rangedProfile.sample.label});}
  private collide():void {
    for(const h of this.hazards){
      if(h.kind==='ranged-explosion'&&h.expires<=this.simTime)continue;
      const owner=this.findActor(h.owner);if(!owner)continue;
      for(const target of h.owner===this.player.id?this.enemies:[this.player]){
      if(h.onlyTargetId&&h.onlyTargetId!==target.id||h.hit&&!h.hitTargets||h.hitTargets?.has(target.id)||h.generation!==this.generation||target.hp<=0||!h.persistent&&owner.hp<=0)continue;
      const origin=h.origin??owner;const dx=target.x-origin.x,dy=target.y-origin.y,d=Math.hypot(dx,dy);
      if(d>h.range+sample.actorRadius||Math.abs(angleDelta(Math.atan2(dy,dx),h.facing))>h.halfAngle+Math.asin(Math.min(1,sample.actorRadius/Math.max(.001,d))))continue;
      (h.hitTargets??=new Set()).add(target.id);
      if(target===this.player&&this.defense.invulnerable(this.simTime)){if(!h.hit){this.note(target,'evade','invulnerable',0,owner,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});this.tagProjectileContact(h);}h.hit=true;continue;}
      h.hit=true;
      if(target===this.player&&this.controller.guardContact?.(h,owner,dx,dy,d))continue;
      const damage=Math.min(target.hp,h.damage);target.hp-=damage;
      this.note(owner,'damage',h.kind==='axe'?'axe-contact':h.kind==='ice-burst'?'ice-burst-contact':h.kind==='ranged-explosion'?'landing-contact':'contact',-damage,target,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});if(h.source)Object.assign(this.log.at(-1)!,{loadoutRevision:h.source.loadoutRevision,equipmentInstanceId:h.source.equipmentInstanceId,waveId:h.id,executedSkillId:h.kind==='axe'?'兽人的大斧挥舞一':h.kind==='ice-burst'?'小蓝冰柱碎冰':h.source.executedSkillId,sourceSkillId:h.kind==='axe'||h.kind==='ice-burst'?h.source.executedSkillId:undefined,attackEventId:h.source.id,effectId:h.id,slotSkillId:h.source.slotSkillId});target.hurtRealTime=this.realTime;
      this.tagProjectileContact(h);
      this.hits.publish({generation:this.generation,casterId:owner.id,actionId:h.actionId,rootId:h.rootId,waveId:h.id,targetId:target.id,kind:h.kind,damage});
      // SAMPLE defensive toughness defaults to zero; damage and interruption are separate.
      const interrupts=canInterrupt(1,target.toughness);
      if(interrupts){this.interrupt(target,'hurt');target.hurtUntil=this.simTime+sample.hurtDuration;}
      const norm=Math.max(.001,d);target.knock={x:dx/norm*sample.knockback/sample.hurtDuration,y:dy/norm*sample.knockback/sample.hurtDuration};
      this.note(target,interrupts?'hurt':'hit-uninterrupted');this.hitstopUntil=this.realTime+(owner===this.player?(h.stage===3?.045:.03):.2);this.hitstopScale=owner===this.player?.15:.5;
      if(target.hp<=0){target.enabled=false;this.interrupt(target,'death');this.projectiles.ownerDied(target.id);this.note(target,'death');this.hazards=this.hazards.filter(x=>x.owner!==target.id||x.persistent);if(target===this.player){this.input.clear();this.motion=undefined;this.defense.clear();}}
    }
    }
    this.hazards=this.hazards.filter(h=>h.generation===this.generation&&h.expires>this.simTime&&(h.persistent||(this.findActor(h.owner)?.hp??0)>0));
  }
  advance(delta:number):void {
    if(!Number.isFinite(delta)||delta<0||delta>30)throw new Error('Invalid frame delta');
    if(this.paused||delta===0)return;
    // Bound each collision step; process the entire active frame, never drop crossed events.
    const count=Math.max(1,Math.ceil(delta*120)),realStep=delta/count;
    for(let i=0;i<count;i++){
      this.realTime+=realStep;const dt=realStep*this.speed*(this.realTime<this.hitstopUntil?this.hitstopScale:1);this.simTime+=dt;
      this.axe?.advance(dt);this.advanceDerived();this.advanceProjectiles();
      this.controller.step(dt);
      for(const a of [this.player,...this.enemies]){
        a.cooldown=Math.max(0,a.cooldown-dt);
        if(a.hp<=0)continue;
        if(this.simTime<a.hurtUntil){this.moveActor(a,a.knock.x*dt,a.knock.y*dt);continue;}
        if(a===this.player){/* Player movement belongs to its controller. */}else if(a.enabled&&!a.action&&this.player.hp>0&&a.cooldown<=0){
          const distance=Math.hypot(this.player.x-a.x,this.player.y-a.y);
          const desired=Math.atan2(this.player.y-a.y,this.player.x-a.x);a.facing+=Math.max(-(a.enemyKind==='ranged-reference'?rangedProfile.sample.turnSpeed:sample.zombieTurn)*dt,Math.min((a.enemyKind==='ranged-reference'?rangedProfile.sample.turnSpeed:sample.zombieTurn)*dt,angleDelta(desired,a.facing)));
          if(this.enemyReady(true,a)){if(this.enemyReady(false,a))this.accept(a,0);}
          else if(a.reject==='range'){const sign=a.enemyKind==='ranged-reference'&&distance<rangedProfile.sample.comfortMin?-1:1;this.moveActor(a,Math.cos(a.facing)*sample.zombieSpeed*dt*sign,Math.sin(a.facing)*sample.zombieSpeed*dt*sign);}
        }
        if(a.enemyKind==='ranged-reference'&&a.enabled&&!a.action&&a.cooldown>0&&this.player.hp>0){
          const dx=this.player.x-a.x,dy=this.player.y-a.y,d=Math.hypot(dx,dy),sign=d<rangedProfile.sample.comfortMin?-1:d>rangedProfile.sample.comfortMax?1:0;
          if(d&&sign)this.moveActor(a,dx/d*rangedProfile.sample.moveSpeed*dt*sign,dy/d*rangedProfile.sample.moveSpeed*dt*sign);
        }
        if(a===this.player)this.controller.updateAction(dt);else this.updateAction(a,dt);
      }
      this.collideColumns();this.collide();
    }
  }
}
