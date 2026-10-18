import {it,expect} from 'vitest';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {initializeMapWorld} from '../src/core/map-travel';
import {terrainFits,distance} from '../src/core/spatial';

function home(){
  const s=createExplorationEntry();s.sessionMode='exploration';
  command(s,{type:'selectJourney',journey:'exploration',seed:18});
  command(s,{type:'carry',gold:0,vitality:0});initializeMapWorld(s);return s;
}
it('the original resident naturally walks to distinct home activities including the outside garden',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!,original=r,weapon=r.equipment!.equipped.right;
  const origin={...r.pos};let moved=false,outside=false;
  for(let i=0;i<1600;i++){
    const from={...r.pos};step(s,.05);
    expect(terrainFits(s,r.pos)).toBe(true);
    expect(distance(from,r.pos)).toBeLessThanOrEqual(r.speed*.05+.001);
    if(distance(origin,r.pos)>.5)moved=true;if(r.pos.x<4.5)outside=true;
  }
  expect(moved).toBe(true);expect(outside).toBe(true);
  expect(s.units.filter(u=>u.id==='ranger')).toEqual([original]);expect(r.equipment!.equipped.right).toBe(weapon);
  expect(s.world!.homeResident!.mode).toBe('resident');expect(s.controlledBodyId).toBe('hunter');
});
import {DialogueGame} from '../src/core/dialogue/game-adapter';
import {holdHomeActivity,advanceHomeActivity,homeActivityDebug} from '../src/core/home-activity';
import {homeJoinRequest,joinHomeParty,queryHomeJoin,bindHomeJoinGuard} from '../src/core/home-resident';
import {MAP_EDGES} from '../src/core/map-definitions';
import {prepareTravel,commitTravel,type TravelTicket} from '../src/core/map-travel';

