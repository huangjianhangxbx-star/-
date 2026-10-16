import type {DialogueScriptRuntime,DialogueStartRequest,DialogueAdvanceRequest,DialogueChoiceRequest,DialogueSessionSnapshot,DialogueDefinition,DialogueEffect,DialogueNode} from './model';
import {selectDialogue} from './selector';
import {DialogueEffects} from './effects';
let serial=0;
export class DialogueRunner implements DialogueScriptRuntime{
 private definition?:DialogueDefinition;private session?:DialogueSessionSnapshot;
 constructor(private effects:DialogueEffects){}
 private snapshot(){return structuredClone(this.session!);}
 start(r:DialogueStartRequest){if(this.session?.status==='active')throw Error('已有对话');const d=selectDialogue(r.definitions,r.context,r.predicates).selected;if(!d)throw Error('没有可用对话');this.definition=structuredClone(d);const c=r.context;this.session={sessionId:`dialogue-${++serial}`,definitionId:d.id,actorId:c.actorId,initiator:c.initiator,world:c.world,place:c.place,identity:c.identity,nodeId:'',revision:0,shownNodes:[],chosenOptions:[],status:'active',kind:'end',speakerId:c.actorId,text:'',options:[],hasNext:false};try{this.enter(d.entryNodeId);}catch(e){this.session.status='cancelled';throw e;}const h=c.history[d.id]??={count:0,worlds:[],last:0};h.count++;if(!h.worlds.includes(c.world))h.worlds.push(c.world);h.last=c.time;return this.snapshot();}
 private check(r:DialogueAdvanceRequest){if(!this.session||this.session.status!=='active'||r.sessionId!==this.session.sessionId||r.revision!==this.session.revision)throw Error('过期的对话请求');return this.session;}
 private enter(id?:string){let n:DialogueNode|undefined;const effects:DialogueEffect[]=[],seen=new Set<string>();while(id){if(seen.has(id))throw Error('对话效果环');seen.add(id);n=this.definition!.nodes[id];if(!n)throw Error('缺失对话节点 '+id);if(n.kind!=='effect')break;effects.push(n.effect);id=n.next;n=undefined;}
 this.effects.apply(effects);const s=this.session!;s.revision++;s.nodeId=n?.id??'';s.options=[];s.text='';s.hasNext=false;
 if(!n||n.kind==='end'){s.status='ended';s.kind='end';return;}
 if(n.kind==='effect')throw Error('无法呈现效果节点');s.kind=n.kind;s.shownNodes.push(n.id);if(n.kind==='line'){s.text=n.text;s.speakerId=n.speakerId;s.hasNext=this.hasPresentation(n.next);}else{s.text=n.prompt??'';s.options=structuredClone(n.options);}
 }
 private hasPresentation(id?:string):boolean{const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);const n=this.definition!.nodes[id];if(!n||n.kind==='end')return false;if(n.kind==='line'||n.kind==='choice')return true;id=n.next;}return false;}
 advance(r:DialogueAdvanceRequest){const s=this.check(r),n=this.definition!.nodes[s.nodeId];if(n?.kind!=='line')throw Error('当前需要选择');this.enter(n.next);return this.snapshot();}
 choose(r:DialogueChoiceRequest){const s=this.check(r);if(s.kind!=='choice')throw Error('当前不是选项');const o=s.options.find(x=>x.id===r.optionId);if(!o)throw Error('无效选项');this.enter(o.next);s.chosenOptions.push(o.id);return this.snapshot();}
 cancel(r:DialogueAdvanceRequest){const s=this.check(r);s.status='cancelled';s.revision++;return this.snapshot();}
}
