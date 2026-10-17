export type AudioBus='music'|'player'|'companion'|'enemy'|'interaction'|'ambience'|'voice'|'ui';
export type AudioRequest={eventId:string;sourceId:string;world:string;occurredAt:number;ttl:number;eventKey?:string;position?:{x:number;y:number};priority?:number};
export type Snapshot={token:string;priority:number;gains:Partial<Record<AudioBus,number>>};
export type Admission={reason:'accepted'|'expired'|'wrong-world'|'coalesced'|'duplicate';accepted:boolean};
const reject=(reason:Exclude<Admission['reason'],'accepted'>):Admission=>({reason,accepted:false});

/** The policy has no browser dependency, so offline and live backends use identical decisions. */
export class AudioPolicy{
 world='';private recent=new Map<string,number>();private keys=new Set<string>();
 admit(request:AudioRequest,now:number):Admission{
  if(request.world!==this.world)return reject('wrong-world');
  if(now-request.occurredAt>request.ttl)return reject('expired');
  if(request.eventKey){if(this.keys.has(request.eventKey))return reject('duplicate');this.keys.add(request.eventKey);if(this.keys.size>4096)this.keys.clear();}
  const key=request.sourceId+'|'+request.eventId;
  if(now-(this.recent.get(key)??-Infinity)<.04)return reject('coalesced');
  this.recent.set(key,now);if(this.recent.size>2048)this.recent.clear();return {reason:'accepted',accepted:true};
 }
 reset(world:string){this.world=world;this.recent.clear();this.keys.clear();}
}

export function resolveBusGain(user:number,bus:AudioBus,snapshots:readonly Snapshot[]):number{
 return Math.max(0,Math.min(1,user))*snapshots.reduce((gain,snapshot)=>gain*Math.max(0,Math.min(2,snapshot.gains[bus]??1)),1);
}

export type MusicContext={title:boolean;scene:string;combat:boolean;dialogue:boolean;boss?:boolean};
export type MusicChoice={id:'title'|'explore'|'explore-far'|'combat'|'dialogue'|'boss';priority:number;reason:string;intensity:number};
const RULES:readonly {id:MusicChoice['id'];priority:number;when:(c:MusicContext)=>boolean;reason:string;intensity:number}[]=[
 {id:'boss',priority:100,when:c=>!!c.boss,reason:'diagnostic boss override',intensity:1},
 {id:'combat',priority:60,when:c=>c.combat,reason:'authoritative party combat',intensity:1},
 {id:'title',priority:40,when:c=>c.title,reason:'title screen',intensity:0},
 {id:'explore-far',priority:1,when:c=>c.scene==='far-room',reason:'far-room zone',intensity:.32},
 {id:'explore',priority:0,when:()=>true,reason:'exploration fallback',intensity:.25},
];
export function chooseMusic(context:MusicContext):MusicChoice{
 const match=RULES.find(rule=>rule.when(context))!;return {id:match.id,priority:match.priority,reason:match.reason,intensity:match.intensity};
}
