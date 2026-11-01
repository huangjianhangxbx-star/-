import {planVoxelExtrude,applyVoxelExtrude,type VoxelExtrudePlan} from '../core/voxel-extrude.ts';
import {VoxelSelection,voxelKey,type SelectionCell} from '../core/voxel-selection.ts';
import type {CanvasSession} from '../core/workshop-canvases.ts';
import type {AssetDocument} from '../core/workshop-documents.ts';
import {editingOperationAssetPreview} from './editing-asset-preview.ts';

export type VoxelExtrudeToolOptions={
 host:HTMLElement;canvas:HTMLCanvasElement;
 context:()=>{session:CanvasSession;selection:VoxelSelection}|null;
 prepare:()=>void;preview:(model:AssetDocument|null,selection:SelectionCell[]|null)=>void;
 commit:(plan:VoxelExtrudePlan)=>void|Promise<void>;message:(text:string,error?:boolean)=>void;
};
type Token={session:CanvasSession;model:AssetDocument;canvasId:string;objectId:string;selection:VoxelSelection;blocked:Set<string>};
const directions=['+X','−X','+Y','−Y','+Z','−Z'];
// Compare the frozen selection exactly without sorting/stringifying a large
// voxel set on every pointer move. Equal sets may have a different row order.
function sameSelection(a:VoxelSelection,b:VoxelSelection){if(a.count!==b.count)return false;for(const[key,c]of a.snapshot){const old=b.snapshot.get(key);if(!old||c.x!==old.x||c.y!==old.y||c.z!==old.z||c.color!==old.color||c.owner!==old.owner)return false;}return true;}
/** Boundary growth/cropping of an edit selection; source edits happen only on commit. */
export class VoxelExtrudeTool {
 private options:VoxelExtrudeToolOptions;private token:Token|null=null;private plan:VoxelExtrudePlan|null=null;
 private face=4;private steps=0;private busy=false;private disposed=false;private generation=0;
 private lastPointer:{x:number;y:number}|null=null;private pointer:{x:number;steps:number}|null=null;
 private press:{id:number;x:number;y:number;moved:boolean}|null=null;
 private root:HTMLDivElement|null=null;private status:HTMLElement|null=null;private input:HTMLInputElement|null=null;private confirm:HTMLButtonElement|null=null;private buttons=new Map<number,HTMLButtonElement>();
 constructor(options:VoxelExtrudeToolOptions){
  this.options=options;const c=options.canvas;c.addEventListener('pointermove',this.move,true);c.addEventListener('pointerdown',this.down,true);c.addEventListener('pointerup',this.up,true);c.addEventListener('pointercancel',this.abort,true);c.addEventListener('pointerleave',this.leave,true);c.ownerDocument.addEventListener('keydown',this.key,true);c.ownerDocument.defaultView?.addEventListener('blur',this.abort);
 }
 get active(){return !this.disposed&&this.token!==null;}
 start(){
  if(this.disposed)return false;if(this.active)return true;
  try{
   const context=this.options.context();if(!context||!context.selection.count)throw Error('请先在编辑模式选择需要拉伸的体素');
   const {session}=context,objectId=session.editObjectId;if(!objectId)throw Error('请先进入物体编辑模式');
   if(session.writeLeased)throw Error('请先关闭贴图绘制窗口，再拉伸体素');session.editable();
   const object=session.model.objects!.find(o=>o.objectId===objectId);if(!object||!object.canvasIds.includes(session.activeId))throw Error('物体编辑范围已变化');
   const owned=new Set(object.cellKeys),blocked=new Set(session.active.cells.filter(c=>!owned.has(voxelKey(c))).map(voxelKey)),selection=new VoxelSelection();selection.replace(context.selection.snapshot.values());
   const model=session.model,canvasId=session.activeId,preflight=planVoxelExtrude(session.editor,selection,4,0,blocked);
   this.options.prepare();const current=this.options.context();if(!current||current.session!==session||current.session.model!==model||current.session.activeId!==canvasId||current.session.editObjectId!==objectId||!sameSelection(current.selection,selection))throw Error('拉伸范围已变化，请重新选择体素');
   this.token={session,model,canvasId,objectId,selection,blocked};this.face=4;this.steps=0;this.busy=false;this.pointer=this.lastPointer?{x:this.lastPointer.x,steps:0}:null;
   this.mount(object.name);this.show(preflight);this.options.message('边界拉伸：选择方向，正格向外堆积、负格从该端裁减；左键确认，Esc 取消');return true;
  }catch(error){this.options.message(this.error(error),true);return false;}
 }
 private mount(name:string){
  const doc=this.options.canvas.ownerDocument,root=doc.createElement('div');root.className='voxel-extrude-tool';root.dataset.voxelExtrudeToolbar='';root.setAttribute('role','group');root.setAttribute('aria-label','选区边界拉伸');
  Object.assign(root.style,{position:'absolute',left:'14px',bottom:'18px',zIndex:'35',display:'grid',gap:'7px',maxWidth:'calc(100% - 28px)',padding:'10px 12px',background:'var(--panel-primary, #252c32)',border:'1px solid var(--accent-main, #c6a56d)',borderRadius:'3px',boxShadow:'0 4px 18px #0006',color:'var(--text, #e6eef3)',fontSize:'12px',pointerEvents:'auto'});
  const title=doc.createElement('strong');title.textContent='边界拉伸 · '+name;root.append(title);const row=doc.createElement('div');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap'});
  directions.forEach((name,face)=>{const button=doc.createElement('button');button.type='button';button.textContent=name;button.dataset.voxelExtrudeFace=String(face);button.onclick=()=>{if(this.valid()&&!this.busy){this.face=face;this.pointer=null;this.render();}};this.buttons.set(face,button);row.append(button);});
  const label=doc.createElement('label');label.textContent='格数 ';const input=doc.createElement('input');input.id='voxel-extrude-steps';input.type='number';input.min='-8192';input.max='8192';input.step='1';input.value='0';input.setAttribute('aria-label','拉伸格数（正增加，负裁减）');Object.assign(input.style,{width:'64px',margin:'0'});input.oninput=()=>this.setSteps(Number(input.value));this.input=input;label.append(input);row.append(label);
  const confirm=doc.createElement('button');confirm.type='button';confirm.dataset.voxelExtrudeConfirm='';confirm.textContent='确认 · Enter';confirm.onclick=()=>void this.finish();this.confirm=confirm;const cancel=doc.createElement('button');cancel.type='button';cancel.dataset.voxelExtrudeCancel='';cancel.textContent='取消 · Esc';cancel.onclick=()=>{if(!this.busy){this.cancel();this.options.message('已取消拉伸，模型未改变');}};row.append(confirm,cancel);root.append(row);
  this.status=doc.createElement('span');this.status.setAttribute('role','status');root.append(this.status);const hint=doc.createElement('small');hint.textContent='内部体素保持原位；正数增加，负数从所选方向裁减。鼠标每 24 px / 左右键调整一格。';hint.style.color='var(--text-muted, #a1adb4)';root.append(hint);this.root=root;this.options.host.append(root);
 }
 private valid(){
  if(!this.active||!this.token)return false;const token=this.token;
  try{const context=this.options.context();if(context&&context.session===token.session&&context.session.model===token.model&&context.session.activeId===token.canvasId&&context.session.editObjectId===token.objectId&&sameSelection(context.selection,token.selection))return true;}catch{}
  this.cancel();this.options.message('编辑物体、画布或选区已变化，已取消拉伸预览',true);return false;
 }
 private render(){if(!this.valid()||!this.token)return;try{this.show(planVoxelExtrude(this.token.session.editor,this.token.selection,this.face,this.steps,this.token.blocked));}catch(error){this.plan=null;this.options.preview(null,null);if(this.status)this.status.textContent=this.error(error);this.sync();this.options.message(this.error(error),true);}}
 private show(plan:VoxelExtrudePlan){
  this.plan=plan;
  if(this.steps===0||plan.conflicts.length)this.options.preview(null,null);
  else{const token=this.token!,draft=editingOperationAssetPreview(token.session,editor=>applyVoxelExtrude(editor,plan,token.blocked));this.options.preview(draft.model,plan.destination);}
  const data=this.options.host.dataset;data.voxelExtrudeFace=String(this.face);data.voxelExtrudeSteps=String(this.steps);data.voxelExtrudeCount=String(plan.destination.length);
  if(this.status)this.status.textContent=plan.conflicts.length?`目标冲突 ${plan.conflicts.length} 格，原模型未改变`:`${plan.source.length} → ${plan.destination.length} 格 · 增加 ${plan.additions.length} / 裁减 ${plan.removals.length} · ${directions[this.face]} ${this.steps>0?'+':''}${this.steps}`;
  this.sync();
 }
 private sync(){
  for(const[face,button]of this.buttons){button.classList.toggle('active',face===this.face);button.setAttribute('aria-pressed',String(face===this.face));button.disabled=this.busy;}
  if(this.input){this.input.disabled=this.busy;if(this.options.canvas.ownerDocument.activeElement!==this.input)this.input.value=String(this.steps);}if(this.confirm)this.confirm.disabled=this.busy||this.steps===0||!this.plan||!!this.plan.conflicts.length;
  if(this.active){const data=this.options.host.dataset;data.voxelExtrudeFace=String(this.face);data.voxelExtrudeSteps=String(this.steps);if(!this.plan)data.voxelExtrudeCount='0';}
 }
 private setSteps(value:number){if(!this.valid()||this.busy)return;if(!Number.isSafeInteger(value)){this.plan=null;this.options.preview(null,null);if(this.status)this.status.textContent='请输入整数格数';this.sync();return;}const next=Math.max(-8192,Math.min(8192,value));if(next===this.steps&&this.plan)return;this.steps=next;this.render();}
 private consume(event:Event){event.preventDefault();event.stopImmediatePropagation();}
 private move=(event:PointerEvent)=>{this.lastPointer={x:event.clientX,y:event.clientY};if(!this.active||this.busy)return;if(event.buttons&6){this.pointer=null;return;}if(!this.valid())return;this.consume(event);if(this.press&&Math.hypot(event.clientX-this.press.x,event.clientY-this.press.y)>4)this.press.moved=true;if(!this.pointer){this.pointer={x:event.clientX,steps:this.steps};return;}this.setSteps(this.pointer.steps+Math.trunc((event.clientX-this.pointer.x)/24));};
 private down=(event:PointerEvent)=>{this.lastPointer={x:event.clientX,y:event.clientY};if(!this.active||event.button!==0||!this.valid())return;this.consume(event);if(this.busy)return;this.press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};try{this.options.canvas.setPointerCapture(event.pointerId);}catch{}};
 private up=(event:PointerEvent)=>{if(!this.active||event.button!==0||this.press?.id!==event.pointerId)return;this.consume(event);const click=!this.press.moved;this.release();this.pointer={x:event.clientX,steps:this.steps};if(click)void this.finish();};
 private leave=()=>{if(!this.press)this.pointer=null;};
 private key=(event:KeyboardEvent)=>{
  if(!this.active||event.defaultPrevented||event.isComposing)return;const target=event.target as HTMLElement|null,typing=!!target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])'),own=!!target&&!!this.root?.contains(target);if(typing&&!(own&&['Enter','Escape'].includes(event.key)))return;if(event.ctrlKey||event.metaKey||event.altKey||!['ArrowLeft','ArrowRight','Enter','Escape'].includes(event.key))return;this.consume(event);if(this.busy||!this.valid())return;if(event.key==='Escape'){this.cancel();this.options.message('已取消拉伸，模型未改变');}else if(event.key==='Enter')void this.finish();else{this.pointer=null;this.setSteps(this.steps+(event.key==='ArrowRight'?1:-1));}
 };
 private async finish(){
  if(this.busy||!this.valid())return;if(this.steps===0){this.cancel();this.options.message('格数为 0，模型未改变');return;}if(!this.plan||this.plan.conflicts.length)return;const plan=this.plan,generation=this.generation;this.busy=true;this.release();this.sync();try{await this.options.commit(plan);if(generation===this.generation)this.cancel();}catch(error){this.options.message(this.error(error),true);}finally{this.busy=false;if(this.active)this.sync();}
 }
 private release(){const press=this.press;this.press=null;if(press)try{if(this.options.canvas.hasPointerCapture(press.id))this.options.canvas.releasePointerCapture(press.id);}catch{}}
 private abort=()=>this.cancel();private error(error:unknown){return error instanceof Error?error.message:String(error);}
 cancel(){const active=this.token!==null;this.generation++;this.release();this.token=null;this.plan=null;this.pointer=null;this.root?.remove();this.root=null;this.status=null;this.input=null;this.confirm=null;this.buttons.clear();const data=this.options.host.dataset;delete data.voxelExtrudeFace;delete data.voxelExtrudeSteps;delete data.voxelExtrudeCount;if(active)this.options.preview(null,null);}
 dispose(){if(this.disposed)return;this.cancel();this.disposed=true;const c=this.options.canvas;c.removeEventListener('pointermove',this.move,true);c.removeEventListener('pointerdown',this.down,true);c.removeEventListener('pointerup',this.up,true);c.removeEventListener('pointercancel',this.abort,true);c.removeEventListener('pointerleave',this.leave,true);c.ownerDocument.removeEventListener('keydown',this.key,true);c.ownerDocument.defaultView?.removeEventListener('blur',this.abort);}
}
