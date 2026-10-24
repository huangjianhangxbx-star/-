// Original practice inputs for the Workshop tool; no third-party image assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as core from '../dist/workshop.cjs';
const root=path.resolve('samples/RockShaping-TOOL011/project');
const assets=[];
for(const [id,name,w,d,h] of [['wall','柱状岩壁练习',24,18,30],['rim','层阶崖岸练习',32,28,20]]){
 const a=core.createAsset(id);a.schema='xinghai-workshop-asset-2';a.name=name;
 const cells=Array.from({length:w*d*h},(_,i)=>({x:i%w,y:Math.floor(i/w)%d,z:Math.floor(i/w/d),color:0}));
 a.palette[0]='#92969b';a.materialProfile.colors[0].baseColor_sRGB=[146,150,155].map(v=>v/255);
 a.canvases=[{canvasId:'body',name:'主体',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells,protectedColumns:[]}];
 a.objects=[{objectId:'rock-object',name,canvasIds:['body'],originTicks:[w*4,d*4,0],cellKeys:cells.map(c=>`${c.x},${c.y},${c.z}`)}];
 const source=`assets/${id}/asset.xhmodule.json`;await fs.mkdir(path.dirname(path.join(root,source)),{recursive:true});
 await fs.writeFile(path.join(root,source),JSON.stringify(core.validateAsset(a)));
 assets.push({assetId:id,kind:'voxel',name,revision:0,preview:null,source});
}
const scene={schema:'xinghai-workshop-scene-2',sceneId:'practice',revision:0,name:'岩体塑形练习',voxelSize:.25,
 instances:assets.map((a,i)=>({instanceId:'i-'+a.assetId,assetId:a.assetId,positionM:[i*12,0,0],rotationDeg:0,groupId:'base'})),groups:[{groupId:'base',name:'BASE',visible:true}],decals:[]};
const project={schema:'xinghai-workshop-project-2',projectId:'rock-practice',revision:0,name:'岩体塑形练习',assets,
 scenes:[{sceneId:scene.sceneId,name:scene.name,revision:0,preview:null,source:'scenes/practice/scene.xhscene.json'}]};
core.validateProjectV2(project);core.validateSceneV2(scene);
await fs.mkdir(path.join(root,'scenes/practice'),{recursive:true});await fs.writeFile(path.join(root,'scenes/practice/scene.xhscene.json'),JSON.stringify(scene));
await fs.writeFile(path.join(root,'project.xhproject.json'),JSON.stringify(project));
console.log('Original rock practice project: '+root);
