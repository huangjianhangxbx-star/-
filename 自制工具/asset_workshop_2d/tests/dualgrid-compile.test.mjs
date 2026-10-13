import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {makeSpec,geometryAt,compile,renderBoard}=require('../dual-grid/compile.cjs');
const {diagnose}=require('../dual-grid/seam-check.cjs');
function pixels(n,fn){const p=new PNG({width:n,height:n});for(let y=0;y<n;y++)for(let x=0;x<n;x++)p.data.set(fn(x,y),(y*n+x)*4);return PNG.sync.write(p);}
const rgba=(p,x,y)=>Array.from(p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4));
const spec=()=>makeSpec({cellPixels:16,ppu:100,period:2,inkWidth:0,inkStrength:0,roundness:1});
function sample(){const s=spec();return compile(s,{A:pixels(32,(x,y)=>[50+x,80+y,100,255]),B:pixels(32,()=>[7,9,11,255])});}
test('16 shapes have exact A corners, including both separated diagonals',()=>{
 for(let m=0;m<16;m++)for(const [bit,x,y]of [[1,0,0],[2,1,0],[4,0,1],[8,1,1]])assert.equal(geometryAt(m,x,y,1)>0,!!(m&bit));
 for(const m of [6,9])assert.equal(geometryAt(m,.5,.5,1)>0,false);
 assert.equal(geometryAt(0,.5,.5,1)>0,false);assert.equal(geometryAt(15,.5,.5,1)>0,true);
 assert.throws(()=>geometryAt(16,0,0,1));
});
test('all compatible shape edges agree exactly on occupancy',()=>{
 for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let n=0;n<=32;n++){
  const t=n/32;
  if((!!(a&2)===!!(b&1))&&(!!(a&8)===!!(b&4)))assert.equal(geometryAt(a,1,t,.8)>0,geometryAt(b,0,t,.8)>0,`H ${a}/${b} ${t}`);
  if((!!(a&4)===!!(b&1))&&(!!(a&8)===!!(b&2)))assert.equal(geometryAt(a,t,1,.8)>0,geometryAt(b,t,0,.8)>0,`V ${a}/${b} ${t}`);
 }
});
test('shared raster borders retain the same coverage and ink despite other corners',()=>{
 const c=compile(makeSpec({cellPixels:16,period:1,roundness:0,inkWidth:2,inkStrength:.65}),{A:pixels(16,()=>[100,110,120,255]),B:pixels(16,()=>[7,9,11,255])});
 for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let p=0;p<16;p++){
  if((!!(a&2)===!!(b&1))&&(!!(a&8)===!!(b&4)))assert.deepEqual(rgba(c.canonical[a].image,15,p),rgba(c.canonical[b].image,0,p),`horizontal shared border ${a}/${b}`);
  if((!!(a&4)===!!(b&1))&&(!!(a&8)===!!(b&2)))assert.deepEqual(rgba(c.canonical[a].image,p,15),rgba(c.canonical[b].image,p,0),`vertical shared border ${a}/${b}`);
 }
});
test('period source is fully used, every phase retains literal source pixels',()=>{
 const c=sample();assert.equal(c.canonical.length,16);assert.equal(c.phaseTiles.length,64);assert.equal(c.atlas.width,64);assert.equal(c.sourceReport.A.coverage,1);assert.equal(c.sourceReport.B.coverage,1);assert.equal(c.sourceReport.canonicalOnlyCoverage,.25);
 const tile=c.phaseTiles.find(t=>t.mask===15&&t.phaseX===1&&t.phaseY===0);const p=PNG.sync.read(tile.png);assert.deepEqual(rgba(p,0,0),[66,80,100,255]);assert.deepEqual(rgba(p,15,15),[81,95,100,255]);
 const b=PNG.sync.read(c.canonical[0].png);assert.deepEqual(rgba(b,8,8),[7,9,11,255]);
 for(let m=0;m<16;m++){const p=PNG.sync.read(c.canonical[m].png);assert.deepEqual(rgba(c.atlas,m%4*16+8,Math.floor(m/4)*16+8),rgba(p,8,8));}
});
test('world render phase reconstructs continuous whole-surface pixels across cells',()=>{
 const c=sample(),r=renderBoard(c,{width:4,height:4,cells:Array(16).fill(1)}),p=PNG.sync.read(r.png);assert.equal(p.width,80);assert.equal(r.placements.length,25);
 assert.deepEqual(rgba(p,17,18),[67,98,100,255]);assert.deepEqual(rgba(p,33,18),[51,98,100,255]);
 const last=r.placements.find(x=>x.x===2&&x.y===1);assert.equal(last.mask,15);assert.deepEqual(last.sourceRect,{x:0,y:16,width:16,height:16});
});
test('dimensions, transparency and unknown settings reject rather than repair',()=>{
 assert.throws(()=>compile(spec(),{A:pixels(31,()=>[50,60,70,255]),B:pixels(32,()=>[7,9,11,255])}),/尺寸/);
 assert.throws(()=>compile(spec(),{A:pixels(32,()=>[50,60,70,0]),B:pixels(32,()=>[7,9,11,255])}),/Alpha|透明/);
 assert.throws(()=>makeSpec({cellPixels:16,period:3}));assert.throws(()=>makeSpec({cellPixels:16,unexpected:true}));
});
test('technical diagnosis catches mutated tile and separates repetition from art',()=>{
 const c=compile(spec(),{A:pixels(32,()=>[80,95,100,255]),B:pixels(32,()=>[7,9,11,255])}),g={width:8,height:8,cells:Array(64).fill(1)},good=diagnose(c,g);
 assert.equal(good.statuses.topology,'passed');assert.equal(good.statuses.pixelSeams,'passed');assert.equal(good.statuses.art,'pending-human');assert.equal(good.statuses.unity,'unverified');assert.ok(good.issues.some(i=>i.code==='high-repeat-rate'));
 const p=PNG.sync.read(c.phaseTiles[0].png);p.data[0]=244;c.phaseTiles[0].png=PNG.sync.write(p);const bad=diagnose(c,g);assert.equal(bad.statuses.topology,'failed');assert.ok(bad.issues.some(i=>i.code==='phase-discontinuity'));
});
test('source wrap mismatch is diagnosed without changing source bytes',()=>{
 const A=pixels(32,(x,y)=>[x===31?240:60,80,90,255]),c=compile(spec(),{A,B:pixels(32,()=>[7,9,11,255])}),d=diagnose(c,{width:3,height:3,cells:Array(9).fill(1)});
 assert.ok(d.issues.some(i=>i.code==='material-color-seam'));assert.equal(d.statuses.pixelSeams,'warnings');assert.equal(c.sources.A.equals(A),true);
});
test('atlas corruption and compatible raster coverage mismatch are hard failures',()=>{
 const c=sample(),g={width:3,height:3,cells:Array(9).fill(1)};c.phaseAtlases[0].image.data[0]^=255;assert.ok(diagnose(c,g).issues.some(i=>i.code==='atlas-index'));
 const bad=sample();bad.fields[2].a[15]=1-bad.fields[2].a[15];assert.ok(diagnose(bad,g).issues.some(i=>i.code==='mask-mismatch'));
});
