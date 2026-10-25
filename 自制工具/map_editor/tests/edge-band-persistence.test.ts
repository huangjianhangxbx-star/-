import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,createScene,validateAsset,type AssetDocument} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {StructureEdgeDomain} from '../core/structure-edge-domain.ts';
import {generateEdgeBands,applyEdgeBands,type EdgeBandOptions} from '../core/edge-band-plan.ts';
import {mergeSceneInstances} from '../core/scene-join.ts';
import {cloneAsset} from '../core/asset-copy.ts';
import {layerCommand} from '../core/paint-layers.ts';

const options:EdgeBandOptions={preset:'both',geometry:'asset',scope:'all',sideWidth:2,topWidth:1,sideColor:'#203d59',topColor:'#c7b19a',colorMode:'color',gain:.55,faces:[0,1,2,3,4,5],placement:'below'};
function fixture(step=.25){
 const a=createAsset('n3-persistence');a.cells=[];for(let x=0;x<3;x++)for(let y=0;y<2;y++)for(let z=0;z<3-x;z++)a.cells.push({x,y,z,color:0});
 const s=new CanvasSession(a),c=s.active;c.voxelStepM=step;s.model.objects=[{objectId:'stairs',name:'Stairs',canvasIds:[c.canvasId],originTicks:[0,0,0],cellKeys:c.cells.map(v=>`${v.x},${v.y},${v.z}`)}];
 c.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:{}};
 const d=new StructureEdgeDomain(s.model,'stairs'),plan=generateEdgeBands(d,options,c.paintSource);c.paintSource=applyEdgeBands(c.paintSource,plan,{ids:['n3-side','n3-top']});
 c.paintSource=layerCommand(c.paintSource,{kind:'add',id:'hidden-detail',name:'Hidden hand correction'});
 const hidden=c.paintSource.layers!.find(l=>l.id==='hidden-detail')!;hidden.faces={'0,0,2,4':{'0':'#a127ed'}};hidden.visible=false;hidden.locked=true;
 return new CanvasSession(validateAsset(s.model));
}
type Sample={id:string;name:string;visible:boolean;locked:boolean;point:number[];face:number;color:string};
function samples(model:AssetDocument,only?:ReadonlySet<string>):Sample[]{
 const out:Sample[]=[];
 for(const c of model.canvases??[]){const n=c.voxelStepM*64,origin=c.originTicks.map(v=>v*2);
  for(const layer of c.paintSource?.layers??[])for(const [key,pixels] of Object.entries(layer.faces)){
   const p=key.split(',').map(Number),face=p[3],axis=face>>1,t=[0,1,2].filter(a=>a!==axis);if(only&&!only.has(p.slice(0,3).join(',')))continue;
   for(const [index,color] of Object.entries(pixels)){
    const u=Number(index)%n,v=Math.floor(Number(index)/n),point=p.slice(0,3).map((q,a)=>(origin[a]+q*n)*2);point[axis]+=(face%2?0:n*2);point[t[0]]+=u*2+1;point[t[1]]+=v*2+1;
    out.push({id:layer.id,name:layer.name,visible:layer.visible,locked:layer.locked,point,face,color});
   }
  }
 }
 return out;
}
const normalized=(items:Sample[])=>items.map(p=>JSON.stringify(p)).sort();
const translated=(items:Sample[],delta:number[])=>items.map(p=>({...p,point:p.point.map((v,a)=>v+delta[a])}));
const rotated=(items:Sample[])=>items.map(p=>({...p,point:[-p.point[1],p.point[0],p.point[2]],face:[2,3,1,0,4,5][p.face]}));

test('N3 layers save/reopen as ordinary author source with hidden corrections and independent clone identity',()=>{
 const s=fixture(),before=structuredClone(s.model),reopened=new CanvasSession(validateAsset(JSON.parse(JSON.stringify(s.model))));
 assert.deepEqual(reopened.model.canvases,s.model.canvases);assert.deepEqual(reopened.model.objects,s.model.objects);
 assert.deepEqual(cloneAsset(s.model,'n3-copy').canvases,s.model.canvases);assert.deepEqual(s.model,before);
 const hidden=reopened.active.paintSource!.layers!.find(l=>l.id==='hidden-detail')!;assert.equal(hidden.visible,false);assert.equal(hidden.locked,true);assert.equal(hidden.faces['0,0,2,4']['0'],'#a127ed');
});

