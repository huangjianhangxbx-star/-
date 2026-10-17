import type {GameState,Pos} from './types';
/** Ephemeral presentation outbox. Unlike optional debug traces, this is always emitted by accepted gameplay results. */
export type AudioActionEvent={id:number;sourceId:string;cue:string;position:Pos;worldTime:number};
const events=new WeakMap<GameState,{next:number;rows:AudioActionEvent[]}>();
function queue(state:GameState){let found=events.get(state);if(!found){found={next:1,rows:[]};events.set(state,found);}return found;}
export function emitAudioAction(state:GameState,sourceId:string,cue:string,position:Pos){const q=queue(state);q.rows.push({id:q.next++,sourceId,cue,position:{...position},worldTime:state.time});if(q.rows.length>512)q.rows.splice(0,q.rows.length-512);}
export function audioActionsSince(state:GameState,after:number){return queue(state).rows.filter(row=>row.id>after);}
export function latestAudioActionId(state:GameState){return queue(state).next-1;}
