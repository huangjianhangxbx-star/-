import {positionVisible} from './core/visibility';
import type {GameState,Life,Effect} from './core/types';

type Cue='deploy'|'card'|'cancel'|'rescue';
type Sound=Cue|'shot'|'melee'|'hurt'|'crystal'|'victory'|'defeat'|'skill'|'hunterShot'|'bow'|'knife'|'fiorre'|'enemy'|'venom'|'wave'|'ready'|'loot';
const LIMIT=8;

/** A small procedural sound bus. No context is created before unlock is called by a real gesture. */
export class BattleAudio {
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private silent=false;
 private failed=false;
 private basicSeen=new Map<string,number>();
 private previous:GameState|null=null;
 private previousTime=0;
 private phase:GameState['phase']|null=null;
 private hp=new Map<string,number>();
 private life=new Map<string,Life>();
 private crystal=0;
 private cards=0;
 private wave=0;
 private skillReady=new Map<string,boolean>();
 private seen=new Set<number>();
 private ends:number[]=[];
 private last=new Map<Sound,number>();
 get muted(){return this.silent}

 unlock():void {
  if(this.failed)return;
  try{
   if(!this.context){
    this.context=new AudioContext({latencyHint:'interactive'});
    this.master=this.context.createGain();this.master.gain.value=this.silent?0:.13;
    const compressor=this.context.createDynamicsCompressor();
    compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=8;
    compressor.attack.value=.002;compressor.release.value=.12;
    this.master.connect(compressor);compressor.connect(this.context.destination);
   }
   if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  }catch{this.failed=true;}
 }

