import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {command,step,canHit} from '../src/core/engine';
import {clearShot,inWeaponRange,terrainHeight,SPACE} from '../src/core/spatial';
import {areaHits} from '../src/core/attack-area';
import {profile} from './en01-fixture';
import {requestEnemyAction,advanceEnemyAction} from '../src/core/enemy-action';
import {commitEnemyRelease,advanceEnemyEntities} from '../src/core/enemy-attack-entity';
import {ARCHER,registerEnemy} from '../src/core/enemy-profiles';

// Explicit synthetic height/obstacle fixtures, never presented as ordinary map travel.
function fixture(actor:'hunter'|'ranger',heights:[number,number],range:number,wall=false){
 const {s,h,al,e}=setup(),u=actor==='hunter'?h:al,other=actor==='hunter'?al:h;
 u.pos={x:10,y:10};u.drawPos={...u.pos};other.pos={x:3,y:3};other.drawPos={...other.pos};
 e.pos={x:10+range,y:10};e.drawPos={...e.pos};e.ready=999;e.hp=e.maxHp=10000;e.posture=e.maxPosture=10000;e.statuses=[{kind:'stun',remaining:100,power:0}];
 s.tiles.find(t=>t.x===10&&t.y===10)!.layer=heights[0];s.tiles.find(t=>t.x===Math.round(e.pos.x)&&t.y===10)!.layer=heights[1];
 if(wall)s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;
 command(s,{type:'controlBody',id:u.id});return {s,u,e};
}
for(const heights of [[1,0],[0,1],[0,0]] as [number,number][])test(`enemy committed transport crosses height ${heights} and retains wall blocking`,()=>{
 for(const wall of [false,true]){const {s,h,al,e}=setup();al.pos={x:3,y:3};e.pos={x:10,y:10};h.pos={x:13,y:10};s.tiles.find(t=>t.x===10&&t.y===10)!.layer=heights[0];s.tiles.find(t=>t.x===13&&t.y===10)!.layer=heights[1];
  e.heading=0;expect(requestEnemyAction(s,e,{...profile,kind:'transport',range:5},h).ok).toBe(true);s.time=.6;commitEnemyRelease(s,advanceEnemyAction(s,e)[0]);if(wall)s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;
  const contacts:string[]=[];for(let i=1;i<=125;i++){s.time=.6+i*.01;advanceEnemyEntities(s,(_e,t)=>{contacts.push(t.id);return {accepted:true,hpLost:5};});}expect(contacts.includes(h.id)).toBe(!wall);
 }
});
for(const heights of [[0,0],[1,0],[0,1]] as [number,number][]){
 test(`Al released bullet height ${heights} obeys range and actual wall`,()=>{
  for(const [range,wall,hit] of [[3,false,true],[3,true,false],[8,false,false]] as const){const {s,u,e}=fixture('ranger',heights,range,wall);expect(command(s,{type:'alInput',id:u.id,kind:'shot',aim:e.pos}).ok).toBe(true);command(s,{type:'alInput',id:u.id,kind:'shot',held:false});for(let n=0;n<80;n++)step(s,.01);expect(e.hp<10000).toBe(hit);expect(u.alCombat!.trace.filter(r=>r.kind==='ammo-payment')).toHaveLength(1);}
 });
 for(const actor of ['hunter','ranger'] as const)test(`${actor} native first Basic height ${heights} has no height range bonus`,()=>{
  for(const [range,wall,hit] of [[1.6,false,true],[1.6,true,false],[5,false,false]] as const){const {s,u,e}=fixture(actor,heights,range,wall);const type=actor==='hunter'?'hunterInput':'alInput';expect(command(s,{type,id:u.id,kind:'basic',aim:e.pos} as any).ok).toBe(true);command(s,{type,id:u.id,kind:'basic',held:false} as any);for(let n=0;n<20;n++)step(s,.01);expect(e.hp<10000).toBe(hit);}
 });
}
test('legacy template range stays declared, physical height is symmetric and transitions reject pending template attack',()=>{
 const {s,u,e}=fixture('hunter',[1,0],3);expect(terrainHeight(s,u.pos)).toBe(SPACE.layerHeight);expect(clearShot(s,u.pos,e.pos)).toBe(clearShot(s,e.pos,u.pos));
 for(const remote of [true,false]){expect(inWeaponRange(s,u,e.pos,{range:3,remote})).toBe(remote);expect(inWeaponRange(s,u,{x:14,y:10},{range:3,remote})).toBe(false);}
 u.crossing={from:{...u.pos},to:{x:11,y:10},elapsed:.1,switched:false};expect(canHit(s,u,e)).toBe(false);
});
test('native area geometry rejects angular miss and thin wall corners independently of immunity',()=>{
 const {s,u,e}=fixture('hunter',[0,0],1.6);const area={kind:'sector' as const,origin:{...u.pos},heading:0,range:3,arc:1};
 e.pos={x:12,y:10};expect(areaHits(s,area,e)).toBe(true);e.pos={x:10,y:12};expect(areaHits(s,area,e)).toBe(false);s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;
 e.pos={x:12,y:10};expect(areaHits(s,area,e)).toBe(false);expect(clearShot(s,{x:10,y:10.49},{x:12,y:10.51})).toBe(false);
});
test.each([[1,0],[0,1]])('real ARCHER three-child transport preserves physical height path %s',(...values)=>{
 const [sourceLayer,targetLayer]=values as number[];const {s,h,al,e}=setup();al.pos={x:3,y:3};e.pos={x:10,y:10};e.heading=0;h.pos={x:15,y:10};
 s.tiles.forEach(t=>t.layer=t.x<12?sourceLayer:targetLayer);registerEnemy(s,e,ARCHER);e.enemyV2!.readyAt=0;
 expect(requestEnemyAction(s,e,ARCHER,h).ok).toBe(true);s.time=.6333;advanceEnemyAction(s,e).forEach(r=>commitEnemyRelease(s,r));expect(s.enemyRuntime!.entities).toHaveLength(3);
 const destinations=s.enemyRuntime!.entities.map(e=>({...e.to}));expect(destinations.every(p=>Math.hypot(p.x-h.pos.x,p.y-h.pos.y)<=2)).toBe(true);
 for(let i=1;i<=115;i++){s.time=.6333+i*.01;advanceEnemyEntities(s,()=>({accepted:true,hpLost:3}));}
 expect(e.enemyV2!.trace.filter(r=>r.kind==='land')).toHaveLength(3);expect(e.enemyV2!.trace.filter(r=>r.kind==='blocked'&&r.reason==='wall')).toHaveLength(0);
});
