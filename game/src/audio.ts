import {isAlV2} from './core/al-state';
import {isHunterV2} from './core/hunter-state';
import {positionVisible} from './core/visibility';
import type {GameState,Life,Effect} from './core/types';
import {gameAudio, type GameAudio} from './game-audio';

type Cue='deploy'|'card'|'cancel'|'rescue';
type Sound=Cue|'shot'|'melee'|'hurt'|'crystal'|'victory'|'defeat'|'skill'|'hunterShot'|'bow'|'knife'|'enemy'|'venom'|'wave'|'ready'|'loot'|'fiorre';

/** Detects established gameplay results; the shared owner alone creates sound nodes. */
export class BattleAudio{
 private basicSeen=new Map<string,number>();private previous:GameState|null=null;private previousTime=0;private phase:GameState['phase']|null=null;
 private hp=new Map<string,number>();private life=new Map<string,Life>();private crystal=0;private cards=0;private wave=0;private skillReady=new Map<string,boolean>();private seen=new Set<number>();
 constructor(private output:GameAudio=gameAudio()){}
 get muted(){return this.output.isMuted}
 unlock(){void this.output.unlockFromGesture().catch(()=>{});}
 setMuted(value:boolean){this.output.setMuted(value);}
 cue(name:Cue){this.play(name);}
 update(state:GameState){
  if(this.previous!==state||state.time<this.previousTime){
   this.basicSeen=new Map(state.units.map(u=>[u.id,u.basicRelease?.id||0]));this.previous=state;this.phase=state.phase;this.seen=new Set(state.effects.map(e=>e.id));
   this.hp.clear();this.life.clear();this.skillReady.clear();this.crystal=state.crystalHp;this.cards=state.stats.cards||0;this.wave=state.wave;
   for(const unit of state.units){this.hp.set(unit.id,unit.hp);this.life.set(unit.id,unit.life);this.skillReady.set(unit.id,unit.skillCd<=0)}
   this.previousTime=state.time;return;
  }
  for(const u of state.units){const r=u.basicRelease;if(r&&r.id!==(this.basicSeen.get(u.id)||0)){this.basicSeen.set(u.id,r.id);if(!isHunterV2(state,u)&&!isAlV2(state,u)&&positionVisible(state,u.pos))this.play(u.weapons[u.weaponIndex].remote?'shot':'melee',u.id,u.pos,'release:'+u.id+':'+r.id);}}
  for(const effect of state.effects){
   if(this.seen.has(effect.id))continue;this.seen.add(effect.id);
   if(effect.sourceId&&state.units.some(u=>u.id===effect.sourceId&&(isAlV2(state,u)||isHunterV2(state,u)||!!u.enemyV2)))continue;
   if(positionVisible(state,effect.from)&&positionVisible(state,effect.to)&&!effect.basicReleaseId)this.play(effectSound(state,effect),effect.sourceId||'effect',effect.to,'effect:'+effect.id);
  }
  if(this.seen.size>2048)this.seen=new Set(state.effects.map(e=>e.id));let injured=false;
  for(const unit of state.units){const oldHp=this.hp.get(unit.id),oldLife=this.life.get(unit.id);
   if(!isHunterV2(state,unit)&&!isAlV2(state,unit)&&unit.team==='ally'&&oldHp!==undefined&&unit.hp<oldHp)injured=true;
   if(oldLife&&oldLife!==unit.life){if(unit.life==='active'&&['reserve','withdrawn'].includes(oldLife))this.play('deploy',unit.id,unit.pos);if(unit.life==='rescued'&&oldLife==='downed')this.play('rescue',unit.id,unit.pos);}
   const ready=unit.skillCd<=0,was=this.skillReady.get(unit.id);if(ready&&!was&&unit.life==='active'&&unit.role==='hunter')this.play('ready',unit.id,unit.pos);this.skillReady.set(unit.id,ready);this.hp.set(unit.id,unit.hp);this.life.set(unit.id,unit.life);
  }
  if(injured)this.play('hurt');if(state.crystalHp<this.crystal)this.play('crystal');if((state.stats.cards||0)>this.cards)this.play('card');if(state.wave>this.wave&&state.wave>1)this.play('wave');
  if(state.phase==='result'&&this.phase!=='result'){this.play(state.result==='victory'?'victory':'defeat');this.output.stinger(state.result==='victory'?'victory':'defeat',true);}
  this.crystal=state.crystalHp;this.cards=state.stats.cards||0;this.wave=state.wave;this.phase=state.phase;this.previousTime=state.time;
 }
 private play(name:Sound,sourceId='battle',position?:{x:number;y:number},eventKey?:string){this.output.cue('battle.'+name,sourceId,position,eventKey);}
}

export function effectSound(state:GameState,effect:Effect):Sound{
 const source=state.units.find(u=>u.id===effect.sourceId),role=source?.role||(source?.cloneOf?state.units.find(u=>u.id===source.cloneOf)?.role:undefined);
 if(effect.kind==='loot')return 'loot';if(effect.kind==='heal')return 'rescue';if(effect.sourceId==='fiorre')return 'fiorre';if(effect.kind==='burst')return role==='guard'?'venom':'skill';
 if(effect.action==='skill'&&role==='hunter')return 'hunterShot';if(role==='guard')return 'knife';if(role==='ranger')return source?.sniperMode?'hunterShot':'bow';if(source?.team==='enemy')return 'enemy';
 const remote=source?.weapons[source.weaponIndex]?.remote??Math.hypot(effect.to.x-effect.from.x,effect.to.y-effect.from.y)>1.5;return remote?'shot':'melee';
}
