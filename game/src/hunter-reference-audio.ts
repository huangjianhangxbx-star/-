import {LabAudio} from './action-lab/presentation/audio';
import {isHunterV2} from './core/hunter-state';
import type {GameState} from './core/types';
/** Presentation-only original audio adapter; no Action Lab executor or event bus. */
export class HunterReferenceAudio {
 private audio=new LabAudio();private world?:GameState;private seen=0;private stopped=true;
 unlock(){void this.audio.unlock().catch(()=>{});}
 setMuted(value:boolean){this.audio.muted=value;if(value)this.audio.stop();}
 update(s:GameState,scale:number){
  const h=s.units.find(u=>isHunterV2(s,u)),trace=h?.hunterCombat?.trace??[];
  if(this.world!==s){this.world=s;this.seen=trace.at(-1)?.id??0;}
  if(scale===0){if(!this.stopped)this.audio.stop();this.stopped=true;this.seen=trace.at(-1)?.id??this.seen;return;}
  this.stopped=false;for(const e of trace)if(e.id>this.seen){if(e.cue)this.audio.play(e.cue);this.seen=e.id;}
 }
 stop(){this.audio.stop();this.stopped=true;}
 dispose(){this.audio.dispose();}
}
