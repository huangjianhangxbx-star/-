import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url);let session;try{session=require('../desktop/tile-session.cjs');}catch{}
test('native imports compile real images, reject wrong sizes and cannot reuse a stale style result',async()=>{
 assert.ok(session,'tile session is not implemented');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tile-session-'));
 try{let input;const s=session.createTileSession({pickInput:async()=>input,readClipboard:async()=>({kind:'image',bytes:await fs.readFile(input)}),referenceSnapshot:async()=>[],pickSave:async()=>path.join(dir,'task.zip')});
 const board=s.configure({cellPixels:32}),p=path.join(dir,'master.png');await fs.writeFile(p,Buffer.from(board.blank.split(',')[1],'base64'));input=p;
 const compiled=await s.importMaster('file');assert.equal(compiled.coverage,47);assert.equal(compiled.inputPhase,'structure');assert.ok(s.scene({scene:'hole'}).preview.startsWith('data:image/png'));
 const style=await s.importMaster('clipboard','style');assert.equal(style.inputPhase,'style');assert.equal(style.coverage,47);
 s.configure({cellPixels:64});assert.throws(()=>s.scene({scene:'hole'}),/导入/);await assert.rejects(s.importMaster('file'),/尺寸/);
 s.configure({cellPixels:32});const out=await s.exportTask();assert.ok((await fs.stat(out.path)).size>100);await assert.rejects(s.exportTask(),/exist|已存在/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
