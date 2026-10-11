import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {makeArtGrammar,compileArtDirected,artTemplateImages}=require('../grammar/art-directed.cjs');
const {validateArtCompilation}=require('../grammar/art-directed-validate.cjs');
const {makeGrammar,testScenes}=require('../grammar/catalog.cjs');
const {compileMaster,sha}=require('../grammar/compile.cjs');
const {validateCompilation}=require('../grammar/validate.cjs');
const put=(p,x,y,rgba)=>p.data.set(rgba,(y*p.width+x)*4);
/** Original synthetic paint. No game/AI/user PNG is read by this fixture. */
export function makeDiagnosticFixture(g){
 const c=g.cellPixels,stone=g.template.kind==='stone',materials=new PNG({width:g.master.width,height:g.master.height}),contour=new PNG({width:g.control.width,height:g.control.height});
 for(const [index,r] of g.master.patches.entries())for(let y=0;y<c;y++)for(let x=0;x<c;x++){
  const field=Math.floor(x/(c/3))===Math.floor(y/(c/3))?6:0;let rgb;
  if(index<4){
   rgb=stone?[105+index*7+field,110+index*5+field,100+index*6+field]:[75+index*12+field,116+index*8+field,58+index*5+field];
   // A small broad block tests genuine patch variation rather than pixel noise.
   if(x>c*(.24+index*.04)&&x<c*.6&&y>c*.28&&y<c*(.6+index*.03))rgb=rgb.map(v=>v+(stone?-13:10));
  }else if(index<6){
   const frame=x<2||y<2||x>=c-2||y>=c-2;
   rgb=frame?(stone?[91,96,86]:[88,121,65]):stone?[109+(index-4)*14,111+(index-4)*8,97]:[87+(index-4)*13,130-(index-4)*9,64];
   if(!frame&&((x>c*.2&&x<c*.32&&y>c*.15&&y<c*.6)||(x>c*.65&&x<c*.72&&y>c*.45)))rgb=rgb.map(v=>v-10);
  }else if(index===6)rgb=stone?[55+Math.floor(x/c*8),62,57]:[96,74+Math.floor(y/c*6),52];
  else rgb=stone?[29,35,32]:[38,49,31];
  put(materials,r.x+x,r.y+y,[...rgb,255]);
 }
 for(let y=0;y<c;y++)for(let x=0;x<2*c;x++){
  const v=Math.floor(x/c),xx=x%c,r=stone?70+v*65+Math.round(8*Math.cos(xx/c*Math.PI*2)):90+v*65+Math.round(35*Math.sin(xx/c*Math.PI*6)+20*Math.sin(y/c*Math.PI*4));
  const dark=stone?(y>c*.55&&xx<c*.65?110:0):(v&&y>c*.6?45:0);put(contour,x,y,[Math.max(0,Math.min(255,r)),dark,0,255]);
 }
 return {materials:PNG.sync.write(materials),contour:PNG.sync.write(contour),provenance:{kind:'synthetic/test-only',source:'original procedural diagnostic authored for 2DW-TILE-02',artApproval:'not-user-approved'}};
}
function oldFixture(g,newG,materials){
 const p=new PNG({width:g.master.width,height:g.master.height}),src=PNG.sync.read(materials),roles={surface:0,edge:4,underlay:6,accent:7},c=g.cellPixels;
 for(const panel of g.master.panels){const r=newG.master.patches[roles[panel.role]];for(let y=0;y<panel.height;y++)for(let x=0;x<panel.width;x++)put(p,panel.x+x,panel.y+y,[...src.data.subarray(((r.y+y%c)*src.width+r.x+x%c)*4,((r.y+y%c)*src.width+r.x+x%c)*4+4)]);}
 return PNG.sync.write(p);
}
export async function writeDiagnosticProof(output){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),allowed=path.join(root,'validation'),resolved=path.resolve(output);
 if(!resolved.startsWith(allowed+path.sep))throw Error('Diagnostic output must remain inside this workshop validation directory');
 const files=[],reports=[];
 const write=async(relative,bytes)=>{const dest=path.join(resolved,relative);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes,{flag:'wx'});files.push({path:relative.replaceAll('\\','/'),fileBytes:bytes.length,sha256:sha(bytes)});};
 for(const templateId of ['XH-GRASS-8COND-01','XH-STONE-EDGE-8COND-01']){
  const g=makeArtGrammar({templateId}),kind=g.template.kind,i=makeDiagnosticFixture(g),r=compileArtDirected(g,i),classicG=makeGrammar({templateId,masterPixels:1254}),classicBytes=oldFixture(classicG,g,i.materials),old=compileMaster(classicG,classicBytes);
  await write(`${kind}/materials.png`,i.materials);await write(`${kind}/contour.png`,i.contour);await write(`${kind}/grammar.json`,Buffer.from(JSON.stringify(g,null,2)));
  await write(`${kind}/atlas.png`,r.atlas);await write(`${kind}/underlay.png`,r.underlay);await write(`${kind}/classic-materials.png`,classicBytes);await write(`${kind}/classic-atlas.png`,old.atlas);
  for(const [name,bytes] of Object.entries(artTemplateImages(g)))await write(`${kind}/guides/${name}.png`,bytes);
  for(const t of r.tiles)await write(`${kind}/tiles/${t.id}.png`,t.png);
  for(const t of r.tileVariants)await write(`${kind}/variants/${t.id}-v${t.variant}.png`,t.png);
  const scenes={threeByThree:[[1,1,1],[1,1,1],[1,1,1]],...testScenes(),repeat16:Array.from({length:16},()=>Array(16).fill(1))},sceneReports=[];
  for(const [name,board] of Object.entries(scenes)){
   const newer=validateArtCompilation(g,r,board),older=validateCompilation(classicG,old,board);await write(`${kind}/scenes/${name}.png`,newer.preview);await write(`${kind}/classic-scenes/${name}.png`,older.preview);
   const {preview,...summary}=newer;sceneReports.push({name,...summary});
  }
  const sample=validateArtCompilation(g,r,[[1,1,0,1,1],[1,0,0,1,0],[0,0,0,0,0],[0,1,1,0,1],[0,1,1,0,0]],{underlay:true});await write(`${kind}/sample-test-only.png`,sample.preview);
  const repeat=sceneReports.find(s=>s.name==='repeat16').repeatDiagnostics;
  const report={templateId,provenance:i.provenance,inputHashes:r.inputHashes,grammarSha256:r.grammarSha256,patchSources:r.patchSources,sampling:r.sampling,compilerVersion:r.compilerVersion,classicCompilerVersion:old.compilerVersion,classicComparison:{fullCenterCells:196,uniqueClassicCenterOutputs:1,classicMostFrequentRatio:1,newUniqueCenterOutputs:repeat.uniqueCenterOutputs,newMostFrequentRatio:repeat.mostFrequentRatio,note:'Center PNG repetition only; does not quantify perceived tiling quality or declare art accepted'},scenes:sceneReports,sortingVerified:false,artAcceptance:'pending-human-review'};
  await write(`${kind}/report.json`,Buffer.from(JSON.stringify(report,null,2)));reports.push({kind,scenesPassed:sceneReports.filter(s=>s.passed).length,scenesTotal:sceneReports.length,repeat});
 }
 await write('SHA256.json',Buffer.from(JSON.stringify({schemaVersion:'2dw-tile02-diagnostic-fixtures/1',provenance:'synthetic/test-only',files,reports},null,2)));
 return {output:resolved,files:files.length,reports};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=process.argv[2]||path.join(root,'validation','2dw-tile02',`art-fixtures-${Date.now()}`);
 console.log(JSON.stringify(await writeDiagnosticProof(output),null,2));
}
