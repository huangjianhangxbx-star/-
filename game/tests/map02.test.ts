import {joinHomeParty,homeJoinRequest} from '../src/core/home-resident';
import {describe,it,expect} from 'vitest';
import {createExplorationEntry,command} from '../src/core/engine';
import {initializeMapWorld,prepareTravel,commitTravel,mapRemaining,syncMapDeaths,MapTravel,type TravelTicket} from '../src/core/map-travel';
import {MAP_EDGES} from '../src/core/map-definitions';
import {ensureChallengeRun,resolveMap,mapEdges} from '../src/core/map-runs';
import {capturePursuers,tickPursuers} from '../src/core/enemy-map-transfer';
const start=()=>{const s=createExplorationEntry();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration',seed:18});command(s,{type:'carry',gold:0,vitality:0});initializeMapWorld(s);joinHomeParty(s,homeJoinRequest(s));return s;};
function go(s:ReturnType<typeof start>,edge=MAP_EDGES[0]){const w=s.world!,t:TravelTicket={id:1,worldId:w.id,placeId:w.visit.placeId,visit:w.visit.generation,actor:s.controlledBodyId!,control:s.controlRevision??0,edge};commitTravel(s,prepareTravel(s,t));}
describe('MAP-02 purposes and run identity',()=>{
 it('unvisited generated floors retain the native initial cooldown until their first activation',()=>{const s=start();go(s);const run=ensureChallengeRun(s,321),entry=mapEdges(s).find(e=>e.challengeEntry)!;go(s,{...entry,target:run.floors[0],spawn:'entry'});s.units.filter(u=>u.team==='enemy').forEach(u=>u.life='dead');syncMapDeaths(s);s.time=100;go(s,mapEdges(s)[0]);expect(s.units.filter(u=>u.team==='enemy').every(u=>u.enemyV2!.readyAt>=102.5)).toBe(true);});
 it('a target first-frame validation failure cannot commit ownership or discard source items',async()=>{const s=start(),units=s.units,w=s.world;const travel=new MapTravel(()=>s,async()=>{},()=>{},()=>{},async(stage)=>{if(stage==='first-frame')throw Error('target frame rejected');});await travel.request(MAP_EDGES[0]);expect(s.world!.visit.placeId).toBe(101);expect(s.units).toBe(units);expect(s.world).toBe(w);expect(travel.busy).toBe(false);});
 it('diagnostic preparation failure releases its own lock and preserves source before retry',async()=>{const s=start(),w=s.world,items=w!.backpack!.inventory!.items,stages:string[]=[];const travel=new MapTravel(()=>s,async()=>{},()=>{},()=>{},async(stage)=>{stages.push(stage);});travel.failNextPrepare=true;await travel.request(MAP_EDGES[0]);expect(s.world!.visit.placeId).toBe(101);expect(travel.error).toContain('诊断');expect(travel.busy).toBe(false);expect(s.world).toBe(w);expect(w!.backpack!.inventory!.items).toBe(items);await travel.request(MAP_EDGES[0]);expect(s.world!.visit.placeId).toBe(102);expect(stages).toContain('first-frame');expect(stages.at(-1)).toBe('fade-in');});
 it('neutral enemies do not lock the home door and safe does not erase incoming enemies',()=>{const s=start();go(s);expect(mapRemaining(s)).toBe(3);go(s,MAP_EDGES[1]);expect(s.world!.visit.placeId).toBe(101);expect(resolveMap(s,101)?.purpose).toBe('safe');});
 it('generates once with deterministic five distinct counts, unique floor identity, and blocks unready progress',()=>{
  const s=start();go(s);const run=ensureChallengeRun(s,321),again=ensureChallengeRun(s,999);
  expect(again).toBe(run);expect([...run.counts].sort()).toEqual([2,3,4,5,6]);expect(new Set(run.floors).size).toBe(5);
  const s2=start();go(s2);const same=ensureChallengeRun(s2,321);expect(same.counts).toEqual(run.counts);
  const edge=mapEdges(s).find(e=>e.challengeEntry)!;go(s,{...edge,target:run.floors[0],spawn:'entry'});
  const first=s.world!.places[run.floors[0]];first.mapRoster!.ready=false;expect(mapRemaining(s)).toBeGreaterThan(0);expect(()=>go(s,mapEdges(s)[0])).toThrow();
  first.mapRoster!.ready=true;
  for(let i=0;i<5;i++){expect(resolveMap(s)?.floorIndex).toBe(i+1);const enemies=s.units.filter(u=>u.team==='enemy');expect(enemies).toHaveLength(run.counts[i]);enemies.forEach(u=>u.life='dead');syncMapDeaths(s);expect(mapRemaining(s)).toBe(0);go(s,mapEdges(s)[0]);}
  expect(s.world!.visit.placeId).toBe(102);expect(run.status).toBe('completed');expect(s.units.find(u=>u.id===s.controlledBodyId)!.pos).toEqual({x:19,y:12});
  const next=ensureChallengeRun(s,322);expect(next.id).not.toBe(run.id);expect(next.floors.some(id=>run.floors.includes(id))).toBe(false);expect(s.world!.places[run.floors[0]]).toBe(first);
 });
});
describe('MAP-02 bounded pursuit ownership',()=>{
 it('moves the same injured enemy along a path in game time, waits for resources, and transfers once',()=>{
  const s=start();go(s);const e=s.units.find(u=>u.team==='enemy')!,actor=s.units.find(u=>u.id===s.controlledBodyId)!;actor.pos={x:1,y:8};e.pos={x:4,y:8};e.hp=37;e.pursuitTargetId=actor.id;e.enemyV2!.brain!.known={id:actor.id,point:{...actor.pos},at:s.time};
  const captured=capturePursuers(s,MAP_EDGES[1]);expect(captured).toHaveLength(1);go(s,MAP_EDGES[1]);
  const before={...e.pos},visit=s.world!.visit.generation;tickPursuers(s,0,()=>false);expect(e.pos).toEqual(before);
  for(let i=0;i<100;i++){s.time+=.1;tickPursuers(s,.1,()=>false);}expect(s.units).not.toContain(e);expect(s.world!.places[102].unloadedEnemies).toContain(e);
  tickPursuers(s,.1,()=>true);expect(s.units).toContain(e);expect(e.hp).toBe(37);expect(s.world!.places[102].unloadedEnemies).not.toContain(e);expect(s.world!.visit.generation).toBe(visit);
  tickPursuers(s,.1,()=>true);expect(s.units.filter(u=>u.id===e.id)).toHaveLength(1);expect(e.mapOriginInstance).toContain('102');expect(e.mapOwnerInstance).toContain('101');
 });
 it('hands a pending path back to normal AI if its source becomes active again',()=>{
  const s=start();go(s);const e=s.units.find(u=>u.team==='enemy')!,a=s.units.find(u=>u.id===s.controlledBodyId)!;a.pos={x:1,y:8};e.pos={x:6,y:8};e.pursuitTargetId=a.id;e.enemyV2!.brain!.known={id:a.id,point:a.pos,at:s.time};capturePursuers(s,MAP_EDGES[1]);go(s,MAP_EDGES[1]);go(s);const before={...e.pos};tickPursuers(s,1,()=>true);expect(e.pos).toEqual(before);expect(s.units.filter(u=>u.id===e.id)).toHaveLength(1);
 });
});
