import {test,expect} from 'vitest';
import {createExplorationEntry,command} from '../src/core/engine';
import {initializeWorldContainers} from '../src/core/world-containers';
import {merchantAccess} from '../src/core/item-commerce';
import {ensureShop} from '../src/core/merchant-shop';
import {roleAccess,roleProfile,roleSession,validRoleSession} from '../src/core/role-interaction';
import {surface} from '../src/core/spatial';

function setup(){const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});initializeWorldContainers(s);const n=s.units.find(u=>u.npc)!,u=s.units.find(u=>u.id===s.controlledBodyId)!,friend=s.units.find(u=>u.id==='ranger')!;u.pos={...n.pos};friend.pos={...n.pos};return {s,n,u,friend};}
test('companion has accessible independent empty shop, including after refresh',()=>{
 const {s,friend}=setup();expect(merchantAccess(s,friend.id)).toBe(true);
 expect(ensureShop(s,friend.id).stock).toEqual({});s.time+=301;
 expect(ensureShop(s,friend.id).stock).toEqual({});
});
test('self and distant or inactive companion cannot trade',()=>{
 const {s,u,friend}=setup();expect(merchantAccess(s,u.id)).toBe(false);
 friend.pos.x+=100;expect(merchantAccess(s,friend.id)).toBe(false);
 friend.pos={...u.pos};friend.life='dead';expect(merchantAccess(s,friend.id)).toBe(false);
});
test('roles exclude protagonist, clones and enemies; capabilities are distinct',()=>{
 const {s,n,u,friend}=setup();expect(roleProfile(s,u)).toBeUndefined();expect(roleProfile(s,n)?.actions).toEqual(['shop']);expect(roleProfile(s,friend)?.actions).toEqual(['shop','dialogue','gift','equipment']);friend.cloneOf='ranger';expect(roleProfile(s,friend)).toBeUndefined();delete friend.cloneOf;friend.team='enemy';expect(roleAccess(s,friend.id)).toBe(false);
});
test('session cannot survive control, visit or input ownership changes',()=>{
 const {s,n}=setup(),session=roleSession(s,n.id);expect(validRoleSession(s,session)).toBe(true);
 s.controlRevision=(s.controlRevision??0)+1;expect(validRoleSession(s,session)).toBe(false);s.controlRevision--;
 s.world!.visit.generation++;expect(validRoleSession(s,session)).toBe(false);s.world!.visit.generation--;
 s.inputEpoch=(s.inputEpoch??0)+1;expect(validRoleSession(s,session)).toBe(false);
});
test('role access respects same layer and walls rather than distance alone',()=>{
 const {s,u,n}=setup();n.pos={x:u.pos.x+1,y:u.pos.y};const tile=surface(s,n.pos)!;const layer=tile.layer;tile.layer=layer+1;expect(roleAccess(s,n.id)).toBe(false);tile.layer=layer;tile.obstacle=true;expect(roleAccess(s,n.id)).toBe(false);
});

test('combat disables companion access and invalidates its menu, then peace restores it',()=>{
 const {s,n,friend}=setup();s.context='explorationIdle';expect(roleAccess(s,friend.id)).toBe(true);const session=roleSession(s,friend.id);
 s.context='explorationBattle';expect(roleAccess(s,friend.id)).toBe(false);expect(validRoleSession(s,session)).toBe(false);expect(merchantAccess(s,friend.id)).toBe(false);expect(roleAccess(s,n.id)).toBe(true);
 s.context='explorationIdle';expect(roleAccess(s,friend.id)).toBe(true);
});
