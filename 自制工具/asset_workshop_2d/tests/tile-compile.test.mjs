import test from 'node:test'; import assert from 'node:assert/strict'; import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),{makeGrammar,testScenes}=require('../grammar/catalog.cjs');
let compiler,validator; try{compiler=require('../grammar/compile.cjs');validator=require('../grammar/validate.cjs');}catch{}
function fixture(g){const p=new PNG({width:g.master.width,height:g.master.height});for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4;p.data.set([x%251,y%241,79,255],i);}return PNG.sync.write(p);}
test('compilation cuts actual PNG pixels without stretching and keeps 47 outputs',()=>{
 assert.ok(compiler,'PNG compiler is not implemented');const g=makeGrammar({cellPixels:32});const bytes=fixture(g),r=compiler.compileMaster(g,bytes);
 assert.equal(r.tiles.length,47);const center=r.tiles.find(t=>t.mask===255),p=PNG.sync.read(center.png),rect=g.tiles.find(t=>t.mask===255).sourceRect;
 assert.deepEqual([...p.data.subarray((16*32+16)*4,(16*32+16)*4+4)],[(rect.x+16)%251,(rect.y+16)%241,79,255]);
 assert.throws(()=>compiler.compileMaster(g,PNG.sync.write(new PNG({width:16,height:16}))),/尺寸/);
 assert.throws(()=>compiler.compileMaster(g,Buffer.from('invalid')),/PNG/);
});
test('grass isolated contour is transparent while stone retains explicit taller canvas and pivot',()=>{
 assert.ok(compiler,'PNG compiler is not implemented');for(const templateId of ['XH-GRASS-8COND-01','XH-STONE-EDGE-8COND-01']){
 const g=makeGrammar({templateId,cellPixels:32}),r=compiler.compileMaster(g,fixture(g)),p=PNG.sync.read(r.tiles.find(t=>t.mask===0).png);
 assert.equal(p.height,templateId.includes('STONE')?48:32);assert.equal(p.data[3],0);assert.ok(p.data.some((v,i)=>i%4===3&&v===255));
 assert.equal(r.rawSha256.length,64);assert.equal(r.artAcceptance,'pending-human-review');}
});
test('missing compiled states report world cell and source master region instead of substituting a tile',()=>{
 assert.ok(validator,'connection validator is not implemented');const g=makeGrammar({cellPixels:32}),r=compiler.compileMaster(g,fixture(g));
 r.tiles=r.tiles.filter(t=>t.mask!==0);const v=validator.validateCompilation(g,r,testScenes().island);
 assert.equal(v.passed,false);assert.ok(v.issues.some(i=>i.mask===0&&i.cell?.x===1&&i.cell.y===1&&i.sourceRect));
 assert.throws(()=>validator.validateCompilation(g,r,[[1,'bad']]));
});
test('complete outputs can render hole and stone sorting/overhang without losing pixels',()=>{
 assert.ok(validator,'connection validator is not implemented');const g=makeGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:32}),r=compiler.compileMaster(g,fixture(g));
 const v=validator.validateCompilation(g,r,testScenes().hole);assert.equal(v.coverage,47);assert.ok(v.preview.length>100);assert.equal(v.artAcceptance,'pending-human-review');
});
test('stone contour uses the visible overhang while transparent outline tampering is rejected',()=>{
 const g=makeGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:32}),r=compiler.compileMaster(g,fixture(g)),t=r.tiles.find(t=>t.mask===255),p=PNG.sync.read(t.png);
 assert.ok([...Array(p.height).keys()].some(y=>p.data[(y*p.width)*4+3]===255),'stone must use left visual overhang');
 const isolated=r.tiles.find(t=>t.mask===0),edited=PNG.sync.read(isolated.png);edited.data[3]=255;isolated.png=PNG.sync.write(edited);
 assert.ok(validator.validateCompilation(g,r,testScenes().island).issues.some(i=>i.code==='alpha-shape'));
});
test('grass holes show the actual painted underlay instead of an invented checkerboard',()=>{
 const g=makeGrammar({cellPixels:32}),r=compiler.compileMaster(g,fixture(g)),v=validator.validateCompilation(g,r,testScenes().hole),p=PNG.sync.read(v.preview),i=(64*p.width+64)*4;
 assert.deepEqual([...p.data.subarray(i,i+4)],[48,176,79,255]);
});
test('oversized scene preview is refused before allocating a huge PNG',()=>{
 const g=makeGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:128});
 assert.throws(()=>validator.validateCompilation(g,{tiles:[]},Array.from({length:32},()=>Array(32).fill(0))),/预览像素预算/);
});
test('alpha inspection and overhang diagnostics change previews without changing compiled pixels',()=>{
 const g=makeGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:32}),r=compiler.compileMaster(g,fixture(g)),before=r.tiles.map(t=>compiler.sha(t.png));
 const normal=validator.validateCompilation(g,r,testScenes().island,{underlay:false});
 const alpha=validator.validateCompilation(g,r,testScenes().island,{underlay:false,alpha:true});
 const boxes=validator.validateCompilation(g,r,testScenes().island,{underlay:false,overhang:true});
 assert.notDeepEqual(alpha.preview,normal.preview);assert.notDeepEqual(boxes.preview,normal.preview);
 const p=PNG.sync.read(alpha.preview);for(let i=0;i<p.data.length;i+=4)assert.equal(p.data[i],p.data[i+1]);
 assert.deepEqual(r.tiles.map(t=>compiler.sha(t.png)),before);
});
test('painting guide marks material crop windows without drawing them into the blank master',()=>{
 const g=makeGrammar({cellPixels:32}),images=compiler.templateImages(g),guide=PNG.sync.read(images.guide),blank=PNG.sync.read(images.blank),rect=g.tiles[0].sourceRect,i=(rect.y*guide.width+rect.x)*4;
 assert.deepEqual([...guide.data.subarray(i,i+4)],[236,106,63,255]);assert.notDeepEqual(guide.data.subarray(i,i+4),blank.data.subarray(i,i+4));
});
