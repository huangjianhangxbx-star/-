import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAsset} from '../core/workshop-documents.ts';
import {CanvasSession,upgradeCanvases} from '../core/workshop-canvases.ts';
import {PaintLeaseAuthority} from '../desktop/paint-session-contract.ts';
import {PaintCommandQueue} from '../desktop/paint-command-queue.ts';
import {composeLayers} from '../core/paint-layers.ts';
import {StructureEdgeDomain} from '../core/structure-edge-domain.ts';
import {edgeBandLayerSignature} from '../core/edge-band-plan.ts';
import type {SurfacePaint} from '../core/surface-paint.ts';

const options={preset:'side',geometry:'asset',scope:'all',sideWidth:2,topWidth:1,sideColor:'#123456',topColor:'#654321',colorMode:'color',gain:0.65,faces:[0,1,2,3,4,5],placement:'below'} as const;
function setup(paintSource?:SurfacePaint){
 const asset=createAsset('edge-band-lease');asset.cells=[{x:0,y:0,z:0,color:0},{x:2,y:0,z:0,color:0}];
 if(paintSource)asset.paintSource=paintSource;
 const session=new CanvasSession(asset),owner=session.model.objects![0];session.setEditObject(owner.objectId);
 const authority=new PaintLeaseAuthority(session,'edge-session',owner.objectId,()=>{});
 return {session,authority};
}
function command(f:ReturnType<typeof setup>,patch:any={}){
 return {leaseId:f.authority.leaseId,commandId:crypto.randomUUID(),baseRevision:f.session.model.revision,paintProtocol:1,kind:'outline',options:{...options},layerIds:['edge'],geometryFingerprint:new StructureEdgeDomain(f.session.model,f.authority.objectId).fingerprint,...patch};
}

test('outline queue holds its local preview while the parameter-only command awaits authority',async()=>{
 const f=setup(),start=f.authority.snapshot();let release!:(value:unknown)=>void;let sent:any;
 const q=new PaintCommandQueue(start,input=>{sent=input;return new Promise(resolve=>{release=resolve;});},()=>{});
 const preview=composeLayers([{id:'generated',name:'结构描边',visible:true,locked:false,faces:{'0,0,0,0':{'0':'#123456'}}}]);
 const pending=(q as any).outline(options,['generated'],'geometry',undefined,preview);
 assert.deepEqual(q.source(),preview);assert.equal(q.pending,1);
 assert.equal(sent.kind,'outline');assert.deepEqual(sent.options,options);assert.deepEqual(sent.layerIds,['generated']);
 assert.equal('source' in sent,false);assert.equal('previewSource' in sent,false);
 const model=structuredClone(start.model);model.revision++;model.canvases![0].paintSource=preview;
 release({...start,model,sequence:start.sequence+1,change:'paint'});await pending;
 assert.deepEqual(q.source(),preview);assert.equal(q.pending,0);f.authority.release();
});

test('ordinary paint cannot enter the queue while an atomic outline is awaiting confirmation',async()=>{
 const f=setup(),snapshot=f.authority.snapshot();let release!:(value:unknown)=>void;
 const queue=new PaintCommandQueue(snapshot,()=>new Promise(resolve=>{release=resolve;}),()=>{});
 const pending=queue.outline({...options,faces:[...options.faces]},['edge'],'geometry');
 const attempt=queue.paint(queue.source(),{schema:'xinghai-surface-paint-1',density:64,faces:{'0,0,0,4':{'0':'#abcdef'}}});
 assert.equal(queue.pending,1,'a stroke must not be appended behind frozen generated pixels');
 release({...snapshot,sequence:snapshot.sequence+1,change:'paint'});await pending;
 await assert.rejects(attempt,/结构描边.*确认|等待.*结构/);assert.equal(queue.pending,0);f.authority.release();
});

test('outline authority rejects a stale geometry plan without making an empty layer or history item',async()=>{
 const f=setup(),before=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch({leaseId:f.authority.leaseId,commandId:'stale-geometry',baseRevision:f.session.model.revision,paintProtocol:1,kind:'outline',options,layerIds:['edge'],geometryFingerprint:'old-geometry'}),/几何.*过期|几何.*变化/);
 assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);f.authority.release();
});

