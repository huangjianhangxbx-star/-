import {LabAudio} from './action-lab/presentation/audio';
import {isAlV2} from './core/al-state';
import type {GameState} from './core/types';
/** Audio presentation only. No LabWorld/HP or action consumers. */
export class AlReferenceAudio {
 private audio=new LabAudio();private ready=false;private loading?:Promise<void>;private world?:GameState;private seen=0;private pending:string[]=[];
 unlock(){this.loading??=Promise.all([this.audio.unlock(),this.audio.prepareYellow()]).then(()=>{this.ready=true;for(const cue of this.pending)this.audio.play(cue);this.pending=[];}).catch(error=>{this.pending=[];window.dispatchEvent(new CustomEvent('character-load-error',{detail:'Al Reference audio unavailable: '+String(error)}));});}
 setMuted(value:boolean){this.audio.muted=value;if(value)this.stop();}
 update(s:GameState,scale:number){const trace=s.units.find(u=>isAlV2(s,u))?.alCombat?.trace??[];if(this.world!==s){this.stop();this.world=s;this.seen=trace.at(-1)?.id??0;}if(!scale){this.stop();this.seen=trace.at(-1)?.id??this.seen;return;}for(const e of trace)if(e.id>this.seen){if(e.cue){if(this.ready)this.audio.play(e.cue);else this.pending.push(e.cue);}this.seen=e.id;}}
 stop(){this.pending=[];this.audio.stop();}
 dispose(){this.stop();this.audio.dispose();}
}
