import type { SurfacePaint } from './surface-paint.ts';
export type PaintLayer = { id:string; name:string; visible:boolean; locked:boolean; faces:SurfacePaint['faces'] };
export type LayerCommand = {kind:'add'|'duplicate'|'rename'|'visible'|'locked'|'up'|'down'|'merge'|'delete';id:string;name?:string;value?:boolean;newId?:string};
export function layerStack(source?:SurfacePaint):PaintLayer[]{
 return source?.layers ?? [{id:'base',name:'原始绘图',visible:true,locked:false,faces:source?.faces??{}}];
}
export function composeLayers(layers:PaintLayer[]):SurfacePaint {
 const faces:SurfacePaint['faces']={};
 for(const layer of layers)if(layer.visible)for(const [key,pixels] of Object.entries(layer.faces))faces[key]={...faces[key],...pixels};
 return {schema:'xinghai-surface-paint-1',density:64,faces,layers};
}
export function layerSource(source:SurfacePaint|undefined,id:string):SurfacePaint {
 return {schema:'xinghai-surface-paint-1',density:64,faces:layerStack(source).find(l=>l.id===id)?.faces??{}};
}
export function editLayer(source:SurfacePaint|undefined,id:string,paint:SurfacePaint):SurfacePaint {
 const layers=layerStack(source),layer=layers.find(l=>l.id===id);
 if(!layer)throw Error('图层不存在');
 if(layer.locked||!layer.visible)throw Error('请先显示并解锁当前图层');
 // Existing one-layer assets keep their fast sparse author format until a layer operation.
 if(!source?.layers)return paint;
 const nextLayers=layers.map(l=>l.id===id?{...l,faces:paint.faces}:l),faces={...source.faces};
 // A stroke recomposes only touched faces; untouched texture references remain stable.
 for(const key of new Set([...Object.keys(layer.faces),...Object.keys(paint.faces)])){
  if(layer.faces[key]===paint.faces[key])continue;
  const pixels:Record<string,string>={};for(const l of nextLayers)if(l.visible)Object.assign(pixels,l.faces[key]);
  const old=source.faces[key];
  if(old&&Object.keys(old).length===Object.keys(pixels).length&&Object.keys(pixels).every(i=>old[i]===pixels[i]))continue;
  if(Object.keys(pixels).length)faces[key]=pixels;else delete faces[key];
 }
 return {...source,layers:nextLayers,faces};
}
export function layerCommand(source:SurfacePaint|undefined,command:LayerCommand):SurfacePaint {
 if(!command||typeof command!=='object'||typeof command.id!=='string'||!/^[\w-]{1,100}$/.test(command.id)||Object.keys(command).some(k=>!['kind','id','name','value','newId'].includes(k))||(command.name!==undefined&&typeof command.name!=='string')||(['visible','locked'].includes(command.kind)&&typeof command.value!=='boolean'))throw Error('图层命令无效');
 const layers=layerStack(source).map(l=>({...l})),i=layers.findIndex(l=>l.id===command.id),layer=layers[i];
 const name=(command.name??'新图层').trim().slice(0,80)||'新图层';
 if(command.kind==='add'){
  if(layers.length>=32||layers.some(l=>l.id===command.id))throw Error('图层数量或标识无效');
  layers.push({id:command.id,name,visible:true,locked:false,faces:{}});
 }else{
  if(!layer)throw Error('图层不存在');
  switch(command.kind){
   case 'rename':layer.name=name;break;
   case 'visible':layer.visible=!!command.value;break;
   case 'locked':layer.locked=!!command.value;break;
   case 'duplicate':
    if(layers.length>=32||!command.newId||layers.some(l=>l.id===command.newId))throw Error('图层数量或标识无效');
    layers.splice(i+1,0,{...layer,id:command.newId,name:(layer.name+' 副本').slice(0,80),faces:structuredClone(layer.faces)});break;
   case 'up':if(i<layers.length-1)[layers[i],layers[i+1]]=[layers[i+1],layers[i]];break;
   case 'down':if(i>0)[layers[i],layers[i-1]]=[layers[i-1],layers[i]];break;
   case 'delete':if(layer.locked)throw Error('图层已锁定');if(layers.length===1)throw Error('至少保留一个图层');layers.splice(i,1);break;
   case 'merge':{
    const below=layers[i-1];if(!below)throw Error('已经是最底层');
    if(layer.locked||below.locked)throw Error('请先解锁两个图层');
    if(!layer.visible||!below.visible)throw Error('隐藏图层请先显示再合并');
    layers[i-1]={...below,faces:composeLayers([below,layer]).faces};layers.splice(i,1);break;
   }
   default:throw Error('图层操作无效');
  }
 }
 return composeLayers(layers);
}
/** Preserve layer originals through geometry changes and clipboard operations. */
export function mapPaintLayers(source:SurfacePaint,transform:(p:SurfacePaint)=>SurfacePaint):SurfacePaint {
 if(!source.layers)return transform(source);
 return composeLayers(source.layers.map(l=>({...l,faces:transform({schema:source.schema,density:64,faces:l.faces}).faces})));
}
export function storedPaintFaces(source?:SurfacePaint){return source?.layers?.map(l=>l.faces)??[source?.faces??{}];}
export function paintSize(source?:SurfacePaint){return storedPaintFaces(source).reduce((n,faces)=>({faces:n.faces+Object.keys(faces).length,pixels:n.pixels+Object.values(faces).reduce((a,f)=>a+Object.keys(f).length,0)}),{faces:0,pixels:0});}
export function joinPaint(a:SurfacePaint|undefined,b:SurfacePaint|undefined):SurfacePaint|undefined {
 if(!a)return b;if(!b)return a;
 if(!a.layers&&!b.layers)return {...a,faces:{...a.faces,...b.faces}};
 const existing=layerStack(a),incoming=layerStack(b),ids=new Set(existing.map(l=>l.id));
 if(existing.length===incoming.length&&existing.every((l,i)=>{const r=incoming[i];return l.id===r.id&&l.name===r.name&&l.visible===r.visible&&l.locked===r.locked;}))return composeLayers(existing.map((l,i)=>({...l,faces:{...l.faces,...incoming[i].faces}})));
 return composeLayers([...existing,...layerStack(b).map(l=>({...l,id:ids.has(l.id)?crypto.randomUUID():l.id}))]);
}