test('side and top bands commit as one paint history item and preserve every original including hidden foreign paint',async()=>{
 const originals=[{id:'hidden',name:'其他物体的隐藏原稿',visible:false,locked:true,faces:{'2,0,0,4':{'0':'#abcdef'}}},{id:'hand',name:'手绘',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ff0000'}}}];
 const f=setup(composeLayers(originals)),before=structuredClone(f.session.model),cells=f.session.active.cells;
 const reply=await f.authority.dispatch(command(f,{options:{...options,preset:'both'},layerIds:['side','top']}));
 assert.equal(reply.change,'paint');assert.equal(f.session.model.revision,before.revision+1);assert.equal(f.session.past.length,1);assert.equal(f.session.active.cells,cells);
 const layers=f.session.active.paintSource!.layers!;assert.equal(layers.length,4);assert.deepEqual(layers.slice(2),originals);
 assert.equal(layers[0].id,'side');assert.equal(layers[1].id,'top');
 assert.equal(Object.values(layers[0].faces).reduce((sum,p)=>sum+Object.keys(p).length,0),128);
 assert.equal(Object.values(layers[1].faces).reduce((sum,p)=>sum+Object.keys(p).length,0),60);
 assert.ok(layers.slice(0,2).every(l=>Object.keys(l.faces).every(k=>k.startsWith('0,0,0,'))));
 assert.equal(f.session.active.paintSource!.faces['0,0,0,4']['0'],'#ff0000');
 assert.deepEqual(f.session.model.anchorM,before.anchorM);
 await f.authority.dispatch({leaseId:f.authority.leaseId,commandId:'undo-both',baseRevision:f.session.model.revision,kind:'undo'});
 assert.deepEqual(f.session.active.paintSource,before.canvases![0].paintSource);assert.equal(f.session.past.length,0);f.authority.release();
});

test('outline ACK loss retries the exact command and never adds a second generated layer or history item',async()=>{
 const f=setup();let lose=true;const sent:any[]=[];
 const queue=new PaintCommandQueue(f.authority.snapshot(),async input=>{sent.push(structuredClone(input));const reply=await f.authority.dispatch(input);if(lose){lose=false;throw Error('lost ACK');}return reply;},()=>{});
 const fingerprint=new StructureEdgeDomain(f.session.model,f.authority.objectId).fingerprint;
 await assert.rejects(queue.outline({...options,faces:[...options.faces]},['edge'],fingerprint),/lost ACK/);
 assert.equal(f.session.past.length,1);assert.equal(f.session.active.paintSource!.layers!.length,2);
 await queue.retry();assert.deepEqual(sent[0],sent[1]);assert.equal(f.session.past.length,1);assert.equal(f.session.active.paintSource!.layers!.length,2);
 assert.deepEqual(queue.source(),f.session.active.paintSource);f.authority.release();
});

test('combined layer capacity failure rejects both bands atomically without migration or source edits',async()=>{
 const f=setup(composeLayers(Array.from({length:31},(_,i)=>({id:'hand'+i,name:'手绘'+i,visible:i%2===0,locked:i%3===0,faces:{}})))),before=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch(command(f,{options:{...options,preset:'both'},layerIds:['side','top']})),/32.*层|图层.*预算/);
 assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);f.authority.release();
});

test('empty masks and masks outside the target never create a layer or fall back to the whole target',async()=>{
 const f=setup(),before=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch(command(f,{options:{...options,scope:'selection',selection:[]}})),/没有.*像素|无.*结果/);
 await assert.rejects(f.authority.dispatch(command(f,{options:{...options,scope:'selection',selection:['2,0,0,4:0']}})),/超出.*物体/);
 await assert.rejects(f.authority.dispatch(command(f,{options:{...options,scope:'selection',selection:['0,0,0,4:256']}})),/像素/);
 assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);f.authority.release();
});

test('a local selection clips bands to the exact selected texels and does not create an artificial mask border',async()=>{
 const f=setup();
 await f.authority.dispatch(command(f,{options:{...options,preset:'top',scope:'selection',selection:['0,0,0,4:0','0,0,0,4:17']}}));
 assert.deepEqual(f.session.active.paintSource!.layers![0].faces,{'0,0,0,4':{'0':'#654321'}});f.authority.release();
});

