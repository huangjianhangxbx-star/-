import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {Catalog}=require('../desktop/catalog.cjs');
async function directory(fn: (root:string)=>Promise<void>) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'xh-native-rename-'));
  try {await fn(root);} finally {
    assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('xh-native-rename-'));
    await fs.rm(root,{recursive:true,force:true});
  }
}
async function asset(root:string,name:string,id:string) {
  await fs.copyFile(path.resolve('fixtures/direction.glb'),path.join(root,name+'.glb'));
  await fs.writeFile(path.join(root,name+'.xhasset.json'),JSON.stringify({assetId:id}));
}
test('scan restores source asset identity and native file binding without a manifest',async()=>directory(async root=>{
  await asset(root,'Wall','native-wall');const c=new Catalog(root);const rows=await c.scan();
  assert.equal(rows.length,1);assert.equal(rows[0].id,'native-wall');assert.equal(rows[0].nativeSource,'Wall.xhasset.json');
}));
test('single native rename moves GLB and double-extension source, keeps ID on fresh scan',async()=>directory(async root=>{
  await asset(root,'Wall','native-wall');const c=new Catalog(root);await c.scan();
  const row=await c.rename('native-wall','Gate',true);
  assert.equal(row.path,'Gate.glb');assert.equal(row.nativeSource,'Gate.xhasset.json');
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'Gate.xhasset.json'),'utf8')).assetId,'native-wall');
  await assert.rejects(fs.access(path.join(root,'Wall.xhasset.json')));
  const fresh=new Catalog(root);const rows=await fresh.scan();assert.equal(rows.length,1);assert.equal(rows[0].id,'native-wall');assert.equal(rows[0].nativeSource,'Gate.xhasset.json');
}));
test('source discovery does not replace existing manifest identity',async()=>directory(async root=>{
  await asset(root,'Wall','native-wall');await fs.writeFile(path.join(root,'.xinghai-assets.json'),JSON.stringify({version:1,assets:[{id:'established-id',path:'Wall.glb',name:'Wall',type:'glb'}]}));
  const rows=await new Catalog(root).scan();assert.equal(rows[0].id,'established-id');assert.equal(rows[0].nativeSource,'Wall.xhasset.json');
}));
test('invalid and conflicting native asset IDs fail before manifest is saved',async()=>directory(async root=>{
  await asset(root,'Wall','../invalid');await assert.rejects(new Catalog(root).scan(),/ID|身份/);await assert.rejects(fs.access(path.join(root,'.xinghai-assets.json')));
  await fs.writeFile(path.join(root,'Wall.xhasset.json'),JSON.stringify({assetId:'same-id'}));await asset(root,'Gate','same-id');
  await assert.rejects(new Catalog(root).scan(),/ID|身份/);await assert.rejects(fs.access(path.join(root,'.xinghai-assets.json')));
}));
test('native source rename collision preserves both original files',async()=>directory(async root=>{
  await asset(root,'Wall','native-wall');await fs.writeFile(path.join(root,'Gate.xhasset.json'),'occupied');const c=new Catalog(root);await c.scan();
  await assert.rejects(c.rename('native-wall','Gate',true),/已存在/);
  await fs.access(path.join(root,'Wall.glb'));await fs.access(path.join(root,'Wall.xhasset.json'));assert.equal(c.get('native-wall').path,'Wall.glb');
}));