function until(s:ReturnType<typeof home>,predicate:()=>boolean,seconds=90){
  for(let i=0;i<seconds*20&&!predicate();i++)step(s,.05);expect(predicate()).toBe(true);
}
it('records actual arrivals at distinct stable targets, faces them and dwells in simulation time',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;
  until(s,()=>s.world!.homeResident!.activity?.phase==='dwelling');
  const a=s.world!.homeResident!.activity!,point=s.exploration!.definition.sceneLayout!.activities.find(p=>p.id===a.anchorId)!;
  expect(distance(r.pos,point.approach)).toBeLessThan(.04);expect(r.facing).toBe(point.facing);expect(a.remaining).toBeGreaterThanOrEqual(8);
  const left=a.remaining,position={...r.pos};step(s,0,20);expect(a.remaining).toBe(left);expect(r.pos).toEqual(position);
  until(s,()=>Object.keys(a.completed).length===3);expect(a.history.filter(e=>e.kind==='arrived').map(e=>e.task)).toEqual(['read','kitchen-stand','garden-inspect']);
  expect(a.planCount).toBeLessThan(10);expect(a.lastCompleted).toBe('garden-inspect');
});
it('a real dialogue immediately stops the moving resident and cancel resumes the same target',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!,h=s.units.find(u=>u.id==='hunter')!;step(s,.05);
  h.pos={x:r.pos.x-.7,y:r.pos.y+.7};const a=s.world!.homeResident!.activity!,task=a.taskId,g=new DialogueGame(()=>s);
  expect(a.phase).toBe('moving');g.start('ranger');expect(r.path).toEqual([]);expect(a.phase).toBe('interrupted');
  const position={...r.pos},left=a.remaining;for(let i=0;i<60;i++)step(s,.05);expect(r.pos).toEqual(position);expect(a.remaining).toBe(left);
  g.cancel();step(s,.05);expect(a.taskId).toBe(task);expect(a.phase).toBe('moving');expect(r.path.length).toBeGreaterThan(0);
});
it('a failed join retains the task; a successful join and an old release cannot erase a newer party path',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;step(s,.05);const a=s.world!.homeResident!.activity!,route=r.path;
  const stale=homeJoinRequest(s);stale.revision=-1;expect(joinHomeParty(s,stale).ok).toBe(false);expect(r.path).toBe(route);expect(a.phase).toBe('moving');
  const release=holdHomeActivity(s,'ranger','role-menu');release();expect(joinHomeParty(s,homeJoinRequest(s)).ok).toBe(true);
  const next=[{x:13,y:7}];r.path=next;r.destination=next[0];release();advanceHomeActivity(s,1);
  expect(a.phase).toBe('cancelled');expect(r.path).toBe(next);expect(s.world!.homeResident!.mode).toBe('party');
});
it('dwell progress survives a target lease, danger and its release without granting combat eligibility',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;until(s,()=>s.world!.homeResident!.activity?.phase==='dwelling');
  const a=s.world!.homeResident!.activity!,left=a.remaining,release=holdHomeActivity(s,'ranger','dialogue');
  step(s,1);expect(a.remaining).toBe(left);release();s.context='explorationBattle';advanceHomeActivity(s,1);expect(a.phase).toBe('interrupted');expect(r.path).toEqual([]);
  s.context='explorationIdle';advanceHomeActivity(s,.05);expect(a.phase).toBe('dwelling');expect(a.remaining).toBe(left);expect(r.companionCombat?.actualBasicTargetId).toBeUndefined();
});
it('layout or missing owner invalidates the old task without following its stale coordinates',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;step(s,.05);const a=s.world!.homeResident!.activity!;
  s.exploration!.definition={...s.exploration!.definition,sceneLayout:structuredClone(s.exploration!.definition.sceneLayout!)};
  s.exploration!.definition.sceneLayout!.revision+='-new';advanceHomeActivity(s,.05);expect(a.phase).toBe('idle');expect(r.path).toEqual([]);expect(a.taskId).toBeUndefined();expect(a.reason).toBe('layout-or-object-invalid');
});
it('blocked routes wait and exhaust a finite retry budget rather than replanning every frame',()=>{
  const s=home();s.exploration!.definition={...s.exploration!.definition,sceneLayout:structuredClone(s.exploration!.definition.sceneLayout!)};
  const l=s.exploration!.definition.sceneLayout!,read=l.activities.find(a=>a.id==='read')!;
  const shelf=l.props.find(p=>p.id===read.ownerObject)!;shelf.base={x:read.approach.x-shelf.pos.x-.5,y:read.approach.y-shelf.pos.y-.5,width:1,height:1};
  for(let i=0;i<120;i++)step(s,.05);const a=s.world!.homeResident!.activity!;
  expect(a.history.filter(e=>e.kind==='blocked'&&e.task==='read')).toHaveLength(3);expect(a.planCount).toBeLessThan(8);expect(a.taskId).not.toBe('read');
});
it('solo travel stores and freezes the same wounded resident, then resumes without a teleport',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!,weapon=r.equipment!.equipped.right;step(s,.05);r.hp-=11;
  const a=s.world!.homeResident!.activity!,at={...r.pos},left=a.remaining,clock=a.clock;
  const travel=(index:number)=>{const w=s.world!,ticket:TravelTicket={id:index+1,worldId:w.id,placeId:w.visit.placeId,visit:w.visit.generation,actor:s.controlledBodyId!,control:s.controlRevision??0,edge:MAP_EDGES[index]};commitTravel(s,prepareTravel(s,ticket));};
  travel(0);expect(a.phase).toBe('interrupted');for(let i=0;i<100;i++)step(s,.05);expect(a.clock).toBe(clock);expect(a.remaining).toBe(left);expect(r.pos).toEqual(at);expect(s.world!.places[101].residents).toContain(r);
  travel(1);expect(s.units.filter(u=>u.id==='ranger')).toEqual([r]);expect(r.pos).toEqual(at);expect(r.hp).toBe(r.maxHp-11);expect(r.equipment!.equipped.right).toBe(weapon);step(s,.05);expect(a.phase).toBe('moving');
});
it('holds for another character do not interrupt the resident',()=>{
  const s=home();step(s,.05);const a=s.world!.homeResident!.activity!;holdHomeActivity(s,'merchant','dialogue');expect(a.phase).toBe('moving');expect(homeActivityDebug(s)?.animation).toBe('stand-placeholder');
});
it('a menu lease rejects joining without turning ordinary home movement into generic busy',()=>{
  const s=home();step(s,.05);expect(queryHomeJoin(s).ok).toBe(true);bindHomeJoinGuard(s,()=>true);expect(joinHomeParty(s,homeJoinRequest(s)).ok).toBe(false);bindHomeJoinGuard(s,()=>false);expect(joinHomeParty(s,{...homeJoinRequest(s),revision:-1}).ok).toBe(false);
  const a=s.world!.homeResident!.activity!,release=holdHomeActivity(s,'ranger','role-menu');
  expect(joinHomeParty(s,homeJoinRequest(s)).ok).toBe(false);expect(a.phase).toBe('interrupted');release();expect(joinHomeParty(s,homeJoinRequest(s)).ok).toBe(true);
});
it('a foreign movement owner is preserved and home work waits until that route is released',()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;step(s,.05);const route=[{x:15,y:5}];r.path=route;
  advanceHomeActivity(s,.05);expect(r.path).toBe(route);expect(s.world!.homeResident!.activity?.phase).toBe('interrupted');
  for(let i=0;i<100;i++)advanceHomeActivity(s,.05);expect(r.path).toBe(route);
});
it('removing the target object invalidates its task even when the layout revision is unchanged',()=>{
  const s=home();step(s,.05);const a=s.world!.homeResident!.activity!;
  s.exploration!.definition={...s.exploration!.definition,sceneLayout:structuredClone(s.exploration!.definition.sceneLayout!)};
  const l=s.exploration!.definition.sceneLayout!,anchor=l.activities.find(p=>p.id===a.anchorId)!;l.props=l.props.filter(p=>p.id!==anchor.ownerObject);
  advanceHomeActivity(s,.05);expect(a.phase).toBe('idle');expect(a.reason).toBe('layout-or-object-invalid');
});
it('a failed asynchronous front-door prepare releases travel priority and resumes the original task',async()=>{
  const s=home(),r=s.units.find(u=>u.id==='ranger')!;step(s,.05);const a=s.world!.homeResident!.activity!,task=a.taskId,pos={...r.pos};
  const {MapTravel}=await import('../src/core/map-travel');
  const travel=new MapTravel(()=>s,async()=>{expect(a.phase).toBe('interrupted');throw Error('fixture-resource-failure');},()=>{},()=>{});
  await travel.request(MAP_EDGES[0]);expect(travel.busy).toBe(false);expect(s.world!.visit.placeId).toBe(101);expect(r.pos).toEqual(pos);
  step(s,.05);expect(a.phase).toBe('moving');expect(a.taskId).toBe(task);expect(s.units.find(u=>u.id==='ranger')).toBe(r);
});
