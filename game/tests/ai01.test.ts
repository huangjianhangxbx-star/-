import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {command,step} from '../src/core/engine';
import {maintainPartyTactics,bodyPending} from '../src/core/party-tactics';
import {distance,segmentClear} from '../src/core/spatial';
const issue=(s:any,leader:any,recipient:any,kind='rally',requestId=1)=>command(s,{type:'partyTactic',issuerId:leader.id,recipientId:recipient.id,kind,requestId,expectedControlRevision:s.controlRevision??0} as any);
function fixture(){const {s,h,al}=setup();s.units=[h,al];h.pos={x:18,y:10};al.pos={x:10,y:10};for(const u of s.units){u.drawPos={...u.pos};u.ai=undefined;u.path=[];u.ready=0;}return {s,h,al};}

test.each(['hunter','ranger'] as const)('native %s post-Hit Basic stays pending-body without spending rally budget',id=>{
 const {s,h,al}=fixture(),u=id==='hunter'?h:al,leader=u===h?al:h;command(s,{type:'controlBody',id});
 const type=id==='hunter'?'hunterInput':'alInput';expect(command(s,{type,id,kind:'basic',aim:{x:u.pos.x+3,y:u.pos.y}} as any).ok).toBe(true);command(s,{type,id,kind:'basic',held:false} as any);step(s,.06);
 expect(u.basicAction?.released).toBe(true);expect(u.basicAction?.moveReady).toBe(false);expect(u.attackPending).toBeUndefined();const action=u.basicAction;
 command(s,{type:'controlBody',id:leader.id});expect(issue(s,leader,u).ok).toBe(true);expect(bodyPending(u)).toBe(true);s.time+=.1;maintainPartyTactics(s);
 expect(s.partyTactics![u.id].execution).toBe('pending-body');expect(s.partyTactics![u.id].budget).toBe(0);expect(u.basicAction).toBe(action);
});
test('native Al paid shooting action waits without paying again or burning rally budget',()=>{
 const {s,h,al}=fixture();command(s,{type:'controlBody',id:al.id});command(s,{type:'alInput',id:al.id,kind:'shot',aim:{x:15,y:10}});command(s,{type:'alInput',id:al.id,kind:'shot',held:false});step(s,.05);
 const action=al.alCombat!.special;expect(action?.paid).toBe(true);command(s,{type:'controlBody',id:h.id});issue(s,h,al);expect(s.partyTactics![al.id].execution).toBe('pending-body');
 for(let i=0;i<20;i++)step(s,.01);expect(s.partyTactics![al.id].budget).toBe(0);expect(al.alCombat!.special).toBe(action);expect(al.alCombat!.ammo).toBe(3);
 for(let i=0;i<40;i++)step(s,.01);expect(s.partyTactics![al.id].execution).toBe('active');expect(al.alCombat!.trace.filter(r=>r.kind==='ammo-payment')).toHaveLength(1);
});
test.each(['hunter','ranger'] as const)('native %s rally takes a real route around obstruction and tracks moving leader',id=>{
 const {s,h,al}=fixture(),u=id==='hunter'?h:al,leader=u===h?al:h;
 if(u===h){u.pos={x:10,y:10};leader.pos={x:18,y:10};}command(s,{type:'controlBody',id:leader.id});s.tiles.filter(t=>t.x===13&&t.y>=7&&t.y<=13).forEach(t=>t.obstacle=true);
 expect(issue(s,leader,u).ok).toBe(true);let last={...u.pos},detour=false;
 for(let n=0;n<175;n++){if(n===35)command(s,{type:'direct',id:leader.id,direction:{x:0,y:1}});if(n===45)command(s,{type:'direct',id:leader.id,direction:null});step(s,.04);expect(distance(last,u.pos)).toBeLessThan(.4);expect(segmentClear(s,last,u.pos,false,false,u.bodyRadius)).toBe(true);if(Math.abs(u.pos.y-10)>3.4)detour=true;last={...u.pos};}
 expect(detour).toBe(true);expect(distance(u.pos,leader.pos)).toBeLessThan(2.1);expect(s.partyTactics![u.id]).toBeUndefined();expect(s.log.some(t=>t.includes('已到达'))).toBe(true);
});
test('unreachable rally exposes blocked reason, then free cancels its route without changing leader',()=>{
 const {s,h,al}=fixture();s.tiles.filter(t=>t.x===13).forEach(t=>t.obstacle=true);issue(s,h,al);step(s,.05);expect(s.partyTactics![al.id].execution).toBe('blocked');expect(s.partyTactics![al.id].reason).toContain('没有安全');expect(al.path).toEqual([]);
 issue(s,h,al,'free',2);expect(s.partyTactics![al.id]).toBeUndefined();expect(s.controlledBodyId).toBe(h.id);
});
