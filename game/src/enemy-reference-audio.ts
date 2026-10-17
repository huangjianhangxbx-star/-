import {gameAudio,type GameAudio} from './game-audio';
import type {GameState} from './core/types';
import {audioActionsSince,latestAudioActionId} from './core/audio-events';
import {positionVisible} from './core/visibility';
/** SAMPLE cue bindings, weak consumption marks prevent reset/pause backlog replay. */
export class EnemyReferenceAudio{
 private world?:GameState;private seen=0;
 constructor(private audio:GameAudio=gameAudio()){}
 unlock(){void this.audio.unlockFromGesture().catch(()=>{});}setMuted(v:boolean){this.audio.setMuted(v);}
 update(s:GameState,scale:number){if(this.world!==s){this.world=s;this.seen=latestAudioActionId(s);return;}
  for(const e of audioActionsSince(s,this.seen)){this.seen=e.id;if(scale===0)continue;const u=s.units.find(u=>u.id===e.sourceId&&u.enemyV2);if(u&&positionVisible(s,e.position))this.audio.cue('reference.enemy.'+e.cue,u.id,e.position,'enemy:'+e.id);}
 }dispose(){for(const u of this.world?.units??[])if(u.enemyV2)this.audio.stopScope(u.id,'enemy-dispose');}
}
