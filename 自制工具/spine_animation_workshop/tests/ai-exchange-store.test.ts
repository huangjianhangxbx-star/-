import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';import test from 'node:test';
const require=createRequire(import.meta.url);const bridge=()=>require('../desktop/ai-exchange-store.cjs');
test('AI exchange creates a fresh local directory and rejects paths or raw project uploads',async t=>{
 const root=await mkdtemp(join(tmpdir(),'spw-ai-store-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'original.spine'),'untouched');
 const first=await bridge().writeAiFiles(root,'bundle','bundle-123',{'manifest.json':'{}','任务书.md':'real task','discovery.json':'{"surveyOnly":true}'});
 const second=await bridge().writeAiFiles(root,'bundle','bundle-123',{'manifest.json':'{}','任务书.md':'second'});
 assert.notEqual(first.directory,second.directory);assert.equal(await readFile(join(first.directory,'任务书.md'),'utf8'),'real task');
 await assert.rejects(bridge().writeAiFiles(root,'bundle','id',{'../original.spine':'changed'}),/文件|路径/);
 await assert.rejects(bridge().writeAiFiles(root,'bundle','id',{'model.spine':'bytes'}),/文件|路径/);
 assert.equal(await readFile(join(root,'original.spine'),'utf8'),'untouched');
});
test('AI response reader only reads data siblings and requires rig hints',async t=>{
 const root=await mkdtemp(join(tmpdir(),'spw-ai-reply-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'mapping-proposal.json');await writeFile(path,'{}');await assert.rejects(bridge().readAiReply(path),/rig-hints/);
 await writeFile(join(root,'rig-hints.json'),'{}');await writeFile(join(root,'analysis-report.md'),'evidence');
 const reply=await bridge().readAiReply(path);assert.equal(reply.proposalText,'{}');assert.equal(reply.hintsText,'{}');assert.equal(reply.reportText,'evidence');
 await writeFile(join(root,'manifest.json'),'{"bundleId":"original-survey"}');
 assert.equal((await bridge().readAiReply(path)).manifestText,'{"bundleId":"original-survey"}');
});
