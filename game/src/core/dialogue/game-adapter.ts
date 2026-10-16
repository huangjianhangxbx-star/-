import type {GameState} from '../types';
import {roleProfile,roleSession,validRoleSession,roleAccess} from '../role-interaction';
import {bodyActionReady} from '../exploration-control';
import {cancelMoveOrder} from '../move-order';
import {clearMotion} from '../personal';
import type {DialogueContext,DialogueSessionSnapshot,History,Value,DialogueScriptRuntime} from './model';
import {DIALOGUE_CATALOG,resolveDialoguePool,type DialogueCatalog} from './content';
import {DialogueEffects} from './effects';
import {DialogueRunner} from './runtime';
import {selectDialogue} from './selector';
const memory=new WeakMap<GameState,{flags:Record<string,Value>;history:History}>();
function store(s:GameState){let m=memory.get(s);if(!m){m={flags:{},history:{}};memory.set(s,m);}return m;}
/** Session-local narrative state; no new persistence or second interaction ownership. */
export class DialogueGame{
 current:DialogueSessionSnapshot|null=null;
 private sourceState?:GameState;private runtime?:DialogueScriptRuntime;private token?:ReturnType<typeof roleSession>;
 private diagnostics:ReturnType<typeof selectDialogue>|null=null;
 constructor(private state:()=>GameState,private catalog:DialogueCatalog=DIALOGUE_CATALOG){}
 private safe(id:string){const s=this.state();return s.context==='explorationIdle'&&roleAccess(s,id)&&[s.controlledBodyId,id].every(key=>{const u=s.units.find(x=>x.id===key);return !!u&&u.life==='active'&&u.hp>0&&u.posture>0&&bodyActionReady(u)&&!u.hunterCombat?.special&&!u.alCombat?.special;});}
 private context(id:string):DialogueContext{const s=this.state(),m=store(s),inv=s.world?.backpack?.inventory,inventory:Record<string,number>={};if(inv)for(const i of Object.values(inv.items)){const c=inv.containers[i.location.container];if(['team','safe','reserve'].includes(i.location.container)||c?.owner)inventory[i.definitionId]=(inventory[i.definitionId]??0)+i.quantity;}
 return {actorId:id,initiator:s.controlledBodyId??'',trigger:'interaction',world:s.world!.id,place:s.world!.visit.placeId,identity:JSON.stringify(roleSession(s,id)),valid:this.safe(id),time:s.time,...m,storyNodes:[],quests:s.world?.places[s.world.visit.placeId]?.quest?{'sample-warehouse-investigation':s.world.places[s.world.visit.placeId].quest!.status}:{},characters:Object.fromEntries(s.units.map(u=>[u.id,{life:u.life,hp:u.hp}])),inventory};}
 start(id:string){if(this.current)throw Error('已有对话');const s=this.state(),u=s.units.find(x=>x.id===id);if(!u||!roleProfile(s,u)?.dialoguePoolId||!this.safe(id))throw Error('当前状态不适合交谈');const definitions=resolveDialoguePool(this.catalog,roleProfile(s,u)!.dialoguePoolId!,id);for(const d of definitions)for(const n of Object.values(d.nodes))if(n.kind==='line'&&!this.speakerValid(n.speakerId))throw Error('对话说话者失效：'+n.speakerId);const c=this.context(id);this.diagnostics=selectDialogue(definitions,c);this.runtime=new DialogueRunner(new DialogueEffects(store(s).flags,text=>{s.notice=text;}));this.current=this.runtime.start({definitions,context:c});this.sourceState=s;this.token=roleSession(s,id);const actor=s.units.find(x=>x.id===s.controlledBodyId)!;cancelMoveOrder(s,actor,'dialogue');clearMotion(actor,s,'dialogue');return this.current;}
 private speakerValid(id:string){const s=this.state(),u=s.units.find(x=>x.id===id);return !!u&&u.life==='active'&&(!u.npc||u.npc.worldId===s.world?.id&&u.npc.placeId===s.world?.visit.placeId);}
 valid(){return this.sourceState===this.state()&&!!this.current&&this.speakerValid(this.current.speakerId)&&!!this.token&&validRoleSession(this.state(),this.token)&&this.safe(this.token.target);}
 private request(){if(!this.current||!this.valid()){this.cancel();throw Error('对话目标或状态失效');}return {sessionId:this.current.sessionId,revision:this.current.revision};}
 private accept(s:DialogueSessionSnapshot){this.current=s.status==='active'?s:null;return this.current;}
 advance(){return this.accept(this.runtime!.advance(this.request()));}
 choose(optionId:string){return this.accept(this.runtime!.choose({...this.request(),optionId}));}
 cancel(){if(this.current&&this.runtime)this.runtime.cancel(this.current);this.current=null;this.token=undefined;}
 get targetId(){return this.token?.target;}
 get speakerId(){return this.current?.speakerId;}
 get debug(){return structuredClone({selection:this.diagnostics,session:this.current,flags:store(this.state()).flags});}
}
