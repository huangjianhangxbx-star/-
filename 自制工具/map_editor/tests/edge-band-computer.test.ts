import test from 'node:test';import assert from 'node:assert/strict';
import {EdgeBandComputer} from '../desktop/edge-band-computer.ts';
import {validateEdgeBandOptions} from '../core/edge-band-plan.ts';
const base=validateEdgeBandOptions({preset:'side',geometry:'asset',scope:'all',sideWidth:2,topWidth:1,sideColor:'#123456',topColor:'#654321',colorMode:'color',gain:.65,faces:[0,1,2,3,4,5],placement:'below'});
test('worker preview keeps only one running and the latest requested width',async()=>{
 const sent:any[]=[];let worker:any;class FakeWorker{onmessage:any;onerror:any;constructor(){worker=this;}postMessage(value:any){sent.push(value);}terminate(){}}
 const oldWorker=globalThis.Worker,oldWindow=globalThis.window;Object.assign(globalThis,{Worker:FakeWorker,window:{location:{href:'file:///test/paint-workspace.html'}}});
 const computer=new EdgeBandComputer();
 try{
  const first=computer.plan(base),discarded=computer.plan({...base,sideWidth:3}).then(()=>false,e=>/替换|取消/.test(e.message)),last=computer.plan({...base,sideWidth:4});
  assert.equal(sent.length,1,'stale widths must not enter the worker queue');
  worker.onmessage({data:{id:sent[0].id,value:{pixelCount:1},elapsed:1}});await first;await new Promise(r=>setTimeout(r,0));assert.equal(sent.length,2);assert.equal(sent[1].options.sideWidth,4);
  worker.onmessage({data:{id:sent[1].id,value:{pixelCount:2},elapsed:1}});assert.equal((await last).value.pixelCount,2);assert.equal(await discarded,true);
 }finally{computer.dispose();Object.assign(globalThis,{Worker:oldWorker,window:oldWindow});}
});
