import {LabAudio} from './action-lab/presentation/audio';
import type {GameState} from './core/types';
/** SAMPLE cue bindings, weak consumption marks prevent reset/pause backlog replay. */
export class EnemyReferenceAudio{
 private audio=new LabAudio();private world?:GameState;private seen=new WeakSet<object>();
 unlock(){void this.audio.unlock().catch(()=>{});}setMuted(v:boolean){this.audio.muted=v;if(v)this.audio.stop();}
 update(s:GameState,scale:number){if(this.world!==s){this.audio.stop();this.world=s;this.seen=new WeakSet();}
  if(scale===0)this.audio.stop();for(const u of s.units)for(const r of u.enemyV2?.trace??[]){if(this.seen.has(r))continue;this.seen.add(r);if(scale===0)continue;const cue=r.event==='attack'?'release':r.kind==='contact'&&(r.hpLost??0)>0?'hit':r.kind==='cancelled'&&r.reason==='hurt'?'hurt':undefined;if(cue)this.audio.play(cue);}
 }dispose(){this.audio.dispose();}
}
