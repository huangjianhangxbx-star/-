import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
let art,validation;try{art=require('../grammar/art-directed.cjs');}catch{}try{validation=require('../grammar/art-directed-validate.cjs');}catch{}
const px=(p,x,y)=>[...p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4)];
// Original diagnostic paint, independent of the production cutter.
function input(c=32){
 const materials=new PNG({width:4*c,height:2*c}),contour=new PNG({width:2*c,height:c});
 for(let y=0;y<materials.height;y++)for(let x=0;x<materials.width;x++){
  const col=Math.floor(x/c),row=Math.floor(y/c),xx=x%c,yy=y%c;
  const rgb=row===0?[70+col*24+Math.floor(xx/7),110+col*9,55+Math.floor(yy/9)]:col<2?([xx,yy].some(v=>v<2||v>=c-2)?[84,119,62]:[88+col*20,115-col*9,50]):col===2?[87,64+Math.floor(xx/8),48]:[35,41,33];
  materials.data.set([...rgb,255],(y*materials.width+x)*4);
 }
 for(let y=0;y<c;y++)for(let x=0;x<2*c;x++)contour.data.set([x<c?30:220,y>c/2?100:0,0,255],(y*2*c+x)*4);
 return {materials:PNG.sync.write(materials),contour:PNG.sync.write(contour)};
}
test('new compiler consumes multiple original patches and preserves old classic source untouched',()=>{
 assert.ok(art,'art-directed compiler not implemented');
 const g=art.makeArtGrammar({cellPixels:32}),r=art.compileArtDirected(g,input());
 assert.equal(r.tiles.length,47);assert.equal(r.tileVariants.length,188);
 const centers=r.tileVariants.filter(t=>t.mask===255).map(t=>PNG.sync.read(t.png));
 assert.ok(new Set(centers.map(p=>px(p,16,16).join(','))).size>=2,'full center maps must not repeat one source patch');
 assert.equal(r.patchSources.length,10);assert.ok(r.patchSources.every(p=>p.sha256.length===64));
 assert.ok(r.sampling,'actual sampling measurement is missing');assert.ok(r.sampling.materialFraction>.5,'actual unique sampled material area must exceed a few center crops');
 assert.ok(r.patchSources.filter(p=>p.role.startsWith('surface-')).every(p=>p.sampledPixels>500));
 assert.equal(r.artAcceptance,'pending-human-review');assert.equal(r.sortingVerified,false);
 assert.equal(g.worldCellSize,.32);assert.equal(g.master.width,128);assert.equal(g.control.width,64);
});
test('grass and stone render real nine-scene maps with deterministic center variation and pending human review',()=>{
 assert.ok(validation,'art-directed diagnostics not implemented');const {testScenes}=require('../grammar/catalog.cjs');
 for(const templateId of ['XH-GRASS-8COND-01','XH-STONE-EDGE-8COND-01']){
  const g=art.makeArtGrammar({templateId,cellPixels:32}),r=art.compileArtDirected(g,input());
  for(const board of Object.values(testScenes())){const v=validation.validateArtCompilation(g,r,board);assert.equal(v.passed,true,JSON.stringify(v.issues));assert.equal(v.coverage,47);assert.equal(v.artAcceptance,'pending-human-review');assert.equal(v.sortingVerified,false);}
  const full=Array.from({length:8},()=>Array(8).fill(1)),v=validation.validateArtCompilation(g,r,full);
  assert.ok(new Set(v.placements.filter(p=>p.mask===255).map(p=>p.variant)).size>=2);
  assert.deepEqual(v.preview,validation.validateArtCompilation(g,r,full).preview);
  assert.ok(v.repeatDiagnostics.centerPatchCount>=2);
 }
});
test('missing states, alpha corruption and the complete shared edge report exact map and source coordinates',()=>{
 assert.ok(validation,'art-directed diagnostics not implemented');const g=art.makeArtGrammar({cellPixels:32}),r=art.compileArtDirected(g,input());
 const isolated={...r,tiles:r.tiles.filter(t=>t.mask!==0),tileVariants:r.tileVariants.filter(t=>t.mask!==0)};
 const missing=validation.validateArtCompilation(g,isolated,[[1]]);assert.equal(missing.passed,false);assert.ok(missing.issues.some(i=>i.code==='missing-cell-output'&&i.cell.x===0&&i.cell.y===0&&i.mask===0));
 const mutated={...r,tiles:r.tiles.map(t=>({...t})),tileVariants:r.tileVariants.map(t=>({...t}))};
 for(const t of [...mutated.tiles,...mutated.tileVariants]){const p=PNG.sync.read(t.png);p.data[(16*p.width+31)*4+3]=0;t.png=PNG.sync.write(p);}
 const v=validation.validateArtCompilation(g,mutated,[[1,1]]);assert.equal(v.passed,false);
 assert.ok(v.issues.some(i=>i.code==='alpha-gap'&&i.pixel&&i.sourceRect&&i.cell.x===0));
 const colored={...r,tileVariants:r.tileVariants.map(t=>({...t}))};
 for(const t of colored.tileVariants){const p=PNG.sync.read(t.png);p.data[(1*p.width+31)*4]=255;t.png=PNG.sync.write(p);}
 const warn=validation.validateArtCompilation(g,colored,Array.from({length:3},()=>Array(3).fill(1)));
 assert.ok(warn.issues.some(i=>i.code==='material-seam'&&i.pixel.y===1),'inspection must include corners outside the former central-third range');
 assert.throws(()=>validation.validateArtCompilation(g,r,[[1,'bad']]));
});
test('artist contour and dark paint change actual output without changing the mask identity',()=>{
 assert.ok(art,'art-directed compiler not implemented');const g=art.makeArtGrammar({cellPixels:32});
 const base=input(),changed=PNG.sync.read(base.contour);for(let i=0;i<changed.data.length;i+=4){changed.data[i]=255;changed.data[i+1]=192;}
 const a=art.compileArtDirected(g,base),b=art.compileArtDirected(g,{...base,contour:PNG.sync.write(changed)});
 const aa=PNG.sync.read(a.tiles.find(t=>t.mask===0).png),bb=PNG.sync.read(b.tiles.find(t=>t.mask===0).png);
 assert.ok(aa.data.some((v,i)=>i%4===3&&v!==bb.data[i]),'R control must alter the painted contour');
 assert.notDeepEqual(px(aa,16,16),px(bb,16,16),'G control must alter dark planes');
 assert.deepEqual(a.tiles.map(t=>t.mask),b.tiles.map(t=>t.mask));
});
test('formal dimensions, required control PNG and incompatible shared edge phase are rejected',()=>{
 assert.ok(art,'art-directed compiler not implemented');const g=art.makeArtGrammar({cellPixels:32}),i=input();
 assert.throws(()=>art.compileArtDirected(g,{materials:i.materials}),/轮廓|contour/);
 assert.throws(()=>art.compileArtDirected(g,{...i,materials:PNG.sync.write(new PNG({width:129,height:64}))}),/尺寸/);
 const m=PNG.sync.read(i.materials);m.data[(32*m.width+32)*4]=255;
 assert.throws(()=>art.compileArtDirected(g,{...i,materials:PNG.sync.write(m)}),/相位/);
 const c=PNG.sync.read(i.contour);c.data[3]=0;assert.throws(()=>art.compileArtDirected(g,{...i,contour:PNG.sync.write(c)}),/不透明/);
 c.data[3]=255;c.data[2]=90;assert.throws(()=>art.compileArtDirected(g,{...i,contour:PNG.sync.write(c)}),/通道/);
});
test('disconnected artistic contour is refused and oversized 188-variant allocations are bounded',()=>{
 const g=art.makeArtGrammar({cellPixels:32}),i=input(),p=PNG.sync.read(i.contour);
 for(let k=0;k<p.data.length;k+=4)p.data[k]=255;p.data[(16*p.width+2)*4]=0;
 assert.throws(()=>art.compileArtDirected(g,{...i,contour:PNG.sync.write(p)}),/断开|孤立/);
 assert.throws(()=>art.makeArtGrammar({cellPixels:512}),/预算|256/);
});
test('map variation selector returns bounded deterministic variants without the caller correcting it',()=>{
 const g=art.makeArtGrammar({cellPixels:32});for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.ok(validation.variantAt(g,x,y)>=0&&validation.variantAt(g,x,y)<4);
});
test('each formal layer can be validated before both exist without filling missing artwork',()=>{
 const g=art.makeArtGrammar({cellPixels:32}),i=input();assert.equal(typeof art.validateArtLayer,'function');
 assert.equal(art.validateArtLayer(g,'materials',i.materials).width,128);assert.equal(art.validateArtLayer(g,'contour',i.contour).height,32);
 assert.throws(()=>art.validateArtLayer(g,'body',i.materials),/角色|层/);
});
test('corrupted canonical PNG cannot be concealed by otherwise valid map variants',()=>{
 const g=art.makeArtGrammar({cellPixels:32}),r=art.compileArtDirected(g,input()),t=r.tiles.find(t=>t.mask===0),p=PNG.sync.read(t.png);p.data[(16*p.width+16)*4+3]=0;
 const changed={...r,tiles:r.tiles.map(a=>a.mask===0?{...a,png:PNG.sync.write(p)}:a)};
 const v=validation.validateArtCompilation(g,changed,[[1]]);assert.equal(v.passed,false);assert.ok(v.issues.some(i=>i.code==='canonical-variant-mismatch'));
});
test('compiled pixels remain bound to their grammar seed and must not validate under a changed locked format',()=>{
 const g=art.makeArtGrammar({cellPixels:32}),r=art.compileArtDirected(g,input()),changed=art.makeArtGrammar({cellPixels:32,seed:18});
 const v=validation.validateArtCompilation(changed,r,[[1]]);assert.equal(v.passed,false);assert.ok(v.issues.some(i=>i.code==='compiled-spec-mismatch'));
});
test('stone shared edge phase follows the logical cell after adding visible overhang',()=>{
 const g=art.makeArtGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:32}),r=art.compileArtDirected(g,input()),p=PNG.sync.read(r.tiles.find(t=>t.mask===255).png);
 assert.deepEqual(px(p,3,16),[84,119,62,255]);assert.deepEqual(px(p,34,16),[84,119,62,255]);
});