test('N3 raw layer texels move and rotate in exact author coordinates at all three precisions',()=>{
 for(const step of [.25,.125,.0625]){
  const s=fixture(step),before=samples(s.model),geometry=structuredClone(s.active.cells),history=s.past.length;
  s.moveObjects(['stairs'],[16,-8,8]);assert.deepEqual(normalized(samples(s.model)),normalized(translated(before,[64,-32,32])));s.undo();
  assert.deepEqual(normalized(samples(s.model)),normalized(before));s.rotateObjects(['stairs'],2,1);
  assert.deepEqual(normalized(samples(s.model)),normalized(rotated(before)));
  for(let i=0;i<3;i++)s.rotateObjects(['stairs'],2,1);
  assert.deepEqual(normalized(samples(s.model)),normalized(before));assert.deepEqual(s.active.cells.map(v=>JSON.stringify(v)).sort(),geometry.map(v=>JSON.stringify(v)).sort());assert.ok(s.past.length>history);
 }
});

test('N3 object clipboard preserves every layer and leaves source owner texels intact',()=>{
 const s=fixture(),before=samples(s.model),sourceKeys=new Set(s.model.objects![0].cellKeys),clip=s.copyObjects(['stairs']),ids=s.pasteObjects(clip);
 assert.equal(ids.length,1);assert.notEqual(ids[0],'stairs');const copy=s.model.objects!.find(o=>o.objectId===ids[0])!,copyKeys=new Set(copy.cellKeys);
 assert.deepEqual(normalized(samples(s.model,sourceKeys)),normalized(before));
 const offset=Number(copy.cellKeys![0].split(',')[0])*32;assert.deepEqual(normalized(samples(s.model,copyKeys)),normalized(translated(before,[offset,0,0])));
 const after=structuredClone(s.model.canvases);s.undo();assert.deepEqual(normalized(samples(s.model)),normalized(before));s.redo();assert.deepEqual(s.model.canvases,after);
});

test('N3 compatible canvas merge retains world-space source texels and hidden ordinary layers',()=>{
 const s=fixture(),first=s.activeId;s.duplicate();s.patch({originTicks:[32,0,0]});const second=s.activeId,before=samples(s.model),count=s.active.cells.length*2;
 s.mergeCanvases([first,second],first);assert.equal(s.model.canvases!.length,1);assert.equal(s.active.cells.length,count);assert.deepEqual(normalized(samples(s.model)),normalized(before));
 s.undo();assert.equal(s.model.canvases!.length,2);assert.deepEqual(normalized(samples(s.model)),normalized(before));
});

test('N3 legal scene join preserves generated and hidden texels through translated and rotated instances',()=>{
 const a=fixture().model,b=cloneAsset(a,'stairs-b'),scene=createScene('n3-join');
 scene.assets=[a,b].map(v=>({kind:'voxel' as const,assetId:v.assetId,source:`assets/${v.assetId}.xhmodule.json`}));
 scene.instances=[{instanceId:'a',assetId:a.assetId,positionM:[0,0,0],rotationDeg:0,groupId:'base'},{instanceId:'b',assetId:b.assetId,positionM:[1,1,0],rotationDeg:90,groupId:'base'}];
 const before=JSON.stringify([a,b,scene]),expected=[...samples(a),...translated(rotated(samples(b)),[128,128,0])];
 const result=mergeSceneInstances(scene,new Map([[a.assetId,a],[b.assetId,b]]),['a','b'],'n3-joined','joined');
 const delta=result.instance.positionM.map((v,i)=>(v-result.asset.anchorM[i])*128),actual=translated(samples(result.asset),delta);
 assert.deepEqual(normalized(actual),normalized(expected));assert.equal(result.asset.canvases!.reduce((n,c)=>n+c.cells.length,0),24);assert.equal(JSON.stringify([a,b,scene]),before);
});
