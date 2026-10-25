import {layerStack,type LayerCommand} from '../core/paint-layers.ts';
import type {SurfacePaint} from '../core/surface-paint.ts';
/** Compact canvas-local layer inspector. Selection is UI state; commands enter author history. */
export class PaintLayersUI {
 private selected=new Map<string,string>();
 private canvasId='';
 private source:SurfacePaint|undefined;
 private stamp='';
 private thumbs=new Map<string,{canvas:HTMLCanvasElement;faces:SurfacePaint['faces']}>();
 private step=.25;
 constructor(private host:HTMLElement,private execute:(command:LayerCommand)=>Promise<void>,private select:()=>void,private message:(s:string)=>void){}
 get id(){const layers=layerStack(this.source),id=this.selected.get(this.canvasId);return layers.find(l=>l.id===id)?.id??layers.at(-1)!.id;}
 get writable(){const l=layerStack(this.source).find(l=>l.id===this.id)!;return l.visible&&!l.locked;}
 sync(canvasId:string,source?:SurfacePaint,step=this.step){
  this.step=step;
  this.canvasId=canvasId;this.source=source;
  const layers=layerStack(source),stamp=canvasId+this.id+JSON.stringify(layers.map(({faces,...meta})=>meta));
  if(stamp===this.stamp){for(const layer of layers){const thumb=this.thumbs.get(layer.id);if(thumb&&thumb.faces!==layer.faces){this.thumbnail(thumb.canvas,layer.faces);thumb.faces=layer.faces;}}return;}this.stamp=stamp;this.thumbs.clear();
  this.host.replaceChildren();
  const heading=document.createElement('h2');heading.textContent='绘图图层';this.host.append(heading);
  const list=document.createElement('div');list.id='paint-layer-list';
  for(const layer of [...layers].reverse()){
   const row=document.createElement('div');row.className='paint-layer-row';row.dataset.layerId=layer.id;row.dataset.active=String(layer.id===this.id);
   const visible=document.createElement('input');visible.type='checkbox';visible.checked=layer.visible;visible.title='显示图层';visible.setAttribute('aria-label','显示 '+layer.name);
   visible.onchange=()=>void this.run({kind:'visible',id:layer.id,value:visible.checked});
   const name=document.createElement('button');name.textContent=layer.name;name.title=layer.name;name.className='paint-layer-name';name.onclick=()=>{this.selected.set(this.canvasId,layer.id);this.select();this.stamp='';this.sync(this.canvasId,this.source);};
   const lock=document.createElement('button');lock.textContent=layer.locked?'锁':'○';lock.title=layer.locked?'解锁图层':'锁定图层';lock.setAttribute('aria-label',lock.title+' '+layer.name);lock.onclick=()=>void this.run({kind:'locked',id:layer.id,value:!layer.locked});
   const thumb=document.createElement('canvas');thumb.width=thumb.height=32;thumb.className='paint-layer-thumb';thumb.title='笔迹预览（首个绘图面）';this.thumbnail(thumb,layer.faces);this.thumbs.set(layer.id,{canvas:thumb,faces:layer.faces});
   row.append(visible,thumb,name,lock);list.append(row);
  }
  const actions=document.createElement('div');actions.className='paint-layer-actions';
  for(const [kind,label] of [['add','新建'],['duplicate','复制层'],['up','上移'],['down','下移'],['merge','向下合并'],['delete','删除']] as const){
   const b=document.createElement('button');b.textContent=label;b.id='paint-layer-'+kind;
   b.onclick=()=>{const newId=crypto.randomUUID();void this.run({kind,id:kind==='add'?newId:this.id,newId,name:'图层 '+(layers.length+1)},kind==='add'||kind==='duplicate'?newId:undefined);};actions.append(b);
  }
  const name=document.createElement('input');name.id='paint-layer-rename';name.value=layers.find(l=>l.id===this.id)!.name;name.setAttribute('aria-label','图层名称');name.maxLength=80;name.onchange=()=>void this.run({kind:'rename',id:this.id,name:name.value});
  this.host.append(list,name,actions);
 }
 private thumbnail(canvas:HTMLCanvasElement,faces:SurfacePaint['faces']){const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,32,32);const face=Object.values(faces)[0],n=this.step*64;if(face)for(const [i,color] of Object.entries(face)){ctx.fillStyle=color;ctx.fillRect((Number(i)%n)*32/n,Math.floor(Number(i)/n)*32/n,32/n,32/n);}}
 private async run(command:LayerCommand,selected?:string){
  try{await this.execute(command);if(selected)this.selected.set(this.canvasId,selected);this.select();}
  catch(e){this.message((e as Error).message);}
  this.stamp='';this.sync(this.canvasId,this.source);
 }
}
