import fs from 'node:fs/promises';
import path from 'node:path';
import * as core from '../dist/workshop.cjs';
const root=path.resolve('samples/StructureBands-N3/project'),assets=[],models=[];
const definitions=[['三级阶梯岩台','stairs'],['门洞与后墙','gate'],['混合精度与手绘','mixed'],['环形平台','ring']];
for(const [index,[name,kind]] of definitions.entries()){
 const a=core.createAsset('n3-'+kind);a.name=name;a.cells=[];
 if(kind==='stairs')for(let x=-8;x<8;x++)for(let y=-6;y<6;y++)for(let z=0;z<2+Math.floor((x+8)/6)*2;z++)a.cells.push({x,y,z,color:(Math.floor((x+8)/6)+1)%a.palette.length});
 if(kind==='gate')for(let x=-9;x<=9;x++)for(let y=0;y<5;y++)for(let z=0;z<14;z++)if(Math.abs(x)>3||z>=9||y===4)a.cells.push({x,y,z,color:0});
 if(kind==='ring')for(let x=-5;x<=5;x++)for(let y=-5;y<=5;y++)for(let z=0;z<2;z++)if(Math.abs(x)>2||Math.abs(y)>2)a.cells.push({x,y,z,color:0});
 if(kind==='mixed')for(let x=-4;x<0;x++)for(let y=-3;y<3;y++)for(let z=0;z<3;z++)a.cells.push({x,y,z,color:0});
 const m=core.upgradeCanvases(a,'n3-'+kind+'-asset'),c=m.canvases[0];m.name=name;c.canvasId='n3-'+kind+'-canvas';c.name='主体';c.originTicks=[-12,8,0];
 const object=(canvas,id)=>({objectId:id,name:canvas.name,canvasIds:[canvas.canvasId],originTicks:[...canvas.originTicks],cellKeys:canvas.cells.map(p=>[p.x,p.y,p.z].join(','))});
 m.objects=[object(c,'n3-'+kind+'-object')];
 if(kind==='mixed'){
  const small={...structuredClone(c),canvasId:'mixed-125',name:'0.125m 接合',voxelStepM:.125,cells:[],paintSource:undefined,faceTone:undefined};
  for(let x=0;x<4;x++)for(let y=-6;y<6;y++)for(let z=0;z<6;z++)small.cells.push({x,y,z,color:1});
  const fine={...structuredClone(small),canvasId:'mixed-0625',name:'0.0625m 接合',voxelStepM:.0625,cells:[]};
  for(let x=8;x<12;x++)for(let y=-12;y<12;y++)for(let z=0;z<12;z++)fine.cells.push({x,y,z,color:2});
  m.canvases.push(small,fine);m.objects.push(object(small,'n3-mixed-small'),object(fine,'n3-mixed-fine'));
  for(const canvas of m.canvases){const n=canvas.voxelStepM*64;canvas.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:{}};
   for(const p of canvas.cells){const neighbor=canvas.cells.some(q=>q.x===p.x&&q.y===p.y&&q.z===p.z+1);if(neighbor)continue;const pixels={};for(let v=2;v<n-2;v++)for(let u=2;u<n-2;u++)if((u+v)%4===0)pixels[v*n+u]='#ad9272';if(Object.keys(pixels).length)canvas.paintSource.faces[[p.x,p.y,p.z,4].join(',')]=pixels;}
  }
 }
 core.validateAsset(m);const source='assets/'+m.assetId+'/asset.xhmodule.json';await fs.mkdir(path.dirname(path.join(root,source)),{recursive:true});await fs.writeFile(path.join(root,source),JSON.stringify(m,null,2));
 assets.push({assetId:m.assetId,kind:'voxel',name,revision:m.revision,source,preview:null});models.push(m);
}
const scene=core.createScene('n3-practice');scene.schema='xinghai-workshop-scene-2';scene.name='自动结构描边原创练习';delete scene.assets;
scene.instances=models.map((m,i)=>({instanceId:'n3-practice-'+i,assetId:m.assetId,positionM:[i*7,0,0],rotationDeg:0,groupId:'base'}));
await fs.mkdir(path.join(root,'scenes/n3-practice'),{recursive:true});await fs.writeFile(path.join(root,'scenes/n3-practice/scene.xhscene.json'),JSON.stringify(scene,null,2));
await fs.writeFile(path.join(root,'project.xhproject.json'),JSON.stringify({schema:'xinghai-workshop-project-2',projectId:'n3-practice',revision:0,name:'结构描边与台阶边带',assets,scenes:[{sceneId:scene.sceneId,name:scene.name,source:'scenes/n3-practice/scene.xhscene.json',revision:0,preview:null}]},null,2));
console.log(root);