test('safe replacement shrinks the same group while a hand repair, reorder or lock rejects with zero writes',async()=>{
 const f=setup();await f.authority.dispatch(command(f));
 const source=f.session.active.paintSource!,signature=edgeBandLayerSignature(source,['edge']);
 await f.authority.dispatch(command(f,{options:{...options,sideWidth:1},replace:{ids:['edge'],signature}}));
 assert.equal(f.session.active.paintSource!.layers!.length,2);assert.equal(Object.values(f.session.active.paintSource!.layers![0].faces).reduce((sum,p)=>sum+Object.keys(p).length,0),64);
 const signature2=edgeBandLayerSignature(f.session.active.paintSource,['edge']),history=f.session.past.length;
 await f.authority.dispatch(command(f,{options:{...options,sideWidth:1},replace:{ids:['edge'],signature:signature2}}));
 assert.equal(f.session.past.length,history);
 await f.authority.dispatch({leaseId:f.authority.leaseId,commandId:'repair',baseRevision:f.session.model.revision,kind:'paint',paintProtocol:1,layerId:'edge',delta:[{key:'0,0,0,0',index:'240',color:'#ffffff'}]});
 const repaired=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch(command(f,{replace:{ids:['edge'],signature:signature2}})),/已修改|改变/);assert.deepEqual(f.session.model,repaired);
 await f.authority.dispatch({leaseId:f.authority.leaseId,commandId:'lock',baseRevision:f.session.model.revision,kind:'layer',operation:{kind:'locked',id:'edge',value:true}});
 const locked=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch(command(f,{replace:{ids:['edge'],signature:edgeBandLayerSignature(f.session.active.paintSource,['edge'])}})),/锁定/);assert.deepEqual(f.session.model,locked);f.authority.release();
});

test('replacement cannot clear foreign pixels hidden inside a claimed shared layer',async()=>{
 const f=setup(composeLayers([{id:'shared',name:'手绘与生成混合',visible:true,locked:false,faces:{'0,0,0,0':{'240':'#123456'},'2,0,0,4':{'0':'#abcdef'}}}])),before=structuredClone(f.session.model);
 await assert.rejects(f.authority.dispatch(command(f,{replace:{ids:['shared'],signature:edgeBandLayerSignature(f.session.active.paintSource,['shared'])}})),/超出.*物体/);
 assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);f.authority.release();
});

test('outline parameters reject arbitrary layer JSON, unknown options and stale revisions before writing',async()=>{
 const f=setup(),before=structuredClone(f.session.model);
 for(const patch of [{source:composeLayers([])},{layers:[]},{options:{...options,arbitrary:true}},{options:{...options,sideWidth:0}},{options:{...options,sideColor:'black'}},{layerIds:['edge','edge']},{baseRevision:-1},{paintProtocol:2}])await assert.rejects(f.authority.dispatch(command(f,patch)));
 assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);f.authority.release();
});

test('releasing the writer invalidates an already dispatched outline and leaves no raw migration',async()=>{
 const f=setup(),before=structuredClone(f.session.model),pending=f.authority.dispatch(command(f));f.authority.release();
 await assert.rejects(pending,/失效/);assert.deepEqual(f.session.model,before);assert.equal(f.session.past.length,0);
});

test('hidden or reordered generated layers invalidate the saved replacement condition',async()=>{
 for(const operation of [{kind:'visible',id:'edge',value:false},{kind:'up',id:'edge'}]){
  const f=setup();await f.authority.dispatch(command(f));const signature=edgeBandLayerSignature(f.session.active.paintSource,['edge']);
  await f.authority.dispatch({leaseId:f.authority.leaseId,commandId:crypto.randomUUID(),baseRevision:f.session.model.revision,kind:'layer',operation});
  const before=structuredClone(f.session.model);
  await assert.rejects(f.authority.dispatch(command(f,{replace:{ids:['edge'],signature}})),/修改|改变/);
  assert.deepEqual(f.session.model,before);f.authority.release();
 }
});

test('hidden paint in another canvas still consumes the whole asset budget and an outline failure is atomic',async()=>{
 const asset=createAsset('whole-asset-budget');asset.cells=[{x:0,y:0,z:0,color:0}];const model=upgradeCanvases(asset,'first');
 const other=structuredClone(model.canvases![0]);other.canvasId='other';other.name='隐藏原稿';other.originTicks=[0,64,0];other.visible=false;other.locked=true;
 other.cells=Array.from({length:1024},(_,x)=>({x,y:0,z:0,color:0}));
 const pixels=Object.fromEntries(Array.from({length:256},(_,i)=>[i,'#abcdef']));
 other.paintSource=composeLayers([{id:'hidden',name:'隐藏的大图层',visible:false,locked:true,faces:Object.fromEntries(other.cells.map(c=>[c.x+',0,0,4',{...pixels}]))}]);
 model.canvases!.push(other);const session=new CanvasSession(model);session.setEditObject(session.model.objects!.find(o=>o.canvasIds[0]===session.activeId)!.objectId);
 const authority=new PaintLeaseAuthority(session,'budget-session',session.editObjectId!,()=>{}),f={session,authority},before=structuredClone(session.model);
 await assert.rejects(authority.dispatch(command(f)),/资产预算/);
 assert.deepEqual(session.model,before);assert.equal(session.past.length,0);authority.release();
});
