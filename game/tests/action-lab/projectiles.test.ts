import {describe,expect,it} from 'vitest';
import {ProjectileRuntime,type ProjectileSpec} from '../../src/action-lab/runtime/projectiles';

const spec=():ProjectileSpec=>({id:1,generation:1,ownerId:'ranged-1',sourceActionId:2,rootActionId:2,
  position:{x:0,y:0},velocity:{x:10,y:0},radius:.1,damage:3,spawnedAt:0,expiresAt:2,ownerDeath:'retain'});
describe('AL03 independent projectile mechanics (fixture values, not enemy tuning)',()=>{
  it('advances by supplied simulation time and reports true swept contact on a long step',()=>{
    const r=new ProjectileRuntime();r.spawn(spec());
    const contacts=r.advance(1,1,[{id:'blue',position:{x:5,y:0},radius:.25}]);
    expect(contacts).toHaveLength(1);expect(contacts[0].targetId).toBe('blue');
    expect(contacts[0].projectile.position.x).toBeCloseTo(10);
  });
  it('a displaced target really misses, without manufacturing invulnerability',()=>{
    const r=new ProjectileRuntime();r.spawn(spec());
    expect(r.advance(1,1,[{id:'blue',position:{x:5,y:1},radius:.25}])).toEqual([]);
  });
  it('zero simulation time freezes motion and each target is contacted once',()=>{
    const r=new ProjectileRuntime();r.spawn({...spec(),velocity:{x:0,y:0}});
    const t=[{id:'blue',position:{x:0,y:0},radius:.25}];
    expect(r.advance(0,1,t)).toEqual([]);expect(r.entities[0].position.x).toBe(0);
    expect(r.advance(.1,1,t)).toHaveLength(1);expect(r.advance(.2,1,t)).toEqual([]);
  });
  it('generation and expiry prohibit stale contact',()=>{
    const r=new ProjectileRuntime();r.spawn(spec());expect(r.advance(.1,2,[])).toEqual([]);expect(r.entities).toHaveLength(0);
    r.spawn(spec());expect(r.advance(3,1,[])).toEqual([]);expect(r.entities).toHaveLength(0);
  });
  it('a frame crossing expiry still resolves contacts before expiry, never beyond it',()=>{
    const r=new ProjectileRuntime();r.spawn({...spec(),expiresAt:.6});
    const contacts=r.advance(1,1,[{id:'near',position:{x:5,y:0},radius:.25},{id:'past-expiry',position:{x:8,y:0},radius:.25}]);
    expect(contacts.map(c=>c.targetId)).toEqual(['near']);expect(r.entities).toHaveLength(0);
  });
  it('owner death is an explicit per-entity policy',()=>{
    const r=new ProjectileRuntime();r.spawn(spec());r.spawn({...spec(),id:3,ownerDeath:'end'});
    r.ownerDied('ranged-1');expect(r.entities.map(p=>p.id)).toEqual([1]);
  });
  it('never mutates the caller snapshot and never hits its owner',()=>{
    const r=new ProjectileRuntime(),s=spec();r.spawn(s);
    expect(r.advance(.1,1,[{id:s.ownerId,position:{x:1,y:0},radius:.25}])).toEqual([]);
    expect(s.position.x).toBe(0);r.reset();expect(r.entities).toHaveLength(0);
  });
});
