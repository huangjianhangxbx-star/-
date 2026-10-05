import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {EditorDocument} from '../core/document.ts';
import {EditOperationSession} from '../core/edit-operation.ts';
import {brushCandidates,applyBrush} from '../core/brush.ts';
const base={mode:'volume',action:'add',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:''};
const results=[];
for(const [name,size,thickness,rectangle] of [['small',1,1,false],['medium',17,4,false],['max-brush',33,4,false],['rectangle-4096',1,1,true]] as const){
 const c={...base,size,thickness},hit={x:0,y:0,z:0,face:4};
 const old=new EditorDocument();old.begin();let t=performance.now();
 if(rectangle){const seen=new Set<string>();for(let x=0;x<64;x++)for(let y=0;y<64;y++)applyBrush(old,brushCandidates(old,{...hit,x,y},c),c,seen);}
 else applyBrush(old,brushCandidates(old,hit,c),c);
 const previousApplyMs=performance.now()-t;old.cancel();
 const e=new EditorDocument(),s=new EditOperationSession(e);s.begin(c);t=performance.now();
 const p=rectangle?s.rectangle(hit,{...hit,x:63,y:63}):s.brush(hit);const planMs=performance.now()-t;t=performance.now();
 if(rectangle)await s.executeChunked(p);else s.apply(p);
 const applyOrChunkMs=performance.now()-t;s.commit();results.push({name,previousApplyMs,planMs,applyOrChunkMs,cells:e.cells.size});
}
await fs.mkdir('validation/workshop-operation',{recursive:true});await fs.writeFile('validation/workshop-operation/benchmark.json',JSON.stringify({environment:process.version,results},null,2));console.log(results);
