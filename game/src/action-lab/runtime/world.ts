import {al03 as rangedProfile} from '../profiles/al03';
import {ProjectileRuntime,type Projectile} from './projectiles';
import {landingPoints} from './ranged';
import {AttackInput,EventTrack} from './kernel';
import {reference} from '../profiles/reference';
import {blueClips,sample,zombieClip} from '../profiles/sample';
import {m2Reference as r,m2Sample as m} from '../profiles/m2';
import {LabResources} from './resources';
import {LabDefense,type ActionKind,type Motion} from './abilities';
import {HitEffects,energyReturn} from './hit-effects';
import {AttackEvents,AxeEquipment,type AttackEvent} from './attack-events';
import {al02 as x,type LabBuild} from '../profiles/al02';
export interface Vec {x:number;y:number}
export interface Action {targetSnapshot?:Vec;executedSkillId?:string;slotSkillId?:string;kind:ActionKind;pose:string;rootId:number;parentId:number|null;releasing?:boolean;requestId:number|null;id:number;stage:number;track:EventTrack;facing:number;attackUnlocked:boolean;moveUnlocked:boolean;dashLeft:number;dashSpeed:number}
export type Encounter="melee"|"ranged"|"mixed";
export interface Actor extends Vec {enemyKind?:"zombie-melee"|"ranged-reference";resources?:LabResources;id:string;toughness:number;hp:number;maxHp:number;facing:number;action?:Action;hurtUntil:number;cooldown:number;enabled:boolean;reject:string;knock:Vec;hurtRealTime:number}
export interface Hazard {projectileId?:number;incomingAngle?:number;skillTags?:readonly string[];source?:AttackEvent;origin?:Vec;persistent?:boolean;readyAt?:number;columnHits?:Set<number>;kind:ActionKind;rootId:number;parentId:number|null;damage:number;id:number;actionId:number;owner:Actor['id'];stage:number;facing:number;range:number;halfAngle:number;expires:number;generation:number;requestId:number|null;hit:boolean;hitTargets?:Set<string>}
export interface IceColumn extends Vec {id:number;hp:number;expires:number;generation:number;source:AttackEvent}
export interface DerivedEffect extends Vec {id:number;kind:"axe"|"ice-burst";source:AttackEvent;facing:number;readyAt:number;expires:number;spawned:boolean}
export interface LabEvent {projectileId?:number;explosionId?:number;loadoutRevision?:number;equipmentInstanceId?:string;waveId?:number;sourceSkillId?:string;executedSkillId?:string;slotSkillId?:string;attackEventId?:number;effectId?:number;sequence:number;worldGeneration:number;actorId:Actor['id'];actionInstanceId:number|null;parentActionId:number|null;rootActionId:number|null;resourceName:string|null;ruleProfile:string;timeScale:number;inputRequestId:number|null;eventKind:string;result:string;rejectReason:string|null;realTime:number;simTime:number;actionTime:number|null;position:Vec;facing:number;resourceDelta:number;targetId:Actor['id']|null;stage:number|null}
function actor(id:Actor['id'],x:number,hp:number):Actor {return {id,resources:id==='blue'?new LabResources():undefined,enemyKind:id==='blue'?undefined:'zombie-melee',toughness:0,x,y:0,hp,maxHp:hp,facing:id==='blue'?0:Math.PI,hurtUntil:0,cooldown:id==='blue'?0:2.5,enabled:true,reject:'',knock:{x:0,y:0},hurtRealTime:-Infinity};}
export function angleDelta(a:number,b:number):number {return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function canInterrupt(incoming:number,defensive:number):boolean {return incoming>defensive;}
export class LabWorld {
  private eventSequence=0;
  encounter:Encounter="melee";projectiles=new ProjectileRuntime();
  setEncounter(value:Encounter):void {this.encounter=value;this.reset();}
  build:LabBuild="base";columns:IceColumn[]=[];effects:DerivedEffect[]=[];
  private attacks=new AttackEvents();private axe?:AxeEquipment;
  private delayed:{due:number;position:Vec;source:AttackEvent}[]=[];
  get axeCooldown():number{return this.axe?.cooldown??0;}
  setBuild(build:LabBuild,close=false):void {this.build=build;this.growthEnabled=build==="energy";this.reset(close);}
  private get iceEnabled():boolean{return this.build==="ice"||this.build==="ice-axe";}
  blue=actor('blue',-2,sample.hp.blue); enemies:Actor[]=[actor('zombie',2,sample.hp.zombie)];
  /** Legacy first-enemy view; gameplay resolves the finite collection by identity. */
  get enemy():Actor{return this.enemies[0];}
  set enemy(value:Actor){this.enemies[0]=value;}
  private findActor(id:string):Actor|undefined{return id===this.blue.id?this.blue:this.enemies.find(e=>e.id===id);}
  resources=this.blue.resources!;defense=new LabDefense();motion?:Motion;growthEnabled=false;
  private hits=new HitEffects();private detachGrowth?:()=>void;private rootHeld=false;
  aim:Vec={x:1,y:0}; move:Vec={x:0,y:0};
  nextStage=0; log:LabEvent[]=[]; hazards:Hazard[]=[]; generation=1; simTime=0;realTime=0;
  input=new AttackInput(reference.inputLifetime); paused=false; speed=1;comboDeadline=Infinity;finalRecoveryUntil=0;
  private serial=0; private hitstopUntil=0;private hitstopScale=1;
  private note(a:Actor,kind:string,result='',delta=0,target:Actor|null=null,actionId=a.action?.id??null,stage=a.action?.stage??null,requestId=a.action?.requestId??null,identity?:{rootId:number;parentId:number|null;resourceName?:string}):void {
    this.log.push({executedSkillId:a.action?.executedSkillId,slotSkillId:a.action?.slotSkillId,sequence:++this.eventSequence,worldGeneration:this.generation,actorId:a.id,actionInstanceId:actionId,parentActionId:identity?identity.parentId:a.action?.parentId??null,rootActionId:identity?.rootId??a.action?.rootId??null,resourceName:identity?.resourceName??(kind==='damage'?'HP':null),ruleProfile:a.enemyKind==='ranged-reference'?rangedProfile.sample.label:sample.label,timeScale:this.speed*(this.realTime<this.hitstopUntil?this.hitstopScale:1),inputRequestId:requestId,eventKind:kind,result,rejectReason:kind==='reject'?result:null,realTime:this.realTime,simTime:this.simTime,actionTime:a.action?.id===actionId?a.action.track.time:null,position:{x:a.x,y:a.y},facing:a.facing,resourceDelta:delta,targetId:target?.id??null,stage});
    if(this.log.length>600)this.log.splice(0,this.log.length-600);
  }
  press():void {if(this.paused||this.blue.hp<=0)return;this.input.press(this.realTime);this.note(this.blue,'input-request','',0,null,null,null,this.input.requestId);}
  release():void {this.input.release();}
  pause(value:boolean):void {
    this.paused=value;this.input.clear();this.move={x:0,y:0};
    if(value){this.rootHeld=false;if(this.blue.action&&this.blue.action.kind!=='basic')this.interrupt(this.blue,'pause');this.motion=undefined;this.defense.clear();}
  }
  private bindGrowth():void {
    this.detachGrowth?.();this.detachGrowth=undefined;
    if(this.growthEnabled)this.detachGrowth=energyReturn(this.hits,this.generation,id=>id===this.blue.id?this.blue.resources:undefined,(hit,delta)=>this.note(this.blue,'frost-return','energy-growth',delta,this.findActor(hit.targetId)??null,hit.actionId,null,null,{rootId:hit.rootId,parentId:hit.rootId,resourceName:'frost'}),id=>this.hazards.some(h=>h.id===id&&h.expires>this.simTime));
  }
  /** Construct changes are atomic only at the explicit safe reset point. */
  resetBuild(growth:boolean,close=false):void {this.build=growth?"energy":"base";this.growthEnabled=growth;this.reset(close);}
  private available():boolean{return !this.paused&&this.blue.hp>0&&this.simTime>=this.blue.hurtUntil;}
  private special(kind:ActionKind,pose:string,duration:number,events:{at:number;kind:string}[],rootId?:number,parentId:number|null=null):Action {
    const a=this.blue;if(a.action)this.interrupt(a,kind);
    const id=++this.serial,facing=Math.atan2(this.aim.y,this.aim.x);
    a.facing=facing;a.action={kind,pose,rootId:rootId??id,parentId,requestId:null,id,stage:-1,track:new EventTrack(events,duration,this.generation),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
    this.note(a,'accepted',kind);return a.action;
  }
  dodge():boolean {
    const a=this.blue;
    if(!this.available()||this.motion||a.action&& !['basic','shield','dash-strike'].includes(a.action.kind)||!this.resources.spendDodge()){this.note(a,'reject','dodge-unavailable');return false;}
    // Accepted dash clears the edge, retains held, and does not consume basic sequence.
    this.input.accept();this.defense.clear();this.rootHeld=false;
    const action=this.special('dash-strike',m.dashClip.pose,m.dashClip.duration,m.dashClip.events);
    const length=Math.hypot(this.move.x,this.move.y),facing=length?Math.atan2(this.move.y,this.move.x):action.facing;
    this.motion={source:'input-dodge',actionId:action.id,facing,distance:m.dashDistance,duration:m.dashDuration,elapsed:0};
    this.defense.protect(action.id,this.simTime+r.dodgeInvulnerability);
    this.note(a,'dodge','accepted',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'dash'});return true;
  }
  shield(held:boolean):boolean {
    if(!held){this.defense.guardHeld=false;if(this.blue.action?.kind==='shield')this.interrupt(this.blue,'shield-release');return true;}
    if(this.defense.guardHeld)return true;
    if(!this.available()||this.motion||this.resources.frost<1||this.blue.action&&!this.blue.action.attackUnlocked){this.note(this.blue,'reject','shield-unavailable');return false;}
    const a=this.special('shield',m.guardPose,86400,[]);this.defense.guardHeld=true;this.defense.guardStartedAt=this.simTime;this.defense.guardFacing=a.facing;return true;
  }
  prepareActive():boolean {
    if(!this.available()||this.motion||!this.resources.activeReady()||this.blue.action&&!this.blue.action.attackUnlocked){this.note(this.blue,'reject','active-unavailable');return false;}
    this.defense.clear();const action=this.special('active-prepare',m.preparePose,86400,[]);this.rootHeld=true;
    this.defense.protect(action.id,this.simTime+m.activeAimMax);
    this.motion={source:'active-retreat',actionId:action.id,facing:action.facing,distance:-r.retreatDistance,duration:r.retreatDuration,elapsed:0};return true;
  }
  releaseActive():boolean {
    const action=this.blue.action;
    if(!this.available()||action?.kind!=='active-prepare'||action.releasing)return false;
    this.rootHeld=false;action.releasing=true;return true;
  }
  cancelUpper():boolean {
    if(this.blue.action?.kind==='active-prepare'){this.interrupt(this.blue,'aim-cancel');this.rootHeld=false;return true;}return false;
  }
  private advanceMotion(dt:number):void {
    const motion=this.motion;if(!motion)return;
    const old=motion.elapsed/motion.duration;motion.elapsed=Math.min(motion.duration,motion.elapsed+dt);const next=motion.elapsed/motion.duration;
    // SAMPLE ease-out owns displacement; wall collision never changes defense expiry.
    const ease=(t:number)=>1-(1-t)*(1-t);const step=motion.distance*(ease(next)-ease(old));
    this.moveActor(this.blue,Math.cos(motion.facing)*step,Math.sin(motion.facing)*step);
    if(motion.elapsed>=motion.duration)this.motion=undefined;
  }
  reset(close=false):void {
    this.projectiles.reset();this.axe?.detach();this.axe=undefined;this.delayed=[];this.columns=[];this.effects=[];
    this.generation++;this.blue=actor('blue',close?0:-2,sample.hp.blue);this.enemies=[actor('zombie',close?1.3:2,sample.hp.zombie)];
    if(this.encounter!=='melee'){
      const ranged=actor('ranged-1',close?1.3:3,rangedProfile.sample.enemyHp);ranged.enemyKind='ranged-reference';ranged.cooldown=rangedProfile.reference.initialCooldown;
      this.enemies=this.encounter==='ranged'?[ranged]:[...this.enemies,ranged];
      if(this.encounter==='mixed'){this.enemy.x=close?1.3:0;this.enemy.y=-1.5;ranged.y=1;}
    }
    if(this.build==="axe"||this.build==="ice-axe")this.axe=new AxeEquipment(this.attacks,this.generation,"blue",event=>{
      const effect:DerivedEffect={id:++this.serial,kind:"axe",source:event,x:this.blue.x,y:this.blue.y,facing:event.facing,readyAt:this.simTime+x.source.axeDelay,expires:this.simTime+x.source.axeLifetime,spawned:false};this.effects.push(effect);this.identityNote(event,"axe-created",effect.id);
      const auxiliary:AttackEvent={...event,id:++this.serial,actionId:effect.id,parentId:event.actionId,executedSkillId:"兽人的大斧挥舞一",isLeftMouse:false,tags:[]};
      this.identityNote(auxiliary,"attack-event",effect.id);this.attacks.publish(auxiliary);
    },(event,reason)=>{this.identityNote(event,'axe-rejected');this.log.at(-1)!.result=reason;this.log.at(-1)!.rejectReason=reason;});
    this.resources=this.blue.resources!;this.motion=undefined;this.defense.clear();this.rootHeld=false;this.bindGrowth();
    this.simTime=this.realTime=0;this.nextStage=0;this.comboDeadline=Infinity;this.finalRecoveryUntil=0;this.hitstopUntil=0;this.hitstopScale=1;this.log=[];this.hazards=[];this.input.clear();this.move={x:0,y:0};this.aim={x:1,y:0};this.paused=false;
  }
  enemyReady(skipFacing:boolean,e:Actor=this.enemy):boolean {
    if(e.hp<=0||this.blue.hp<=0||!e.enabled){e.reject='dead/disabled';return false;}
    if(e.action||this.simTime<e.hurtUntil){e.reject='control';return false;}
    if(e.cooldown>0){e.reject='cooldown';return false;}
    const d=Math.hypot(this.blue.x-e.x,this.blue.y-e.y);
    if(d>(e.enemyKind==='ranged-reference'?rangedProfile.reference.castRange:sample.castRange)||e.enemyKind==='ranged-reference'&&d<rangedProfile.reference.minRange){e.reject='range';return false;}
    if(!skipFacing&&Math.abs(angleDelta(Math.atan2(this.blue.y-e.y,this.blue.x-e.x),e.facing))>(e.enemyKind==='ranged-reference'?rangedProfile.sample.finalAngle:sample.finalAngle)){e.reject='facing';return false;}
    e.reject='';return true;
  }
  interrupt(a:Actor,reason:string):void {
    const action=a.action;if(!action)return;
    this.note(a,'cancel',reason);action.track.cancel();a.action=undefined;
    if(a.id==='blue'){if(action.kind==='basic')this.comboDeadline=this.realTime+reference.comboRetention;if(action.kind==='shield')this.defense.guardHeld=false;if(action.kind==='active-prepare'||action.kind==='shield-charge')this.defense.revoke(action.id);if(this.motion?.actionId===action.id)this.motion=undefined;}
    // Legacy a1–a3 clear danger. New ice and independent derived effects keep finite released hazards.
    if(a.id==='blue'&&(action.kind==='dash-strike'||action.kind==='basic'&&action.stage<3&&action.executedSkillId!==x.source.iceId))this.hazards=this.hazards.filter(h=>h.actionId!==action.id);
  }
  private accept(a:Actor,stage:number):void {
    if(a.action)this.interrupt(a,'next-basic');
    if(a.id==='blue'&&stage===2&&this.iceEnabled&&this.resources.frost<x.source.iceCost){this.note(a,'reject','ice-frost-precheck');stage=3;}
    const ice=a.id==='blue'&&stage===2&&this.iceEnabled;
    const ranged=a.enemyKind==='ranged-reference';
    const clip=ranged?{duration:rangedProfile.sample.actionRecovery,events:[{at:0,kind:'Flash'},{at:rangedProfile.reference.spawnEventTime,kind:'Hit'},{at:rangedProfile.reference.spawnEventTime,kind:'Lock'}]}:ice?x.clip:a.id==='blue'?blueClips[stage]:zombieClip;
    const facing=a.id==='blue'?Math.atan2(this.aim.y,this.aim.x):Math.atan2(this.blue.y-a.y,this.blue.x-a.x);
    a.facing=facing;a.action={kind:a.id==='blue'?'basic':'enemy-attack',pose:ice?x.clip.pose:a.id==='blue'?`a${stage+1}`:'attack',executedSkillId:ice?x.source.iceId:a.id==='blue'?`小蓝a${stage+1}`:'僵尸攻击',slotSkillId:a.id==='blue'?`小蓝a${stage+1}`:'僵尸攻击',rootId:this.serial+1,parentId:null,requestId:a.id==='blue'?this.input.requestId:null,id:++this.serial,stage,track:new EventTrack(clip.events,clip.duration,this.generation,sample.animationRate),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
    if(a.id==='blue'){this.nextStage=(stage+1)%4;this.comboDeadline=Infinity;this.input.accept();if(stage===3)this.finalRecoveryUntil=this.simTime+.5;}
    else a.cooldown=ranged?rangedProfile.reference.repeatCooldown:sample.zombieCd;
    if(ranged){a.action.executedSkillId=a.action.slotSkillId=rangedProfile.reference.rootSkill;a.action.targetSnapshot={x:this.blue.x,y:this.blue.y};}
    this.note(a,'accepted');
  }
  private moveActor(a:Actor,dx:number,dy:number):void {
    const r=sample.actorRadius;
    // Arena boundaries and one explicit block; no visual-only correction or root-motion accumulation.
    const nx=Math.max(-sample.arenaHalfWidth+r,Math.min(sample.arenaHalfWidth-r,a.x+dx));
    const ny=Math.max(-sample.arenaHalfHeight+r,Math.min(sample.arenaHalfHeight-r,a.y+dy));
    const blocked=(x:number,y:number)=>x>-1.1-r&&x<1.1+r&&y>2-r&&y<2.65+r;
    if(!blocked(nx,a.y))a.x=nx;if(!blocked(a.x,ny))a.y=ny;
  }
  private updateAction(a:Actor,dt:number):void {
    const action=a.action;if(!action)return;
    if(action.kind==='shield'){
      action.facing=a.facing=Math.atan2(this.aim.y,this.aim.x);this.defense.guardFacing=a.facing;action.track.advance(dt,this.generation);return;
    }
    if(action.kind==='active-prepare'&&action.pose===m.preparePose){
      action.facing=a.facing=Math.atan2(this.aim.y,this.aim.x);
      if(action.track.time>=m.activeAimMax){this.interrupt(a,'aim-timeout');this.rootHeld=false;return;}
      if(!this.motion&&action.releasing){action.pose=m.rootReleaseClip.pose;action.track=new EventTrack(m.rootReleaseClip.events,m.rootReleaseClip.duration,this.generation);}
      else {action.track.advance(dt,this.generation);return;}
    }
    for(const event of action.track.advance(dt,this.generation)){
      this.note(a,'track-event',event.kind);
      if(event.kind==='Dash'&&(action.kind==='basic'||action.kind==='enemy-attack')){
        const ice=action.executedSkillId===x.source.iceId;
        const duration=ice?x.source.iceDashDuration:a.id==='blue'?sample.dashDurations[action.stage]:sample.zombieDashDuration;
        action.dashLeft=duration;action.dashSpeed=(ice?x.source.iceDash:a.id==='blue'?sample.dashDistances[action.stage]:sample.zombieDashDistance)/duration;
      }
      if(event.kind==='Hit'&&action.kind==='active-prepare'){
        if(this.resources.payActive())this.note(a,'active-payment','Attack',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'active-charge'});
        else {this.interrupt(a,'payment-failed');return;}
      }
      let attackSnapshot:AttackEvent|undefined;
      if(event.kind==='Hit'&&a.id==='blue'){
        const ice=action.executedSkillId===x.source.iceId;
        if(ice&&!this.resources.spendIce(this.simTime)){this.interrupt(a,'ice-frost-release');return;}
        if(ice)this.note(a,'ice-payment','release',-1,null,action.id,action.stage,action.requestId,{rootId:action.rootId,parentId:null,resourceName:'frost'});
        const identity:AttackEvent={loadoutRevision:this.generation,equipmentInstanceId:this.axe?`blue-axe-${this.generation}`:undefined,id:++this.serial,generation:this.generation,casterId:a.id,actionId:action.id,rootId:action.rootId,parentId:action.parentId,slotSkillId:action.slotSkillId??action.kind,executedSkillId:action.executedSkillId??action.kind,isLeftMouse:action.kind==='basic',tags:ice?['左键']:action.kind==='shield-charge'?['盾击']:[],suppressBuff:false,facing:action.facing};
        attackSnapshot=identity;this.identityNote(identity,'attack-event');this.attacks.publish(identity);
        if(ice)this.delayed.push({due:this.simTime+x.source.iceDelay,position:{x:a.x+Math.cos(action.facing)*x.sample.columnOffset,y:a.y+Math.sin(action.facing)*x.sample.columnOffset},source:identity});
      }
      if(event.kind==='Hit'&&a.enemyKind==='ranged-reference'){this.spawnRanged(a,action);continue;}
      if(event.kind==='Hit'&&action.kind!=='active-prepare'){
        const dash=action.kind==='dash-strike',charge=action.kind==='shield-charge';
        this.hazards.push({source:attackSnapshot,skillTags:charge||action.kind==='basic'&&action.stage===2&&action.executedSkillId!==x.source.iceId?['盾击']:[],kind:action.kind,rootId:action.rootId,parentId:action.parentId,damage:a.id!=='blue'?sample.zombieDamage:charge?r.chargeDamage:dash?m.dashDamage:action.executedSkillId===x.source.iceId?x.source.iceDamage:sample.damage[action.stage],id:++this.serial,actionId:action.id,owner:a.id,stage:action.stage,facing:action.facing,range:charge?m.chargeRange:dash?m.dashRange:a.id==='blue'?sample.ranges[action.stage]:1.6,halfAngle:charge?m.chargeHalfAngle:dash?m.dashHalfAngle:a.id==='blue'?sample.halfAngles[action.stage]:.8,expires:this.simTime+(charge?m.chargeLifetime:sample.hazardLifetime),generation:this.generation,requestId:action.requestId,hit:false});
        this.note(a,'hazard-created');
      }
      if(event.kind==='Break'){action.attackUnlocked=true;if(action.kind==='basic'&&action.stage===3)this.finalRecoveryUntil=Math.min(this.finalRecoveryUntil,this.simTime+sample.finalRecovery);}
      if(event.kind==='End')action.moveUnlocked=true;
    }
    if(action.dashLeft>0){const step=Math.min(dt,action.dashLeft);this.moveActor(a,Math.cos(action.facing)*action.dashSpeed*step,Math.sin(action.facing)*action.dashSpeed*step);action.dashLeft-=step;}
    if(action.track.finished){
      this.note(a,'finish');a.action=undefined;
      if(action.kind==='basic')this.comboDeadline=this.realTime+reference.comboRetention;
      if(action.kind==='active-prepare'){
        this.defense.revoke(action.id);
        const child=this.special('shield-charge',m.chargeClip.pose,m.chargeClip.duration,m.chargeClip.events,action.rootId,action.id);
        child.facing=a.facing=action.facing;
        this.defense.protect(child.id,this.simTime+m.chargeClip.duration);
        this.motion={source:'shield-charge',actionId:child.id,facing:child.facing,distance:r.chargeDistance,duration:r.chargeDuration,elapsed:0};
      }
    }
  }
  private identityNote(source:AttackEvent,kind:string,effectId?:number):void {
    this.note(this.findActor(source.casterId)??this.blue,kind,source.executedSkillId,0,null,source.actionId,null,null,{rootId:source.rootId,parentId:source.parentId});
    Object.assign(this.log.at(-1)!,{loadoutRevision:source.loadoutRevision,equipmentInstanceId:source.equipmentInstanceId,executedSkillId:source.executedSkillId,slotSkillId:source.slotSkillId,attackEventId:source.id,effectId});
  }
  private advanceDerived():void {
    const due=this.delayed.filter(t=>t.due<=this.simTime);this.delayed=this.delayed.filter(t=>t.due>this.simTime);
    for(const task of due)if(task.source.generation===this.generation&&this.blue.hp>0){const column:IceColumn={...task.position,id:++this.serial,hp:x.source.columnHp,expires:this.simTime+x.source.columnLifetime,generation:this.generation,source:task.source};this.columns.push(column);this.identityNote(task.source,'column-created',column.id);}
    this.columns=this.columns.filter(c=>{if(c.expires<=this.simTime){this.identityNote(c.source,'column-expired',c.id);return false;}return c.hp>0&&c.generation===this.generation;});
    for(const effect of this.effects)if(!effect.spawned&&effect.readyAt<=this.simTime&&effect.expires>this.simTime){
      effect.spawned=true;const axe=effect.kind==='axe';
      this.hazards.push({source:effect.source,kind:effect.kind,rootId:effect.source.rootId,parentId:effect.source.actionId,damage:axe?x.source.axeDamage:x.source.burstDamage,id:effect.id,actionId:effect.id,owner:'blue',stage:-1,facing:effect.facing,range:axe?x.sample.axeRange:x.sample.burstRange,halfAngle:axe?x.sample.axeHalfAngle:Math.PI,expires:effect.expires,generation:this.generation,requestId:null,hit:false,origin:{x:effect.x,y:effect.y},persistent:true});
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
    this.projectiles.advance(this.simTime,this.generation,[]);
    for(const p of this.projectiles.landings){
      const owner=this.findActor(p.ownerId);if(!owner)continue;
      const dx=p.position.x-this.blue.x,dy=p.position.y-this.blue.y;
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
        (h.columnHits??=new Set()).add(c.id);c.hp-=h.owner==='blue'&&h.skillTags?.includes('盾击')?999:1;
        if(c.hp<=0){this.identityNote(c.source,'column-shattered',c.id);this.effects.push({id:++this.serial,kind:'ice-burst',source:c.source,x:c.x,y:c.y,facing:0,readyAt:this.simTime,expires:this.simTime+x.sample.burstLifetime,spawned:false});}
      }
    }
    this.columns=this.columns.filter(c=>c.hp>0);
  }
  private tagProjectileContact(h:Hazard):void {if(h.projectileId)Object.assign(this.log.at(-1)!,{projectileId:h.projectileId,explosionId:h.id,executedSkillId:rangedProfile.reference.explosionSkill,sourceSkillId:rangedProfile.reference.rootSkill,ruleProfile:rangedProfile.sample.label});}
  private collide():void {
    for(const h of this.hazards){
      if(h.kind==='ranged-explosion'&&h.expires<=this.simTime)continue;
      const owner=this.findActor(h.owner);if(!owner)continue;
      for(const target of h.owner===this.blue.id?this.enemies:[this.blue]){
      if(h.hit&&!h.hitTargets||h.hitTargets?.has(target.id)||h.generation!==this.generation||target.hp<=0||!h.persistent&&owner.hp<=0)continue;
      const origin=h.origin??owner;const dx=target.x-origin.x,dy=target.y-origin.y,d=Math.hypot(dx,dy);
      if(d>h.range+sample.actorRadius||Math.abs(angleDelta(Math.atan2(dy,dx),h.facing))>h.halfAngle+Math.asin(Math.min(1,sample.actorRadius/Math.max(.001,d))))continue;
      (h.hitTargets??=new Set()).add(target.id);
      if(target.id==='blue'&&this.defense.invulnerable(this.simTime)){if(!h.hit){this.note(target,'evade','invulnerable',0,owner,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});this.tagProjectileContact(h);}h.hit=true;continue;}
      h.hit=true;
      if(target.id==='blue'&&this.defense.guardHeld){
        if(this.defense.canBlock(this.simTime,h.kind==='ranged-explosion'?(d>rangedProfile.sample.guardCoincidenceEpsilon?Math.atan2(-dy,-dx):h.incomingAngle!):Math.atan2(owner.y-target.y,owner.x-target.x))&&this.resources.spendBlock(this.simTime)){
          this.note(target,'block','front-contact',-1,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId,resourceName:'frost'});this.tagProjectileContact(h);continue;
        }
        this.note(target,'block-failed',this.resources.frost<1?'frost-insufficient':'direction/phase',0,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId});this.tagProjectileContact(h);
      }
      const damage=Math.min(target.hp,h.damage);target.hp-=damage;
      this.note(owner,'damage',h.kind==='axe'?'axe-contact':h.kind==='ice-burst'?'ice-burst-contact':h.kind==='ranged-explosion'?'landing-contact':'contact',-damage,target,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});if(h.source)Object.assign(this.log.at(-1)!,{loadoutRevision:h.source.loadoutRevision,equipmentInstanceId:h.source.equipmentInstanceId,waveId:h.id,executedSkillId:h.kind==='axe'?'兽人的大斧挥舞一':h.kind==='ice-burst'?'小蓝冰柱碎冰':h.source.executedSkillId,sourceSkillId:h.kind==='axe'||h.kind==='ice-burst'?h.source.executedSkillId:undefined,attackEventId:h.source.id,effectId:h.id,slotSkillId:h.source.slotSkillId});target.hurtRealTime=this.realTime;
      this.tagProjectileContact(h);
      this.hits.publish({generation:this.generation,casterId:owner.id,actionId:h.actionId,rootId:h.rootId,waveId:h.id,targetId:target.id,kind:h.kind,damage});
      // SAMPLE defensive toughness defaults to zero; damage and interruption are separate.
      const interrupts=canInterrupt(1,target.toughness);
      if(interrupts){this.interrupt(target,'hurt');target.hurtUntil=this.simTime+sample.hurtDuration;}
      const norm=Math.max(.001,d);target.knock={x:dx/norm*sample.knockback/sample.hurtDuration,y:dy/norm*sample.knockback/sample.hurtDuration};
      this.note(target,interrupts?'hurt':'hit-uninterrupted');this.hitstopUntil=this.realTime+(owner.id==='blue'?(h.stage===3?.045:.03):.2);this.hitstopScale=owner.id==='blue'?.15:.5;
      if(target.hp<=0){target.enabled=false;this.interrupt(target,'death');this.note(target,'death');this.hazards=this.hazards.filter(x=>x.owner!==target.id||x.persistent);if(target.id==='blue'){this.input.clear();this.motion=undefined;this.rootHeld=false;this.defense.clear();}}
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
      if(this.blue.hp>0)this.resources.advance(dt,this.simTime,this.defense.guardHeld);
      if(!this.blue.action&&this.realTime>this.comboDeadline){this.nextStage=0;this.comboDeadline=Infinity;}
      if(!this.motion&&!this.defense.guardHeld&&this.blue.action?.kind!=='active-prepare'&&this.blue.hp>0&&this.input.request(this.realTime)&&this.simTime>=this.blue.hurtUntil&&this.simTime>=this.finalRecoveryUntil&&(!this.blue.action||this.blue.action.attackUnlocked))this.accept(this.blue,this.nextStage);
      for(const a of [this.blue,...this.enemies]){
        a.cooldown=Math.max(0,a.cooldown-dt);
        if(a.hp<=0)continue;
        if(this.simTime<a.hurtUntil){this.moveActor(a,a.knock.x*dt,a.knock.y*dt);continue;}
        if(a.id==='blue'){
          this.advanceMotion(dt);
          const length=Math.hypot(this.move.x,this.move.y);
          if(length&&!this.motion&&a.action?.kind==='shield'){this.moveActor(a,this.move.x/length*sample.blueSpeed*m.guardMoveScale*dt,this.move.y/length*sample.blueSpeed*m.guardMoveScale*dt);}
          else if(length&&!this.motion&&(!a.action||a.action.moveUnlocked)){if(a.action)this.interrupt(a,'move');a.facing=Math.atan2(this.move.y,this.move.x);this.moveActor(a,this.move.x/length*sample.blueSpeed*dt,this.move.y/length*sample.blueSpeed*dt);}
          else if(!a.action)a.facing=Math.atan2(this.aim.y,this.aim.x);
        }else if(a.enabled&&!a.action&&this.blue.hp>0&&a.cooldown<=0){
          const distance=Math.hypot(this.blue.x-a.x,this.blue.y-a.y);
          const desired=Math.atan2(this.blue.y-a.y,this.blue.x-a.x);a.facing+=Math.max(-(a.enemyKind==='ranged-reference'?rangedProfile.sample.turnSpeed:sample.zombieTurn)*dt,Math.min((a.enemyKind==='ranged-reference'?rangedProfile.sample.turnSpeed:sample.zombieTurn)*dt,angleDelta(desired,a.facing)));
          if(this.enemyReady(true,a)){if(this.enemyReady(false,a))this.accept(a,0);}
          else if(a.reject==='range'){const sign=a.enemyKind==='ranged-reference'&&distance<rangedProfile.sample.comfortMin?-1:1;this.moveActor(a,Math.cos(a.facing)*sample.zombieSpeed*dt*sign,Math.sin(a.facing)*sample.zombieSpeed*dt*sign);}
        }
        if(a.enemyKind==='ranged-reference'&&a.enabled&&!a.action&&a.cooldown>0&&this.blue.hp>0){
          const dx=this.blue.x-a.x,dy=this.blue.y-a.y,d=Math.hypot(dx,dy),sign=d<rangedProfile.sample.comfortMin?-1:d>rangedProfile.sample.comfortMax?1:0;
          if(d&&sign)this.moveActor(a,dx/d*rangedProfile.sample.moveSpeed*dt*sign,dy/d*rangedProfile.sample.moveSpeed*dt*sign);
        }
        this.updateAction(a,dt);
      }
      this.collideColumns();this.collide();
    }
  }
}
