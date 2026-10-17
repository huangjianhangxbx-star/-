import {joinHomeParty,homeJoinRequest} from '../src/core/home-resident';
import {it,expect} from 'vitest';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {initializeMapWorld,prepareTravel,commitTravel,type TravelTicket} from '../src/core/map-travel';
import {MAP_EDGES} from '../src/core/map-definitions';
import {activeEncounters,autonomousTargetAllowed} from '../src/core/encounter-domain';
import {tacticalTargets,advanceCompanionCombat} from '../src/core/companion-combat';
function fixture(control='hunter'){
 const s=createExplorationEntry();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration',seed:18});command(s,{type:'carry',gold:0,vitality:0});initializeMapWorld(s);joinHomeParty(s,homeJoinRequest(s));
 const w=s.world!,t:TravelTicket={id:1,worldId:w.id,placeId:101,visit:w.visit.generation,actor:s.controlledBodyId!,control:s.controlRevision??0,edge:MAP_EDGES[0]};commitTravel(s,prepareTravel(s,t));
 command(s,{type:'controlBody',id:control});const h=s.units.find(u=>u.id==='hunter')!,r=s.units.find(u=>u.id==='ranger')!,e=s.units.find(u=>u.team==='enemy')!;
 h.pos={x:8,y:8};r.pos={x:8,y:9};e.pos={x:9.3,y:8.5};for(const u of [h,r,e]){u.drawPos={...u.pos};u.path=[];u.destination=null;u.ready=0;}s.context='explorationBattle';e.enemyV2!.brain!.known={...h.pos};e.pursuitTargetId=control;return {s,h,r,e};
}
it('map opponents provide live encounter targets without waking unrelated map enemies',()=>{const {s,r,e}=fixture();advanceCompanionCombat(s);expect(activeEncounters(s).length).toBeGreaterThan(0);expect(tacticalTargets(s).map(u=>u.id)).toEqual([e.id]);expect(autonomousTargetAllowed(s,r,e)).toBe(true);expect(r.companionCombat?.targetId).toBe(e.id);});
for(const control of ['hunter','ranger'])it(`off-control native body attacks with ${control} controlled`,()=>{const {s,e}=fixture(control),other=s.units.find(u=>u.id===(control==='hunter'?'ranger':'hunter'))!;let attacked=false;for(let i=0;i<400;i++){step(s,.025);if(other.basicAction||other.companionCombat?.actualBasicTargetId)attacked=true;}expect(attacked).toBe(true);expect(e.hp).toBeLessThan(e.maxHp);});
it('an engaged migrated enemy remains a target in safe home without native encounter definitions',()=>{const {s,r,e}=fixture();s.world!.visit.placeId=101;s.exploration!.definition=s.world!.places[101].definition;e.mapOwnerInstance=s.world!.id+':101';s.units=s.units.filter(u=>u.team!=='enemy'||u===e);advanceCompanionCombat(s);expect(tacticalTargets(s)).toContain(e);expect(r.companionCombat?.targetId).toBe(e.id);e.life='dead';expect(activeEncounters(s)).toEqual([]);});

it('engaged home pursuer and companion route around the table and exchange real damage',()=>{const {s,h,r,e}=fixture();s.world!.visit.placeId=101;s.exploration!.definition=s.world!.places[101].definition;s.tiles=s.exploration!.definition.tiles.map(t=>({...t}));e.mapOwnerInstance=s.world!.id+':101';s.units=s.units.filter(u=>u.team!=='enemy'||u===e);h.pos={x:9.8,y:8};r.pos={x:5.5,y:8};e.pos={x:5,y:8};e.enemyV2!.brain!.known={...h.pos};for(const u of [h,r,e]){u.drawPos={...u.pos};u.path=[];u.destination=null;u.hp=u.maxHp;}const initial=e.hp;let reachedRight=false;for(let i=0;i<600;i++){step(s,.025);if(e.pos.x>8.7||r.pos.x>8.7)reachedRight=true;for(const u of [r,e])expect(u.pos.x>6.5&&u.pos.x<8.5&&u.pos.y>7.45&&u.pos.y<8.1).toBe(false);}expect(reachedRight).toBe(true);expect(e.hp).toBeLessThan(initial);});
