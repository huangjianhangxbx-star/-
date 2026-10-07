import {AttackInput,EventTrack} from './kernel';
import {reference} from '../profiles/reference';
import {blueClips,sample,zombieClip} from '../profiles/sample';
import {m2Reference as r,m2Sample as m} from '../profiles/m2';
import {LabResources} from './resources';
import {LabDefense,type ActionKind,type Motion} from './abilities';
import {HitEffects,energyReturn} from './hit-effects';
export interface Vec {x:number;y:number}
export interface Action {kind:ActionKind;pose:string;rootId:number;parentId:number|null;releasing?:boolean;requestId:number|null;id:number;stage:number;track:EventTrack;facing:number;attackUnlocked:boolean;moveUnlocked:boolean;dashLeft:number;dashSpeed:number}
export interface Actor extends Vec {resources?:LabResources;id:'blue'|'zombie';toughness:number;hp:number;maxHp:number;facing:number;action?:Action;hurtUntil:number;cooldown:number;enabled:boolean;reject:string;knock:Vec;hurtRealTime:number}
export interface Hazard {kind:ActionKind;rootId:number;parentId:number|null;damage:number;id:number;actionId:number;owner:Actor['id'];stage:number;facing:number;range:number;halfAngle:number;expires:number;generation:number;requestId:number|null;hit:boolean}
export interface LabEvent {sequence:number;worldGeneration:number;actorId:Actor['id'];actionInstanceId:number|null;parentActionId:number|null;rootActionId:number|null;resourceName:string|null;ruleProfile:string;timeScale:number;inputRequestId:number|null;eventKind:string;result:string;rejectReason:string|null;realTime:number;simTime:number;actionTime:number|null;position:Vec;facing:number;resourceDelta:number;targetId:Actor['id']|null;stage:number|null}
function actor(id:Actor['id'],x:number,hp:number):Actor {return {id,resources:id==='blue'?new LabResources():undefined,toughness:0,x,y:0,hp,maxHp:hp,facing:id==='blue'?0:Math.PI,hurtUntil:0,cooldown:id==='blue'?0:2.5,enabled:true,reject:'',knock:{x:0,y:0},hurtRealTime:-Infinity};}
export function angleDelta(a:number,b:number):number {return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function canInterrupt(incoming:number,defensive:number):boolean {return incoming>defensive;}
export class LabWorld {
  private eventSequence=0;
  blue=actor('blue',-2,sample.hp.blue); enemy=actor('zombie',2,sample.hp.zombie);
  resources=this.blue.resources!;defense=new LabDefense();motion?:Motion;growthEnabled=false;
  private hits=new HitEffects();private detachGrowth?:()=>void;private rootHeld=false;
  aim:Vec={x:1,y:0}; move:Vec={x:0,y:0};
  nextStage=0; log:LabEvent[]=[]; hazards:Hazard[]=[]; generation=1; simTime=0;realTime=0;
  input=new AttackInput(reference.inputLifetime); paused=false; speed=1;comboDeadline=Infinity;finalRecoveryUntil=0;
  private serial=0; private hitstopUntil=0;private hitstopScale=1;
  private note(a:Actor,kind:string,result='',delta=0,target:Actor|null=null,actionId=a.action?.id??null,stage=a.action?.stage??null,requestId=a.action?.requestId??null,identity?:{rootId:number;parentId:number|null;resourceName?:string}):void {
    this.log.push({sequence:++this.eventSequence,worldGeneration:this.generation,actorId:a.id,actionInstanceId:actionId,parentActionId:identity?identity.parentId:a.action?.parentId??null,rootActionId:identity?.rootId??a.action?.rootId??null,resourceName:identity?.resourceName??(kind==='damage'?'HP':null),ruleProfile:sample.label,timeScale:this.speed*(this.realTime<this.hitstopUntil?this.hitstopScale:1),inputRequestId:requestId,eventKind:kind,result,rejectReason:kind==='reject'?result:null,realTime:this.realTime,simTime:this.simTime,actionTime:a.action?.id===actionId?a.action.track.time:null,position:{x:a.x,y:a.y},facing:a.facing,resourceDelta:delta,targetId:target?.id??null,stage});
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
    if(this.growthEnabled)this.detachGrowth=energyReturn(this.hits,this.generation,id=>id===this.blue.id?this.blue.resources:undefined,(hit,delta)=>this.note(this.blue,'frost-return','energy-growth',delta,this.enemy,hit.actionId,null,null,{rootId:hit.rootId,parentId:hit.rootId,resourceName:'frost'}),id=>this.hazards.some(h=>h.id===id&&h.expires>this.simTime));
  }
  /** Construct changes are atomic only at the explicit safe reset point. */
  resetBuild(growth:boolean,close=false):void {this.growthEnabled=growth;this.reset(close);}
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
    this.generation++;this.blue=actor('blue',close?0:-2,sample.hp.blue);this.enemy=actor('zombie',close?1.3:2,sample.hp.zombie);
    this.resources=this.blue.resources!;this.motion=undefined;this.defense.clear();this.rootHeld=false;this.bindGrowth();
    this.simTime=this.realTime=0;this.nextStage=0;this.comboDeadline=Infinity;this.finalRecoveryUntil=0;this.hitstopUntil=0;this.hitstopScale=1;this.log=[];this.hazards=[];this.input.clear();this.move={x:0,y:0};this.aim={x:1,y:0};this.paused=false;
  }
  enemyReady(skipFacing:boolean):boolean {
    const e=this.enemy;
    if(e.hp<=0||this.blue.hp<=0||!e.enabled){e.reject='dead/disabled';return false;}
    if(e.action||this.simTime<e.hurtUntil){e.reject='control';return false;}
    if(e.cooldown>0){e.reject='cooldown';return false;}
    const d=Math.hypot(this.blue.x-e.x,this.blue.y-e.y);
    if(d>sample.castRange){e.reject='range';return false;}
    if(!skipFacing&&Math.abs(angleDelta(Math.atan2(this.blue.y-e.y,this.blue.x-e.x),e.facing))>sample.finalAngle){e.reject='facing';return false;}
    e.reject='';return true;
  }
  interrupt(a:Actor,reason:string):void {
    const action=a.action;if(!action)return;
    this.note(a,'cancel',reason);action.track.cancel();a.action=undefined;
    if(a.id==='blue'){if(action.kind==='basic')this.comboDeadline=this.realTime+reference.comboRetention;if(action.kind==='shield')this.defense.guardHeld=false;if(action.kind==='active-prepare'||action.kind==='shield-charge')this.defense.revoke(action.id);if(this.motion?.actionId===action.id)this.motion=undefined;}
    // a1–a3 clear their owned danger; a4/root zombie keep their already generated instance.
    if(a.id==='blue'&&(action.kind==='dash-strike'||action.kind==='basic'&&action.stage<3))this.hazards=this.hazards.filter(h=>h.actionId!==action.id);
  }
  private accept(a:Actor,stage:number):void {
    if(a.action)this.interrupt(a,'next-basic');
    const clip=a.id==='blue'?blueClips[stage]:zombieClip;
    const facing=a.id==='blue'?Math.atan2(this.aim.y,this.aim.x):Math.atan2(this.blue.y-a.y,this.blue.x-a.x);
    a.facing=facing;a.action={kind:a.id==='blue'?'basic':'enemy-attack',pose:a.id==='blue'?`a${stage+1}`:'attack',rootId:this.serial+1,parentId:null,requestId:a.id==='blue'?this.input.requestId:null,id:++this.serial,stage,track:new EventTrack(clip.events,clip.duration,this.generation,sample.animationRate),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
    if(a.id==='blue'){this.nextStage=(stage+1)%4;this.comboDeadline=Infinity;this.input.accept();if(stage===3)this.finalRecoveryUntil=this.simTime+.5;}
    else a.cooldown=sample.zombieCd;
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
        const duration=a.id==='blue'?sample.dashDurations[action.stage]:sample.zombieDashDuration;
        action.dashLeft=duration;action.dashSpeed=(a.id==='blue'?sample.dashDistances[action.stage]:sample.zombieDashDistance)/duration;
      }
      if(event.kind==='Hit'&&action.kind==='active-prepare'){
        if(this.resources.payActive())this.note(a,'active-payment','Attack',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'active-charge'});
        else {this.interrupt(a,'payment-failed');return;}
      }
      if(event.kind==='Hit'&&action.kind!=='active-prepare'){
        const dash=action.kind==='dash-strike',charge=action.kind==='shield-charge';
        this.hazards.push({kind:action.kind,rootId:action.rootId,parentId:action.parentId,damage:a.id==='zombie'?sample.zombieDamage:charge?r.chargeDamage:dash?m.dashDamage:sample.damage[action.stage],id:++this.serial,actionId:action.id,owner:a.id,stage:action.stage,facing:action.facing,range:charge?m.chargeRange:dash?m.dashRange:a.id==='blue'?sample.ranges[action.stage]:1.6,halfAngle:charge?m.chargeHalfAngle:dash?m.dashHalfAngle:a.id==='blue'?sample.halfAngles[action.stage]:.8,expires:this.simTime+(charge?m.chargeLifetime:sample.hazardLifetime),generation:this.generation,requestId:action.requestId,hit:false});
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
  private collide():void {
    for(const h of this.hazards){
      const owner=h.owner==='blue'?this.blue:this.enemy,target=h.owner==='blue'?this.enemy:this.blue;
      if(h.hit||h.generation!==this.generation||target.hp<=0||owner.hp<=0)continue;
      const dx=target.x-owner.x,dy=target.y-owner.y,d=Math.hypot(dx,dy);
      if(d>h.range+sample.actorRadius||Math.abs(angleDelta(Math.atan2(dy,dx),h.facing))>h.halfAngle+Math.asin(Math.min(1,sample.actorRadius/Math.max(.001,d))))continue;
      if(target.id==='blue'&&this.defense.invulnerable(this.simTime)){if(!h.hit)this.note(target,'evade','invulnerable',0,owner,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});h.hit=true;continue;}
      h.hit=true;
      if(target.id==='blue'&&this.defense.guardHeld){
        if(this.defense.canBlock(this.simTime,Math.atan2(owner.y-target.y,owner.x-target.x))&&this.resources.spendBlock(this.simTime)){
          this.note(target,'block','front-contact',-1,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId,resourceName:'frost'});continue;
        }
        this.note(target,'block-failed',this.resources.frost<1?'frost-insufficient':'direction/phase',0,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId});
      }
      const damage=Math.min(target.hp,h.damage);target.hp-=damage;
      this.note(owner,'damage','contact',-damage,target,h.actionId,h.stage,h.requestId,{rootId:h.rootId,parentId:h.parentId});target.hurtRealTime=this.realTime;
      this.hits.publish({generation:this.generation,casterId:owner.id,actionId:h.actionId,rootId:h.rootId,waveId:h.id,targetId:target.id,kind:h.kind,damage});
      // SAMPLE defensive toughness defaults to zero; damage and interruption are separate.
      const interrupts=canInterrupt(1,target.toughness);
      if(interrupts){this.interrupt(target,'hurt');target.hurtUntil=this.simTime+sample.hurtDuration;}
      const norm=Math.max(.001,d);target.knock={x:dx/norm*sample.knockback/sample.hurtDuration,y:dy/norm*sample.knockback/sample.hurtDuration};
      this.note(target,interrupts?'hurt':'hit-uninterrupted');this.hitstopUntil=this.realTime+(owner.id==='blue'?(h.stage===3?.045:.03):.2);this.hitstopScale=owner.id==='blue'?.15:.5;
      if(target.hp<=0){target.enabled=false;this.interrupt(target,'death');this.note(target,'death');this.hazards=this.hazards.filter(x=>x.owner!==target.id);if(target.id==='blue'){this.input.clear();this.motion=undefined;this.rootHeld=false;this.defense.clear();}}
    }
    this.hazards=this.hazards.filter(h=>h.generation===this.generation&&h.expires>this.simTime&&(h.owner==='blue'?this.blue:this.enemy).hp>0);
  }
  advance(delta:number):void {
    if(!Number.isFinite(delta)||delta<0||delta>30)throw new Error('Invalid frame delta');
    if(this.paused||delta===0)return;
    // Bound each collision step; process the entire active frame, never drop crossed events.
    const count=Math.max(1,Math.ceil(delta*120)),realStep=delta/count;
    for(let i=0;i<count;i++){
      this.realTime+=realStep;const dt=realStep*this.speed*(this.realTime<this.hitstopUntil?this.hitstopScale:1);this.simTime+=dt;
      if(this.blue.hp>0)this.resources.advance(dt,this.simTime,this.defense.guardHeld);
      if(!this.blue.action&&this.realTime>this.comboDeadline){this.nextStage=0;this.comboDeadline=Infinity;}
      if(!this.motion&&!this.defense.guardHeld&&this.blue.action?.kind!=='active-prepare'&&this.blue.hp>0&&this.input.request(this.realTime)&&this.simTime>=this.blue.hurtUntil&&this.simTime>=this.finalRecoveryUntil&&(!this.blue.action||this.blue.action.attackUnlocked))this.accept(this.blue,this.nextStage);
      for(const a of [this.blue,this.enemy]){
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
          const desired=Math.atan2(this.blue.y-a.y,this.blue.x-a.x);a.facing+=Math.max(-sample.zombieTurn*dt,Math.min(sample.zombieTurn*dt,angleDelta(desired,a.facing)));
          if(this.enemyReady(true)){if(this.enemyReady(false))this.accept(a,0);}
          else if(a.reject==='range'){this.moveActor(a,Math.cos(a.facing)*sample.zombieSpeed*dt,Math.sin(a.facing)*sample.zombieSpeed*dt);}
        }
        this.updateAction(a,dt);
      }
      this.collide();
    }
  }
}
