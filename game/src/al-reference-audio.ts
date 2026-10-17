import {gameAudio,type GameAudio} from './game-audio';
import {isAlV2} from './core/al-state';
import {audioActionsSince,latestAudioActionId} from './core/audio-events';
import type {GameState} from './core/types';
/** Formal semantic adapter. Loading never replays a pending one-shot queue. */
export class AlReferenceAudio {
 private world?:GameState;private seen=0;
 constructor(private audio:GameAudio=gameAudio()){}
 unlock(){void this.audio.unlockFromGesture().catch(()=>{});}
 setMuted(value:boolean){this.audio.setMuted(value);}
 update(s:GameState,scale:number){const actor=s.units.find(u=>isAlV2(s,u));if(this.world!==s){this.world=s;this.seen=latestAudioActionId(s);return;}for(const e of audioActionsSince(s,this.seen)){this.seen=e.id;if(scale>0&&actor&&e.sourceId===actor.id)this.audio.cue('reference.'+e.cue,actor.id,e.position,'al:'+e.id);}}
 stop(){this.audio.stopScope('ranger','al-stop');}
 dispose(){this.stop();}
}
