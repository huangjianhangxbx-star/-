import {al03 as rangedProfile} from '../../profiles/al03';
import type {Action,Actor,Hazard,LabWorld} from '../world';
import {EventTrack} from '../kernel';
import {LabResources} from '../resources';
import {reference} from '../../profiles/reference';
import {blueClips,sample} from '../../profiles/sample';
import {m2Reference as r,m2Sample as m} from '../../profiles/m2';
import {al02 as x} from '../../profiles/al02';
import type {AttackEvent} from '../attack-events';
import type {PlayerController,PlayerProfile,ResourceRow} from '../player-controller';
/** AL01–02 semantics isolated from the shared world. No new character is forced into these rules. */
export class IsdaraController implements PlayerController {
 readonly profile:PlayerProfile={kind:'isdara',characterId:'小蓝',actorId:'blue',label:'小蓝',family:'blue',hp:100,speed:4,builds:true};
 readonly resources=new LabResources();private rootHeld=false;
 constructor(private readonly w:LabWorld){}
 private available():boolean{return !this.w.paused&&this.w.player.hp>0&&this.w.simTime>=this.w.player.hurtUntil;}
 secondary(held:boolean):boolean{return this.shield(held);}
 mobility():boolean{return this.dodge();}
 active():boolean{return this.prepareActive();}
 cancel():boolean{return this.cancelUpper();}
 resourceRows():ResourceRow[]{return [{name:'霜寒',value:this.resources.frost.toFixed(2)+' / 3'},{name:'闪避次数',value:String(this.resources.dashCharges)+' / 2'},{name:'破阵猛冲',value:String(this.resources.activeCharge)+' / 1'},{name:'MP',value:String(this.resources.mp)+' / 100'}];}
  dodge():boolean {
    const a=this.w.player;
    if(!this.available()||this.w.motion||a.action&& !['basic','shield','dash-strike'].includes(a.action.kind)||!this.resources.spendDodge()){this.w.note(a,'reject','dodge-unavailable');return false;}
    // Accepted dash clears the edge, retains held, and does not consume basic sequence.
    this.w.input.accept();this.w.defense.clear();this.rootHeld=false;
    const action=this.w.special('dash-strike',m.dashClip.pose,m.dashClip.duration,m.dashClip.events);
    const length=Math.hypot(this.w.move.x,this.w.move.y),facing=length?Math.atan2(this.w.move.y,this.w.move.x):action.facing;
    this.w.motion={source:'input-dodge',actionId:action.id,facing,distance:m.dashDistance,duration:m.dashDuration,elapsed:0};
    this.w.defense.protect(action.id,this.w.simTime+r.dodgeInvulnerability);
    this.w.note(a,'dodge','accepted',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'dash'});return true;
  }
  shield(held:boolean):boolean {
    if(!held){this.w.defense.guardHeld=false;if(this.w.player.action?.kind==='shield')this.w.interrupt(this.w.player,'shield-release');return true;}
    if(this.w.defense.guardHeld)return true;
    if(!this.available()||this.w.motion||this.resources.frost<1||this.w.player.action&&!this.w.player.action.attackUnlocked){this.w.note(this.w.player,'reject','shield-unavailable');return false;}
    const a=this.w.special('shield',m.guardPose,86400,[]);this.w.defense.guardHeld=true;this.w.defense.guardStartedAt=this.w.simTime;this.w.defense.guardFacing=a.facing;return true;
  }
  prepareActive():boolean {
    if(!this.available()||this.w.motion||!this.resources.activeReady()||this.w.player.action&&!this.w.player.action.attackUnlocked){this.w.note(this.w.player,'reject','active-unavailable');return false;}
    this.w.defense.clear();const action=this.w.special('active-prepare',m.preparePose,86400,[]);this.rootHeld=true;
    this.w.defense.protect(action.id,this.w.simTime+m.activeAimMax);
    this.w.motion={source:'active-retreat',actionId:action.id,facing:action.facing,distance:-r.retreatDistance,duration:r.retreatDuration,elapsed:0};return true;
  }
  releaseActive():boolean {
    const action=this.w.player.action;
    if(!this.available()||action?.kind!=='active-prepare'||action.releasing)return false;
    this.rootHeld=false;action.releasing=true;return true;
  }
  cancelUpper():boolean {
    if(this.w.player.action?.kind==='active-prepare'){this.w.interrupt(this.w.player,'aim-cancel');this.rootHeld=false;return true;}return false;
  }
  private advanceMotion(dt:number):void {
    const motion=this.w.motion;if(!motion)return;
    const old=motion.elapsed/motion.duration;motion.elapsed=Math.min(motion.duration,motion.elapsed+dt);const next=motion.elapsed/motion.duration;
    // SAMPLE ease-out owns displacement; wall collision never changes defense expiry.
    const ease=(t:number)=>1-(1-t)*(1-t);const step=motion.distance*(ease(next)-ease(old));
    this.w.moveActor(this.w.player,Math.cos(motion.facing)*step,Math.sin(motion.facing)*step);
    if(motion.elapsed>=motion.duration)this.w.motion=undefined;
  }
  updateAction(dt:number):void {
    const a=this.w.player,action=a.action;if(!action)return;
    if(action.kind==='shield'){
      action.facing=a.facing=Math.atan2(this.w.aim.y,this.w.aim.x);this.w.defense.guardFacing=a.facing;action.track.advance(dt,this.w.generation);return;
    }
    if(action.kind==='active-prepare'&&action.pose===m.preparePose){
      action.facing=a.facing=Math.atan2(this.w.aim.y,this.w.aim.x);
      if(action.track.time>=m.activeAimMax){this.w.interrupt(a,'aim-timeout');this.rootHeld=false;return;}
      if(!this.w.motion&&action.releasing){action.pose=m.rootReleaseClip.pose;action.track=new EventTrack(m.rootReleaseClip.events,m.rootReleaseClip.duration,this.w.generation);}
      else {action.track.advance(dt,this.w.generation);return;}
    }
    for(const event of action.track.advance(dt,this.w.generation)){
      this.w.note(a,'track-event',event.kind);
      if(event.kind==='Dash'&&(action.kind==='basic'||action.kind==='enemy-attack')){
        const ice=action.executedSkillId===x.source.iceId;
        const duration=ice?x.source.iceDashDuration:a.id==='blue'?sample.dashDurations[action.stage]:sample.zombieDashDuration;
        action.dashLeft=duration;action.dashSpeed=(ice?x.source.iceDash:a.id==='blue'?sample.dashDistances[action.stage]:sample.zombieDashDistance)/duration;
      }
      if(event.kind==='Hit'&&action.kind==='active-prepare'){
        if(this.resources.payActive())this.w.note(a,'active-payment','Attack',-1,null,action.id,null,null,{rootId:action.rootId,parentId:null,resourceName:'active-charge'});
        else {this.w.interrupt(a,'payment-failed');return;}
      }
      let attackSnapshot:AttackEvent|undefined;
      if(event.kind==='Hit'&&a.id==='blue'){
        const ice=action.executedSkillId===x.source.iceId;
        if(ice&&!this.resources.spendIce(this.w.simTime)){this.w.interrupt(a,'ice-frost-release');return;}
        if(ice)this.w.note(a,'ice-payment','release',-1,null,action.id,action.stage,action.requestId,{rootId:action.rootId,parentId:null,resourceName:'frost'});
        const identity:AttackEvent={loadoutRevision:this.w.generation,equipmentInstanceId:this.w.equipmentIdentity,id:this.w.nextIdentity(),generation:this.w.generation,casterId:a.id,actionId:action.id,rootId:action.rootId,parentId:action.parentId,slotSkillId:action.slotSkillId??action.kind,executedSkillId:action.executedSkillId??action.kind,isLeftMouse:action.kind==='basic',tags:ice?['左键']:action.kind==='shield-charge'?['盾击']:[],suppressBuff:false,facing:action.facing};
        attackSnapshot=identity;this.w.identityNote(identity,'attack-event');this.w.publishAttack(identity);
        if(ice)this.w.scheduleColumn(identity);
      }
      if(event.kind==='Hit'&&action.kind!=='active-prepare'){
        const dash=action.kind==='dash-strike',charge=action.kind==='shield-charge';
        this.w.hazards.push({source:attackSnapshot,skillTags:charge||action.kind==='basic'&&action.stage===2&&action.executedSkillId!==x.source.iceId?['盾击']:[],kind:action.kind,rootId:action.rootId,parentId:action.parentId,damage:a.id!=='blue'?sample.zombieDamage:charge?r.chargeDamage:dash?m.dashDamage:action.executedSkillId===x.source.iceId?x.source.iceDamage:sample.damage[action.stage],id:this.w.nextIdentity(),actionId:action.id,owner:a.id,stage:action.stage,facing:action.facing,range:charge?m.chargeRange:dash?m.dashRange:a.id==='blue'?sample.ranges[action.stage]:1.6,halfAngle:charge?m.chargeHalfAngle:dash?m.dashHalfAngle:a.id==='blue'?sample.halfAngles[action.stage]:.8,expires:this.w.simTime+(charge?m.chargeLifetime:sample.hazardLifetime),generation:this.w.generation,requestId:action.requestId,hit:false});
        this.w.note(a,'hazard-created');
      }
      if(event.kind==='Break'){action.attackUnlocked=true;if(action.kind==='basic'&&action.stage===3)this.w.finalRecoveryUntil=Math.min(this.w.finalRecoveryUntil,this.w.simTime+sample.finalRecovery);}
      if(event.kind==='End')action.moveUnlocked=true;
    }
    if(action.dashLeft>0){const step=Math.min(dt,action.dashLeft);this.w.moveActor(a,Math.cos(action.facing)*action.dashSpeed*step,Math.sin(action.facing)*action.dashSpeed*step);action.dashLeft-=step;}
    if(action.track.finished){
      this.w.note(a,'finish');a.action=undefined;
      if(action.kind==='basic')this.w.comboDeadline=this.w.realTime+reference.comboRetention;
      if(action.kind==='active-prepare'){
        this.w.defense.revoke(action.id);
        const child=this.w.special('shield-charge',m.chargeClip.pose,m.chargeClip.duration,m.chargeClip.events,action.rootId,action.id);
        child.facing=a.facing=action.facing;
        this.w.defense.protect(child.id,this.w.simTime+m.chargeClip.duration);
        this.w.motion={source:'shield-charge',actionId:child.id,facing:child.facing,distance:r.chargeDistance,duration:r.chargeDuration,elapsed:0};
      }
    }
  }

  guardContact(h:Hazard,owner:Actor,dx:number,dy:number,d:number):boolean {
    const w=this.w,target=w.player;if(!w.defense.guardHeld)return false;
        if(w.defense.canBlock(w.simTime,h.kind==='ranged-explosion'?(d>rangedProfile.sample.guardCoincidenceEpsilon?Math.atan2(-dy,-dx):h.incomingAngle!):Math.atan2(owner.y-target.y,owner.x-target.x))&&this.resources.spendBlock(w.simTime)){
          w.note(target,'block','front-contact',-1,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId,resourceName:'frost'});w.tagProjectileContact(h);return true;
        }
        w.note(target,'block-failed',this.resources.frost<1?'frost-insufficient':'direction/phase',0,owner,h.actionId,null,h.requestId,{rootId:h.rootId,parentId:h.parentId});w.tagProjectileContact(h);
    return false;
  }
 private accept(stage:number):void {
  const w=this.w,a=w.player;if(a.action)w.interrupt(a,'next-basic');
  if(stage===2&&w.iceEnabled&&this.resources.frost<x.source.iceCost){w.note(a,'reject','ice-frost-precheck');stage=3;}
  const ice=stage===2&&w.iceEnabled,clip=ice?x.clip:blueClips[stage],facing=Math.atan2(w.aim.y,w.aim.x),id=w.nextIdentity();
  a.facing=facing;a.action={kind:'basic',pose:ice?x.clip.pose:`a${stage+1}`,executedSkillId:ice?x.source.iceId:`小蓝a${stage+1}`,slotSkillId:`小蓝a${stage+1}`,rootId:id,parentId:null,requestId:w.input.requestId,id,stage,track:new EventTrack(clip.events,clip.duration,w.generation,sample.animationRate),facing,attackUnlocked:false,moveUnlocked:false,dashLeft:0,dashSpeed:0};
  w.nextStage=(stage+1)%4;w.comboDeadline=Infinity;w.input.accept();if(stage===3)w.finalRecoveryUntil=w.simTime+.5;w.note(a,'accepted');
 }
 interrupted(action:Action,_reason:string):void {
  const w=this.w;if(action.kind==='basic')w.comboDeadline=w.realTime+reference.comboRetention;if(action.kind==='shield')w.defense.guardHeld=false;
  if(action.kind==='active-prepare'||action.kind==='shield-charge')w.defense.revoke(action.id);if(w.motion?.actionId===action.id)w.motion=undefined;
  if(action.kind==='dash-strike'||action.kind==='basic'&&action.stage<3&&action.executedSkillId!==x.source.iceId)w.hazards=w.hazards.filter(h=>h.actionId!==action.id);
 }
 step(dt:number):void {
  const w=this.w,a=w.player;if(a.hp>0)this.resources.advance(dt,w.simTime,w.defense.guardHeld);
  if(!a.action&&w.realTime>w.comboDeadline){w.nextStage=0;w.comboDeadline=Infinity;}
  if(!w.motion&&!w.defense.guardHeld&&a.action?.kind!=='active-prepare'&&a.hp>0&&w.input.request(w.realTime)&&w.simTime>=a.hurtUntil&&w.simTime>=w.finalRecoveryUntil&&(!a.action||a.action.attackUnlocked))this.accept(w.nextStage);
  if(a.hp<=0||w.simTime<a.hurtUntil)return;
  this.advanceMotion(dt);const length=Math.hypot(w.move.x,w.move.y);
  if(length&&!w.motion&&a.action?.kind==='shield')w.moveActor(a,w.move.x/length*sample.blueSpeed*m.guardMoveScale*dt,w.move.y/length*sample.blueSpeed*m.guardMoveScale*dt);
  else if(length&&!w.motion&&(!a.action||a.action.moveUnlocked)){if(a.action)w.interrupt(a,'move');a.facing=Math.atan2(w.move.y,w.move.x);w.moveActor(a,w.move.x/length*sample.blueSpeed*dt,w.move.y/length*sample.blueSpeed*dt);}
  else if(!a.action)a.facing=Math.atan2(w.aim.y,w.aim.x);
 }
}
