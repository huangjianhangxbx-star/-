// AR06: retain these historical weapon/skill contracts on the Legacy branch.
vi.mock('../src/core/al-state',async importActual=>({...await importActual<object>(),isAlV2:()=>false}));
// AR05: this frozen historical suite verifies the retained pre-Blue branch.

vi.mock('../src/core/hunter-state',async importActual=>({...await importActual<object>(),isHunterV2:()=>false}));
import {vi,expect,test} from 'vitest';
import {createGame,command,step,resolveHit} from '../src/core/engine';
import type {Command,Unit} from '../src/core/types';
import {useCampfire} from '../src/core/campfire';
import {enterExploration,attackCommit} from '../src/core/exploration';
import {simulationDelta} from '../src/interaction';
import {tickEchoes} from '../src/core/skill-execution';
import {resolveSkill} from '../src/core/skill-catalog';
function setup(id='ines'){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id});command(s,{type:'carry',gold:0,vitality:0});s.units=s.units.filter(u=>u.team==='ally');
 const u=s.units.find(u=>u.id===id)!;command(s,{type:'controlBody',id});u.pos={x:5,y:5};u.drawPos={...u.pos};s.tiles=Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),layer:0,obstacle:false}));s.width=s.height=20;return {s,u};
}
const evade=(s:any,u:Unit,d={x:1,y:0})=>command(s,{type:'evade',id:u.id,direction:d} as Command);
const resource=(u:Unit)=>(u as any).evasion;
test.each(['ines','ranger','fiorre'])('%s has independent two charges and continuous 1.2U action',id=>{
 const {s,u}=setup(id);expect(resource(u)?.charges).toBe(2);expect(s.units[0].blink?.charges).toBe(10);expect(evade(s,u).ok).toBe(true);expect(u.pos.x).toBe(5);step(s,.09);expect(u.pos.x).toBeCloseTo(5.6);step(s,.09);expect(u.pos.x).toBeCloseTo(6.2);expect(resource(u).charges).toBe(1);expect(u.ai?.anchor).toEqual(u.pos);
});
test('active window rejects hit without health posture pain gray or reclaim effects',()=>{
 const {s,u}=setup();expect(evade(s,u).ok).toBe(true);const before=[u.hp,u.posture,u.grayHp,u.skillStates?.pain?.counter];expect(resolveHit(s,u,u.weapons[0],30,undefined,{postureDamage:99})).toBe(false);expect([u.hp,u.posture,u.grayHp,u.skillStates?.pain?.counter]).toEqual(before);expect(s.stats.activeEvades).toBe(1);step(s,.11);u.dodge=0;expect(resolveHit(s,u,u.weapons[0],30,undefined,{postureDamage:1})).toBe(true);
});
test('moving continues existing attack recovery and cancels unreleased pending',()=>{
 const {s,u}=setup();u.attackTimer=1;u.attackPending={targetId:'fake',remaining:.2,facing:'east'};expect(command(s,{type:'direct',id:u.id,direction:{x:1,y:0}}).ok).toBe(true);expect(u.attackPending).toBeUndefined();step(s,.2);expect(u.attackTimer).toBeCloseTo(.8);
});
test('sequential recharge, full cap, shadow freeze, campfire and new entry reset',()=>{
 const {s,u}=setup();evade(s,u);step(s,.18);evade(s,u);step(s,.18);expect(resource(u).charges).toBe(0);expect(evade(s,u).ok).toBe(false);step(s,2.64);expect(resource(u).charges).toBe(1);step(s,3);expect(resource(u)).toMatchObject({charges:2,progress:0});step(s,2);expect(resource(u).progress).toBe(0);
 evade(s,u);step(s,.2);u.life='withdrawn';u.shadowResident=true;const saved=resource(u).progress;step(s,4);expect(resource(u)).toMatchObject({charges:1,progress:saved});u.life='active';u.shadowResident=false;step(s,.1);expect(resource(u).progress).toBeCloseTo(saved+.1);
 u.hp=1;u.stress=50;expect(useCampfire(s,{id:'fire',pos:{...u.pos}} as any).ok).toBe(true);expect(resource(u)).toMatchObject({charges:2,progress:0});expect(u.hp).toBeGreaterThan(1);expect(u.stress).toBe(10);
 resource(u).charges=0;enterExploration(s,undefined as any,{...s.exploration!.definition,enemies:[]});expect(resource(u)?.charges).toBe(2);expect(s.units[0].evasion).toBeUndefined();
});
test.each(['posture','stagger','stun','skillTime','run','skillLanding','crossing','loadout','recall','partyTask','rescueTarget','downed','ready'])('rejects %s without spending',key=>{
 const {s,u}=setup();if(key==='posture')u.posture=0;else if(key==='stun')u.statuses.push({kind:'stun',remaining:1,power:0});else if(key==='downed')u.life='downed';else if(key==='run')u.skillStates![u.skillId!]!.run={} as any;else (u as any)[key]=['stagger','skillTime','ready'].includes(key)?1:{};
 expect(evade(s,u).ok).toBe(false);expect(resource(u).charges).toBe(2);
});
test.each([{x:0,y:0},{x:NaN,y:0},{x:Infinity,y:0}])('invalid direction rejects %j',d=>{const {s,u}=setup();expect(evade(s,u,d).ok).toBe(false);expect(resource(u).charges).toBe(2);});
test('solid wall shortens, immediate wall rejects, no cross-height',()=>{
 const {s,u}=setup();s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;expect(evade(s,u).ok).toBe(true);step(s,.18);expect(u.pos.x).toBeLessThan(5.5);expect(u.pos.x).toBeGreaterThan(5);expect(evade(s,u).ok).toBe(false);expect(resource(u).charges).toBe(1);
 const b=setup();b.s.tiles.find(t=>t.x===6&&t.y===5)!.layer=1;expect(evade(b.s,b.u).ok).toBe(true);step(b.s,.18);expect(b.u.pos.x).toBeLessThan(5.5);
});
test('friendly original pass, enemy collision and moving obstacle stop',()=>{
 const {s,u}=setup();const h=s.units[0];h.pos={x:5.6,y:5};expect(evade(s,u).ok).toBe(true);step(s,.18);expect(u.pos.x).toBeCloseTo(6.2);
 const b=setup(),e={...structuredClone(b.u),id:'enemy',team:'enemy' as const,pos:{x:5.9,y:5},attackTimer:10};b.s.units.push(e);expect(evade(b.s,b.u).ok).toBe(true);step(b.s,.18);expect(b.u.pos.x).toBeLessThan(5.7);
 const c=setup();evade(c.s,c.u);c.s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;step(c.s,.18);expect(c.u.pos.x).toBeLessThan(5.5);
});
test('action denies ordinary inputs and preserves direction across switch; no timer refund',()=>{
 const {s,u}=setup();u.attackTimer=.8;u.attackPending={targetId:'fake',remaining:.1,facing:'east'};expect(evade(s,u).ok).toBe(true);expect(u.attackPending).toBeUndefined();expect(u.attackTimer).toBe(.8);expect(evade(s,u).ok).toBe(false);
 for(const c of [{type:'move',to:{x:8,y:5}},{type:'direct',direction:{x:0,y:1}},{type:'skill'},{type:'weapon',index:1},{type:'extract',via:'shadow'},{type:'collect'}])expect(command(s,{...c,id:u.id} as Command).ok).toBe(false);
 expect(command(s,{type:'party',kind:'regroup'}).ok).toBe(false);command(s,{type:'controlBody',id:'hunter'});step(s,.09);expect(u.pos.x).toBeCloseTo(5.6);expect(u.pos.y).toBe(5);step(s,.09);expect(u.ai?.anchor?.x).toBeCloseTo(6.2);expect(u.attackTimer).toBeCloseTo(.62);
});
test('mode and ownership eligibility, no clone resources or AI auto evade',()=>{
 const {s,u}=setup();command(s,{type:'controlBody',id:'hunter'});expect(evade(s,u).ok).toBe(false);expect(evade(s,s.units[0]).ok).toBe(false);step(s,1);expect(resource(u).charges).toBe(2);const tower=createGame();expect(tower.units.every(u=>!u.evasion)).toBe(true);expect(evade(tower,tower.units[1]).ok).toBe(false);
 s.exploration!.definition={...s.exploration!.definition,kind:undefined};command(s,{type:'controlBody',id:u.id});expect(evade(s,u).ok).toBe(false);
});
test('active evade does not feed attacker reclaim or passive dodge statistics',()=>{
 const {s,u}=setup();const e={...structuredClone(u),id:'enemy',team:'enemy' as const,hp:20,grayHp:20};evade(s,u);expect(resolveHit(s,u,e.weapons[0],30,e,{reclaimRate:1,postureDamage:20})).toBe(false);expect(e.hp).toBe(20);expect(e.grayHp).toBe(20);expect(s.stats.dodges||0).toBe(0);expect(s.combatEvents?.length||0).toBe(0);
});
test('actual ranged windup releases once then immediate movement without faster next shot',()=>{
 const {s,u}=setup('ranger');const e={...structuredClone(s.units[0]),id:'target',team:'enemy' as const,role:'melee' as const,pos:{x:6,y:5},drawPos:{x:6,y:5},hp:10000,maxHp:10000,damage:0,attackTimer:100,ready:100,blink:undefined};s.units.push(e);s.units[0].life='withdrawn';attackCommit(s,e,u);u.facing='east';expect(command(s,{type:'basic',id:u.id,aim:e.pos,requestId:1}).ok).toBe(true);expect(u.attackPending?.remaining).toBe(.25);const period=u.attackTimer;step(s,.20);expect(s.stats.basicAttacksReleased||0).toBe(0);step(s,.051);expect(s.stats.basicAttacksReleased).toBe(1);const hp=e.hp;command(s,{type:'direct',id:u.id,direction:{x:0,y:1}});step(s,.1);expect(u.pos.y).toBeGreaterThan(5);expect(e.hp).toBe(hp);command(s,{type:'direct',id:u.id,direction:null});step(s,Math.max(0,period-.45));expect(s.stats.basicAttacksReleased).toBe(1);step(s,.5);expect(s.stats.basicAttacksReleased).toBe(1);expect(command(s,{type:'basic',id:u.id,aim:e.pos,requestId:2}).ok).toBe(true);step(s,.3);expect(s.stats.basicAttacksReleased).toBe(2);
});
test.each(['dead','range','wall','behind','facing'])('release rejects target %s without refund',kind=>{
 const {s,u}=setup('ranger'),e={...structuredClone(s.units[0]),id:'target',team:'enemy' as const,role:'melee' as const,pos:{x:6,y:5},hp:1000,maxHp:1000,ready:100,attackTimer:100};s.units.push(e);s.units[0].life='withdrawn';attackCommit(s,e,u);u.facing='east';expect(command(s,{type:'basic',id:u.id,aim:e.pos,requestId:1}).ok).toBe(true);expect(u.attackPending).toBeDefined();
 if(kind==='dead')e.life='dead';if(kind==='range')e.pos.x=15;if(kind==='wall')s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;if(kind==='behind')e.pos.x=4;if(kind==='facing')u.facing='west';step(s,.251);expect(s.stats.basicAttacksReleased||0).toBe(0);expect(u.attackTimer).toBeGreaterThan(0);
});
test('blocked action cannot bypass minimum reuse interval',()=>{
 const {s,u}=setup();evade(s,u);s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;step(s,.05);expect(evade(s,u,{x:-1,y:0}).ok).toBe(false);step(s,.13);expect(evade(s,u,{x:-1,y:0}).ok).toBe(true);
});
test.each([{pause:true,hidden:false,slow:false,speed:1,seconds:0},{pause:false,hidden:true,slow:false,speed:1,seconds:0},{pause:false,hidden:false,slow:true,speed:1,seconds:.1},{pause:false,hidden:false,slow:false,speed:2,seconds:2}])('simulation clock controls refill %j',c=>{
 const {s,u}=setup();resource(u).charges=0;for(let i=0;i<20;i++)step(s,simulationDelta(.05,c.pause,c.hidden,c.slow,c.speed));expect(resource(u).progress).toBeCloseTo(c.seconds);
});
test('WASD and evade record cancellations, no phantom attack release',()=>{
 const {s,u}=setup();u.attackPending={targetId:'fake',remaining:.1,facing:'east'};u.attackTimer=1;command(s,{type:'direct',id:u.id,direction:{x:1,y:0}});expect(s.stats.windupsCancelledByMove).toBe(1);u.attackPending={targetId:'fake',remaining:.1,facing:'east'};evade(s,u);expect(s.stats.windupsCancelledByEvade).toBe(1);expect(u.attackTimer).toBe(1);step(s,.2);expect(s.stats.basicAttacksReleased||0).toBe(0);
});
test('stun after the miss window stops action before any further displacement',()=>{
 const {s,u}=setup();evade(s,u);step(s,.11);const pos={...u.pos};u.statuses.push({kind:'stun',remaining:1,power:0});step(s,.05);expect(u.pos).toEqual(pos);expect(resource(u).action).toBeUndefined();
});
test('next exploration excludes former companion evade resource',()=>{
 const {s,u}=setup();s.explorationCompanionId='ranger';enterExploration(s,undefined as any,{...s.exploration!.definition,enemies:[]});expect(u.evasion).toBeUndefined();expect(s.units.find(a=>a.id==='ranger')?.evasion?.charges).toBe(2);
});
test('mobility card cannot interrupt evade or be consumed, remains usable afterwards',()=>{
 const {s,u}=setup();const c=s.cards.find(c=>c.kind==='dash')!;expect(c).toBeDefined();evade(s,u);expect(command(s,{type:'card',cardId:c.id,to:u.pos,targetId:u.id,direction:'south'}).ok).toBe(false);expect(s.cards).toContain(c);step(s,.18);expect(command(s,{type:'card',cardId:c.id,to:u.pos,targetId:u.id,direction:'south'}).ok).toBe(true);
});
test('passive dodge remains independent after active window, on-hit slow cannot leak through miss',()=>{
 const {s,u}=setup(),e={...structuredClone(u),id:'enemy',team:'enemy' as const,pos:{x:u.pos.x+2,y:u.pos.y}};s.units.push(e);expect(evade(s,u).ok).toBe(true);s.skillEffects=[{id:100,castId:100,sourceId:e.id,skillId:'reap',at:s.time,expires:s.time+1,kind:'seat',detached:true,center:{...u.pos},heading:0,spec:resolveSkill(u),power:30,maxHp:e.maxHp,weapon:e.weapons[0],hits:[]}];tickEchoes(s,{hit:resolveHit});expect(u.statuses.some(t=>t.kind==='slow')).toBe(false);expect(s.stats.activeEvades).toBe(1);
 s.units=s.units.filter(a=>a!==e);step(s,.18);u.dodge=1;u.capacity=1000;expect(resolveHit(s,u,u.weapons[0],30)).toBe(false);expect(s.stats.dodges).toBe(1);expect(s.stats.activeEvades).toBe(1);
});
