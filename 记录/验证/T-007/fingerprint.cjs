const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const groups=['game/src','game/tests','game/public/assets/characters/Charlotte','game/public/assets/characters/Rina_F_Summer','game/public/assets/effects/Charlotte_effect','game/public/assets/effects/Rina_F_Summer_effect'];
const files=groups.flatMap(p=>walk(path.join(root,p))).concat(['game/package.json','game/package-lock.json','game/public/assets/portraits/Charlotte.png','game/public/assets/portraits/Rina_F_Summer.png'].map(p=>path.join(root,p)));
const rows=files.sort().map(p=>({path:path.relative(root,p).replaceAll('\\','/'),bytes:fs.statSync(p).size,sha256:sha(p)}));
const protectedNames=['AGENTS.md','design/开发细则.md','design/星骸回廊_新设计说明_v0.2.md','docs/tasks/T-007-计划输入.md'];
const protectedFiles=protectedNames.map(p=>({path:p,sha256:sha(path.join(root,p))}));
const original='E:/迅雷下载/星骸回廊_第三轮角色技能重制_设计与执行计划_v0.1.md';
const plan={original,originalSHA256:sha(original),inputCopySHA256:sha(path.join(root,'docs/tasks/T-007-计划输入.md'))};
if(plan.originalSHA256!==plan.inputCopySHA256)throw Error('Plan input differs from user original');
const assetCopyChecks=[];
for(const [dir,name] of [['rina_f_summer','Rina_F_Summer'],['charlotte','Charlotte']])for(const [kind,folder] of [['','characters'],['_effect','effects']]){
 const runtime=path.join(root,'game/public/assets',folder,name+kind);
 for(const dest of walk(runtime)){const source=path.join('C:/Users/Administrator/Desktop/新建文件夹 (3)',dir,path.basename(dest));const same=sha(source)===sha(dest);assetCopyChecks.push({runtime:path.relative(root,dest).replaceAll('\\','/'),source,same,sha256:sha(dest)});if(!same)throw Error('Source asset differs: '+source);}
}
fs.writeFileSync(path.join(__dirname,'source-fingerprint.json'),JSON.stringify({baseCommit:'5a930908f3008fd067feae2635790592fa651c8e',note:'Hashes identify tested source, tests and runtime assets; documentation-only publishing commits may follow. Protected originals were read only.',generatedAt:new Date().toISOString(),plan,protectedFiles,assetCopyChecks,files:rows},null,2));
console.log(JSON.stringify({sourceFiles:rows.length,assetCopies:assetCopyChecks.length,allOriginalCopiesMatch:true,planMatches:true}));
