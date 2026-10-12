import {test,expect} from 'vitest';
import {command,createExplorationEntry} from '../src/core/engine';
import {continueWorld,leaveWorldArea} from '../src/core/world-session';
import {exitExploration,queryExplorationExit} from '../src/core/exploration';
import {updateVision} from '../src/core/visibility';
import {queryQuestInteraction,acceptQuestInteraction,worldQuestView} from '../src/core/quest';
const accept='quest-warehouse-accept',investigate='quest-warehouse-investigate';
function setup(){const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});return s;}
function record(s:any){return s.world.places[s.world.visit.placeId].quest;}
function request(s:any,id:string){return {worldId:s.world.id,visit:s.world.visit.generation,placeId:s.world.visit.placeId,pointId:id,expectedRevision:record(s)?.revision??0,actorId:s.controlledBodyId,controlRevision:s.controlRevision??0};}
/** CORE FIXTURE: physical positions for atomic transactions, not a natural story. */
function near(s:any,id:string){const p=s.exploration.definition.points.find(p=>p.id===id);expect(p,'registered quest event').toBeDefined();const u=s.units.find(u=>u.id===s.controlledBodyId);u.pos={...p.pos};u.ready=0;updateVision(s,true);}
function interact(s:any,id:string,r=request(s,id)){return command(s,{type:'interactExploration',id,quest:r} as any);}
test('normal registered points accept then complete with exactly one carried reward and no legacy objective',()=>{
 const s=setup(),account={...s.economy.account};expect(record(s)?.status).toBe('notStarted');near(s,accept);expect(interact(s,accept).ok).toBe(true);expect(record(s).status).toBe('active');near(s,investigate);const before=s.fragments;expect(interact(s,investigate).ok).toBe(true);expect(record(s).status).toBe('completed');expect(s.fragments).toBe(before+10);expect(s.economy.account).toEqual(account);expect(s.economy.rewards.filter(k=>k.includes(':quest:'))).toHaveLength(1);expect(interact(s,investigate).ok).toBe(false);expect(s.fragments).toBe(before+10);expect(s.exploration!.memory.objective).toBe(false);expect(s.exploration!.memory.mechanisms).not.toContain(investigate);
});
test('investigating before acceptance and old revision/world/visit/place/actor requests do not pay',()=>{
 const s=setup();near(s,investigate);expect(interact(s,investigate).ok).toBe(false);expect(record(s).status).toBe('notStarted');near(s,accept);const initial=request(s,accept);expect(interact(s,accept).ok).toBe(true);const place=structuredClone(record(s)),economy=structuredClone(s.economy);for(const extra of [{worldId:'stale'},{visit:0},{placeId:999},{actorId:'ranger'},{controlRevision:999},{expectedRevision:99},{pointId:'missing'}]){expect(interact(s,accept,{...request(s,accept),...extra}).ok).toBe(false);expect(record(s)).toEqual(place);expect(s.economy).toEqual(economy);}expect(interact(s,accept,initial).ok).toBe(false);
});
test('credit overflow leaves the active quest and economic ledger unchanged',()=>{
 const s=setup();near(s,accept);expect(interact(s,accept).ok).toBe(true);near(s,investigate);s.fragments=Number.MAX_SAFE_INTEGER;const q=structuredClone(record(s)),e=structuredClone(s.economy);expect(interact(s,investigate).ok).toBe(false);expect(record(s)).toEqual(q);expect(s.economy).toEqual(e);
});
test('pure query and refused transactions preserve all state for action, geometry and ownership failures',()=>{
 for(const change of [(s:any,u:any)=>u.pos={x:6,y:8},(s:any,u:any)=>u.life='dead',(s:any,u:any)=>u.basicAction={},(s:any,u:any)=>u.stagger=1,(s:any,u:any)=>u.crossing={},(s:any,u:any)=>s.explorationControl.aim={kind:'path'},(s:any,u:any)=>s.explorationControl.commandFocusId='ranger',(s:any,u:any)=>s.world.visit.active=false,(s:any,u:any)=>s.context='nodes',(s:any,u:any)=>{u.pos={x:8,y:8};s.tiles.find(t=>t.x===9&&t.y===8).layer=1;},(s:any,u:any)=>s.tiles.find(t=>t.x===9&&t.y===8).obstacle=true,(s:any,u:any)=>s.units.filter(x=>x.team==='ally').forEach(x=>x.pos={x:100,y:100})]){
  const s=setup();near(s,accept);const r=request(s,accept),u=s.units.find(u=>u.id===s.controlledBodyId)!;change(s,u);const before=structuredClone(s);expect(queryQuestInteraction(s,r).ok).toBe(false);expect(acceptQuestInteraction(s,r).ok).toBe(false);expect(s).toEqual(before);
 }
 const s=setup();near(s,accept);const before=structuredClone(s);expect(queryQuestInteraction(s,request(s,accept)).ok).toBe(true);expect(worldQuestView(s)?.progress).toBe(0);expect(s).toEqual(before);
});
test('optional quest is not an exit gate; same world retains active/completed records, new world resets',()=>{
 const s=setup();near(s,accept);expect(interact(s,accept).ok).toBe(true);s.units=s.units.filter(u=>u.team==='ally');for(const u of s.units){u.pos={...s.exploration!.definition.exit};u.ready=0;}s.context='explorationIdle';expect(queryExplorationExit(s).ok).toBe(true);expect(exitExploration(s,[],()=>{}).ok).toBe(true);expect(record(s).status).toBe('active');const w=s.world!;expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);near(s,investigate);expect(interact(s,investigate).ok).toBe(true);const q=structuredClone(record(s)),n=s.fragments;expect(leaveWorldArea(s).ok).toBe(true);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect(record(s)).toEqual(q);expect(s.fragments).toBe(n);command(s,{type:'restartWorld',worldId:w.id});command(s,{type:'carry',gold:0,vitality:0});expect(record(s).status).toBe('notStarted');expect(s.economy.rewards.some(k=>k.includes(':quest:'))).toBe(false);
});

test('legacy resource event retains its separate reward key and does not complete the quest',()=>{
 const s=setup();s.exploration!.definition.points.push({id:'compat-resource',kind:'resource',pos:{x:9,y:8},reward:10});near(s,'compat-resource');const before=s.fragments;
 expect(command(s,{type:'interactExploration',id:'compat-resource'}).ok).toBe(true);expect(s.fragments).toBe(before+10);expect(s.economy.rewards.filter(k=>k.includes(':resource:'))).toHaveLength(1);expect(record(s).status).toBe('notStarted');expect(s.exploration!.memory.objective).toBe(false);expect(command(s,{type:'interactExploration',id:'compat-resource'}).ok).toBe(false);expect(s.fragments).toBe(before+10);
});
