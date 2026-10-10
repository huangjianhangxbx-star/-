import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { zipSync, unzipSync } from 'fflate';
import { composePreset, compileWorkflowTask } from '../core/task.ts';
const archive = createRequire(import.meta.url)('../archive/export-zip.cjs');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const selection = { mode:'preset', seed:{id:'standalone-static-png',version:'1'}, purpose:{id:'generic-asset',version:'1'},
  structure:{id:'standalone-static-png',version:'1'}, operation:{id:'create-new',version:'1'}, style:{id:'project-neutral',version:'1'}, adapter:{id:'codex',version:'1'} };
async function make(t, family = 'wood') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05b-archive-'));
  t.after(async()=>{ assert.ok(path.basename(dir).startsWith('2dw05b-archive-')); await fs.rm(dir,{recursive:true,force:true}); });
  const spec = composePreset(selection,{taskId:'env-zip',title:'木箱',widthPx:128,squareLocked:true,ppu:200,
    environmentStyle:{schemaVersion:'2dw-environment-style/1',domain:'environment',materialFamily:family,repeatable:false,connected:false}},[]);
  const entries = compileWorkflowTask(spec).entries;
  const result = await archive.exportZip({spec,entries,binaries:{},outputDirectory:dir,fileName:'env.zip'});
  return {spec,entries,result,bytes:await fs.readFile(result.path),dir};
}
function mutate(bytes, f) {
  const files = unzipSync(bytes); f(files);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
  manifest.entries = Object.entries(files).filter(([n])=>n!=='manifest.json').map(([n,b])=>({path:n,byteLength:b.length,sha256:hash(b)}));
  files['manifest.json']=Buffer.from(JSON.stringify(manifest)); return Buffer.from(zipSync(files,{level:0}));
}
test('v4 exports authoritative scene snapshot, candidate separation and 200 PPU without fabricated art', async t=>{
  const {spec,bytes,entries,dir}=await make(t);
  const checked=archive.validateZip(bytes);
  assert.equal(checked.manifest.schemaVersion,'2dw-zip/4');
  assert.equal(checked.spec.schemaVersion,'1.2.0');
  assert.equal(spec.output.worldWidth,.64);
  assert.equal(checked.spec.environmentStyle.candidateRules.length,2);
  for(const n of ['style/scene-style-charter.md','style/environment-common-rules.md','style/material-family.md','style/failure-signals.md']) assert.ok(checked.entries.some(e=>e.path===n));
  assert.ok(!checked.entries.some(e=>e.path.startsWith('output/')||e.path.startsWith('reports/')));
  await assert.rejects(archive.exportZip({spec,entries,binaries:{},outputDirectory:dir,fileName:'env.zip'}),/exists|EEXIST|overwrite/i);
});
test('v4 rejects altered mirrors and promoted candidates even after manifest rehash', async t=>{
  const {bytes}=await make(t);
  assert.throws(()=>archive.validateZip(mutate(bytes,f=>{f['style/material-family.md']=Buffer.from('silently approved wood');})));
  assert.throws(()=>archive.validateZip(mutate(bytes,f=>{f['prompts/codex.md']=Buffer.from('wood is now approved');})),/environment|mirror/i);
  assert.throws(()=>archive.validateZip(mutate(bytes,f=>{
    const s=JSON.parse(Buffer.from(f['spec/asset-spec.json']).toString());s.environmentStyle.candidateRules[0].status='approved';
    f['spec/asset-spec.json']=Buffer.from(JSON.stringify(s));
  })),/environment|snapshot|场景/i);
});
test('old manifest cannot accept scene payload, and v4 cannot be stripped of its authority', async t=>{
  const {bytes}=await make(t,'stone');
  assert.throws(()=>archive.validateZip(mutate(bytes,f=>{
    const m=JSON.parse(Buffer.from(f['manifest.json']).toString());m.schemaVersion='2dw-zip/3';f['manifest.json']=Buffer.from(JSON.stringify(m));
  })));
  assert.throws(()=>archive.validateZip(mutate(bytes,f=>{
    const s=JSON.parse(Buffer.from(f['spec/asset-spec.json']).toString());delete s.environmentStyle;f['spec/asset-spec.json']=Buffer.from(JSON.stringify(s));
  })));
});
