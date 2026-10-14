import {test,expect} from 'vitest';
test('ground batching preserves source density and world coordinates in three draws',async()=>{
 const mod=await import('../src/view/scene2d/ground-batch').catch(()=>undefined);expect(mod).toBeDefined();
 const batches=mod!.groundBatches(400/341,'mixed');expect(batches).toHaveLength(3);
 const count=batches.reduce((n,b)=>n+b.geometry.getAttribute('position').count,0);expect(count).toBe(41*28*4);
 const first=batches.find(b=>b.cells.some(c=>c.x===0&&c.y===0))!;const j=first.cells.findIndex(c=>c.x===0&&c.y===0)*4,p=first.geometry.getAttribute('position');expect(p.getX(j)).toBeCloseTo(-.5);expect(p.getX(j+1)-p.getX(j)).toBeCloseTo(1.1730205279);expect(p.getY(j)).toBeCloseTo(.5);
 const again=mod!.groundBatches(400/341,'mixed');expect(batches.map(b=>b.cells)).toEqual(again.map(b=>b.cells));for(const b of [...batches,...again])b.geometry.dispose();
});