 setMuted(value:boolean):void {
  this.silent=value;
  if(this.context&&this.master){
   const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);
   this.master.gain.setTargetAtTime(value?0:.13,now,.008);
  }
 }

 cue(name:Cue):void {this.play(name)}

 update(state:GameState):void {
  if(this.previous!==state||state.time<this.previousTime){
   this.basicSeen=new Map(state.units.map(u=>[u.id,u.basicRelease?.id||0]));this.previous=state;this.phase=state.phase;this.seen=new Set(state.effects.map(e=>e.id));
   this.hp.clear();this.life.clear();this.skillReady.clear();this.crystal=state.crystalHp;this.cards=state.stats.cards||0;this.wave=state.wave;
   for(const unit of state.units){this.hp.set(unit.id,unit.hp);this.life.set(unit.id,unit.life);this.skillReady.set(unit.id,unit.skillCd<=0)}
   this.previousTime=state.time;return;
  }
  for(const u of state.units){const r=u.basicRelease;if(r&&r.id!==(this.basicSeen.get(u.id)||0)){this.basicSeen.set(u.id,r.id);if(positionVisible(state,u.pos))this.play(u.weapons[u.weaponIndex].remote?'shot':'melee');}}
  for(const effect of state.effects){
   if(this.seen.has(effect.id))continue;
   this.seen.add(effect.id);
   if(positionVisible(state,effect.from)&&positionVisible(state,effect.to)){if(!effect.basicReleaseId)this.play(effectSound(state,effect));}
  }
  if(this.seen.size>2048)this.seen=new Set(state.effects.map(e=>e.id));
  let injured=false;
  for(const unit of state.units){
   const oldHp=this.hp.get(unit.id),oldLife=this.life.get(unit.id);
   if(unit.team==='ally'&&oldHp!==undefined&&unit.hp<oldHp)injured=true;
   if(oldLife&&oldLife!==unit.life){
    if(unit.life==='active'&&['reserve','withdrawn'].includes(oldLife))this.play('deploy');
    if(unit.life==='rescued'&&oldLife==='downed')this.play('rescue');
   }
   const skillReady=unit.skillCd<=0,wasReady=this.skillReady.get(unit.id);if(skillReady&&!wasReady&&unit.life==='active'&&(unit.role==='hunter'||unit.role==='fiorre'))this.play('ready');this.skillReady.set(unit.id,skillReady);
   this.hp.set(unit.id,unit.hp);this.life.set(unit.id,unit.life);
  }
  if(injured)this.play('hurt');
  if(state.crystalHp<this.crystal)this.play('crystal');
  if((state.stats.cards||0)>this.cards)this.play('card');
  if(state.wave>this.wave&&state.wave>1)this.play('wave');
  if(state.phase==='result'&&this.phase!=='result')this.play(state.result==='victory'?'victory':'defeat');
  this.crystal=state.crystalHp;this.cards=state.stats.cards||0;this.wave=state.wave;this.phase=state.phase;this.previousTime=state.time;
 }

 private play(name:Sound):void {
  const ctx=this.context,master=this.master;
  if(!ctx||!master||ctx.state!=='running'||this.silent)return;
  const now=ctx.currentTime;
  // Repeated update() calls while paused cannot replay events; simultaneous duplicate cues are coalesced.
  if(now-(this.last.get(name)??-Infinity)<(name==='shot'||name==='melee'?.045:.09))return;
  this.ends=this.ends.filter(t=>t>now);
  if(this.ends.length>=LIMIT)return;
  this.last.set(name,now);
  const duration=name==='victory'||name==='defeat'?.72:name==='rescue'||name==='venom'?.4:name==='crystal'?.32:name==='hunterShot'?.26:name==='wave'?.5:.19;
  this.ends.push(now+duration+.04);
  const voice=ctx.createGain();voice.gain.value=1;voice.connect(master);
  const tone=(frequency:number,endFrequency:number,start:number,length:number,type:OscillatorType='sine',volume=.24)=>{
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=type;
   oscillator.frequency.setValueAtTime(frequency,now+start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),now+start+length);
   gain.gain.setValueAtTime(.0001,now+start);gain.gain.exponentialRampToValueAtTime(volume,now+start+.004);
   gain.gain.exponentialRampToValueAtTime(.0001,now+start+length);
   oscillator.connect(gain);gain.connect(voice);oscillator.start(now+start);oscillator.stop(now+start+length+.01);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  };
  const noise=(length:number,frequency:number,volume:number)=>{
   const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=buffer.getChannelData(0);
   let seed=137;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/2147483648-1)*(1-i/data.length)**2;}
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;
   filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;gain.gain.value=volume;
   source.connect(filter);filter.connect(gain);gain.connect(voice);source.start(now);
   source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
  };
  switch(name){
   case 'shot':noise(.09,1800,.7);tone(140,48,0,.15,'triangle',.3);break;
   case 'hunterShot':noise(.075,2450,.65);tone(190,58,0,.24,'sawtooth',.23);tone(740,110,.025,.16,'triangle',.12);break;
   case 'bow':noise(.105,1250,.23);tone(610,190,0,.22,'triangle',.22);tone(1380,730,.02,.12,'sine',.12);break;
   case 'knife':noise(.065,3000,.3);tone(1200,530,0,.095,'square',.11);tone(185,95,.025,.12,'triangle',.21);break;
   case 'fiorre':noise(.055,1100,.15);tone(360,140,0,.16,'triangle',.16);tone(520,280,.04,.13,'sine',.1);break;
   case 'enemy':noise(.12,520,.35);tone(95,42,0,.21,'sawtooth',.22);break;
   case 'venom':noise(.24,730,.55);tone(82,34,0,.38,'sawtooth',.32);tone(430,120,.025,.28,'square',.1);break;
   case 'wave':tone(220,165,0,.32,'triangle',.17);tone(330,250,.18,.28,'sine',.1);break;
   case 'ready':tone(580,760,0,.14,'sine',.12);tone(920,1120,.06,.12,'triangle',.11);break;
   case 'loot':tone(1180,760,0,.075,'sine',.07);break;
   case 'melee':noise(.07,850,.55);tone(250,72,0,.13,'triangle',.3);break;
   case 'hurt':noise(.1,420,.28);tone(160,90,0,.18,'sine',.25);break;
   case 'deploy':tone(260,390,0,.16,'sine');tone(520,620,.07,.12,'triangle',.16);break;
   case 'card':noise(.045,3400,.16);tone(650,860,0,.11,'sine',.2);break;
   case 'cancel':tone(330,230,0,.09,'sine',.16);break;
   case 'rescue':tone(440,440,0,.19);tone(660,660,.12,.23,'sine',.18);break;
   case 'crystal':tone(130,56,0,.3,'triangle',.3);noise(.2,650,.4);break;
   case 'skill':noise(.16,2200,.3);tone(180,580,0,.19,'triangle',.25);break;
   case 'victory':[392,494,587,784].forEach((f,i)=>tone(f,f,i*.12,.28,'sine',.2));break;
   case 'defeat':[294,247,196].forEach((f,i)=>tone(f,f*.96,i*.17,.32,'triangle',.22));break;
  }
  // Disconnect the shared voice after all its sources have finished, without wall-clock timers.
  const tail=ctx.createConstantSource();tail.offset.value=0;tail.connect(voice);tail.start(now);tail.stop(now+duration+.04);
  tail.onended=()=>{tail.disconnect();voice.disconnect()};
 }
}

export function effectSound(state:GameState,effect:Effect):Sound{
   const source=state.units.find(u=>u.id===effect.sourceId),role=source?.role||(source?.cloneOf?state.units.find(u=>u.id===source.cloneOf)?.role:undefined);
   if(effect.kind==='loot'){return ('loot');}
   if(effect.kind==='heal')return ('rescue');
   else if(effect.kind==='burst')return (role==='guard'?'venom':'skill');
   else{
    if(effect.action==='skill'&&role==='hunter')return ('hunterShot');
    else if(role==='guard')return ('knife');
    else if(role==='fiorre')return ('fiorre');
    else if(role==='ranger')return (source?.sniperMode?'hunterShot':'bow');
    else if(source?.team==='enemy')return ('enemy');
    else{const remote=source?.weapons[source.weaponIndex]?.remote??Math.hypot(effect.to.x-effect.from.x,effect.to.y-effect.from.y)>1.5;return (remote?'shot':'melee');}
   }
}
