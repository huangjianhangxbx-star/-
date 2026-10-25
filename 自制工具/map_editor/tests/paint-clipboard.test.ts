import test from 'node:test';import assert from 'node:assert/strict';
import {copyPaintPatch,placePaintPatch} from '../core/paint-clipboard.ts';
import {PaintSurfaceDomain} from '../core/paint-surface-domain.ts';
const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25);
test('transparent patch pastes on all six orientations preserving texel size',()=>{
 const points=[d.pixel({face:4,plane:1},3,4)!,d.pixel({face:4,plane:1},5,4)!];
 const patch=copyPaintPatch({schema:'xinghai-surface-paint-1',density:64,faces:{'0,0,0,4':{'67':'#ff0000','69':'#00ff00'}}},points,d);
 assert.equal(patch.width,3);assert.equal(patch.pixels.length,2);
 for(let face=0;face<6;face++){
  const hit=d.pixel({face,plane:face%2?0:1},8,8)!;
  const result=placePaintPatch(patch,d,hit,0,1,false);
  assert.equal(result.length,2);assert.ok(result.every(p=>p.pixel.face===face));
  assert.deepEqual(result.map(p=>p.color),['#ff0000','#00ff00']);
 }
});
test('surface paste wraps a cube edge while planar paste clips, scaling fills pixels',()=>{
 const patch={width:3,height:1,pixels:[{u:0,v:0,color:'#ff0000'},{u:1,v:0,color:'#00ff00'},{u:2,v:0,color:'#0000ff'}]};
 const hit=d.pixel({face:4,plane:1},15,8)!;
 assert.equal(placePaintPatch(patch,d,hit,0,1,false).length,2);
 const wrapped=placePaintPatch(patch,d,hit,0,1,true);
 assert.equal(wrapped.length,3);assert.ok(wrapped.some(p=>p.pixel.face===0));
 assert.equal(placePaintPatch(patch,d,d.pixel({face:4,plane:1},8,8)!,1,2,false).length,12);
});
