import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),v8=require('../workflow/package-v8.cjs'),{compileArtDirected,validateArtLayer}=require('../grammar/art-directed.cjs');
const spec=()=>v8.buildLockedSpec({protocolVersion:8,templateId:'XH-STONE-FLOOR-8COND-01',cellPixels:16,ppu:100});
function source(){const p=new PNG({width:64,height:32});for(let y=0;y<32;y++)for(let x=0;x<64;x++){const role=Math.floor(x/16)+Math.floor(y/16)*4;p.data.set([50+role*11+(x%13),65+role*7+(y%9),60+role*5,255],(y*64+x)*4);}return PNG.sync.write(p);}
const adapter=()=>require('../grammar/single-adapter.cjs');
const parameters=()=>({explicit:true,phasePolicy:'source-frame-duplication-v1',contour:{inset:0,darkStrength:0},rects:Array.from({length:8},(_,i)=>({x:(i%4)*16,y:Math.floor(i/4)*16,width:16,height:16}))});
test('explicit adapter preserves original art bytes and emits traceable legal pixels, not a copied single tile',()=>{
 const raw=source(),before=Buffer.from(raw),s=spec(),out=adapter().adaptArtSource(s,raw,parameters());assert.deepEqual(raw,before);assert.equal(out.report.schemaVersion,'single-art-adapter/1');assert.equal(out.report.sourceSha256,require('../workflow/store.cjs').sha(raw));assert.equal(out.report.centerUniqueCount,4);
 validateArtLayer(s.grammar,'materials',out.materials);validateArtLayer(s.grammar,'contour',out.contour);const compiled=compileArtDirected(s.grammar,out);assert.equal(compiled.tiles.length,47);assert.equal(compiled.tileVariants.length,188);assert.equal(s.grammar.sprite.overhang.top,0);
 const original=PNG.sync.read(raw),materials=PNG.sync.read(out.materials);assert.deepEqual(materials.data.subarray((5*64+5)*4,(5*64+5)*4+4),original.data.subarray((5*64+5)*4,(5*64+5)*4+4));
});
test('missing consent, wrong size, overlapping windows and invalid numeric policy are rejected',()=>{
 const raw=source(),s=spec();assert.throws(()=>adapter().adaptArtSource(s,raw,{...parameters(),explicit:false}),/明确/);
 const overlapping=parameters();overlapping.rects[1]=overlapping.rects[0];assert.throws(()=>adapter().adaptArtSource(s,raw,overlapping),/重叠/);
 const wrong=parameters();wrong.rects[7].x=80;assert.throws(()=>adapter().adaptArtSource(s,raw,wrong),/越界/);
 assert.throws(()=>adapter().adaptArtSource(s,raw,{...parameters(),contour:{inset:0,darkStrength:193}}),/数值/);
});
test('transparent painting pixels are not silently flattened and altered receipts cannot validate',()=>{
 const raw=PNG.sync.read(source());raw.data[3]=0;assert.throws(()=>adapter().adaptArtSource(spec(),PNG.sync.write(raw),parameters()),/不透明/);
 const out=adapter().adaptArtSource(spec(),source(),parameters());const bad={...out.report,sourceSha256:'0'.repeat(64)};assert.throws(()=>adapter().validateConversion(spec(),source(),out.materials,out.contour,bad),/来源|转换/);
});
