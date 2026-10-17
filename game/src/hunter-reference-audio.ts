import {gameAudio,type GameAudio} from './game-audio';
import {isHunterV2} from './core/hunter-state';
import {audioActionsSince,latestAudioActionId} from './core/audio-events';
import type {GameState} from './core/types';
/** Formal semantic adapter; the independent Action Lab retains its own player. */
export class HunterReferenceAudio {
 private world?:GameState;private seen=0;
 constructor(private audio:GameAudio=gameAudio()){}
 unlock(){void this.audio.unlockFromGesture().catch(()=>{});}
 setMuted(value:boolean){this.audio.setMuted(value);}
 update(s:GameState,scale:number){
  const h=s.units.find(u=>isHunterV2(s,u));
  if(this.world!==s){this.world=s;this.seen=latestAudioActionId(s);return;}
  for(const e of audioActionsSince(s,this.seen)){this.seen=e.id;if(scale>0&&h&&e.sourceId===h.id)this.audio.cue('reference.'+e.cue,h.id,e.position,'hunter:'+e.id);}
 }
 stop(){this.audio.stopScope('hunter','hunter-stop');}
 dispose(){this.stop();}
}
