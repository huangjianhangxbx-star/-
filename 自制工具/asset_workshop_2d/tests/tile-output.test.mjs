import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {PNG}=require('pngjs'),{zipSync,unzipSync}=require('fflate');
const {createTilePipeline}=require('../desktop/tile-pipeline.cjs');
const {artTemplateImages}=require('../grammar/art-directed.cjs');
const {sha}=require('../grammar/compile.cjs');
const {testScenes}=require('../grammar/catalog.cjs');
const {validateOutputZip}=require('../workflow/output.cjs');

let fixture;
function realPipelineOutput(){
 fixture??=(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-output-test-'));
  try{
   const pipeline=await createTilePipeline({directory,pickSave:async()=>path.join(directory,'compiled.zip')});
   await pipeline.action('configure',{strategy:'art-directed',cellPixels:32,description:'Synthetic technical output validation fixture'});
   await pipeline.action('lock');
   const sample=new PNG({width:64,height:64});
   for(let i=0;i<sample.data.length;i+=4)sample.data.set([115,148,90,255],i);
   await pipeline.workflow.importSample(PNG.sync.write(sample),{kind:'sample',source:'synthetic-test',testOnly:true});
   await pipeline.workflow.approveSample({explicit:true,notes:'Synthetic technical validation only; no human art approval'});
   const state=await pipeline.workflow.getState(),layers=artTemplateImages(state.lockedSpec.grammar);
   await pipeline.workflow.importMaster({materials:layers.materials,contour:layers.contour},{source:'synthetic-test'});
   await pipeline.action('compile');
   assert.equal((await pipeline.workflow.getState()).compiled.structureStatus,'passed');
   const output=await pipeline.action('exportCompiled');
   return await fs.readFile(output.path);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
 })();
 return fixture;
}

function unpack(bytes){return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name,value])=>[name,Buffer.from(value)]));}
function rehash(files){
 const manifest=JSON.parse(files['manifest.json']);
 manifest.entries=Object.entries(files).filter(([name])=>name!=='manifest.json').map(([name,bytes])=>({path:name,sha256:sha(bytes),byteLength:bytes.length}));
 files['manifest.json']=Buffer.from(JSON.stringify(manifest));
 return Buffer.from(zipSync(files));
}

test('real native-pipeline output validates 47 states, 188 variants and nine PNG scenes without granting art acceptance',async()=>{
 const bytes=await realPipelineOutput(),checked=validateOutputZip(bytes),files=unpack(bytes);
 assert.equal(checked.tiles,47);assert.equal(checked.variants,188);
 assert.equal(checked.map.approval.testOnly,true);
 assert.equal(checked.map.artAcceptance,'pending-human-review');
 assert.equal(checked.map.unitySorting,'unverified');
 assert.equal(checked.report.artAcceptance,'pending-human-review');
 assert.deepEqual(Object.keys(checked.report.scenes).sort(),Object.keys(testScenes()).sort());
 for(const name of Object.keys(testScenes())){
  assert.equal(checked.report.scenes[name].passed,true);
  const png=PNG.sync.read(files[`scenes/${name}.png`],{checkCRC:true});
  assert.ok(png.width>0&&png.height>0);
 }
});

test('removing a variant or changing its pixels remains rejected after map and manifest hashes are recomputed',async()=>{
 const original=await realPipelineOutput();
 const missing=unpack(original),missingMap=JSON.parse(missing['map.json']);
 const removed=missingMap.variants.pop();delete missing[removed.path];
 missing['map.json']=Buffer.from(JSON.stringify(missingMap));
 assert.throws(()=>validateOutputZip(rehash(missing)),/变体|数量|状态/);

 const changed=unpack(original),changedMap=JSON.parse(changed['map.json']);
 const target=changedMap.variants.find(v=>v.variant===1);
 const png=PNG.sync.read(changed[target.path]);
 const pixel=png.data.findIndex((value,index)=>index%4===3&&value===255)-3;
 assert.ok(pixel>=0);png.data[pixel]^=1;
 changed[target.path]=PNG.sync.write(png);target.sha256=sha(changed[target.path]);
 changed['map.json']=Buffer.from(JSON.stringify(changedMap));
 assert.throws(()=>validateOutputZip(rehash(changed)),/变体|像素/);
});

test('scene PNG corruption or replaced preview pixels cannot be legitimized by a passed report and recomputed hashes',async()=>{
 const original=await realPipelineOutput();
 const damaged=unpack(original);damaged['scenes/L.png']=Buffer.from('not a PNG');
 assert.throws(()=>validateOutputZip(rehash(damaged)),/PNG|场景|地图|预览|像素/);

 const changed=unpack(original),png=PNG.sync.read(changed['scenes/L.png']);
 png.data[0]^=1;changed['scenes/L.png']=PNG.sync.write(png);
 assert.throws(()=>validateOutputZip(rehash(changed)),/场景|地图|预览|像素/);
});
