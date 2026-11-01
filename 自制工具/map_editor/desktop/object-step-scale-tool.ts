import {planObjectStepScale,type ObjectStepScaleAxis} from '../core/object-step-scale.ts';
import type {CanvasSession} from '../core/workshop-canvases.ts';
import type {AssetDocument} from '../core/workshop-documents.ts';

export type ObjectStepScaleToolOptions={
 host:HTMLElement;canvas:HTMLCanvasElement;
 context:()=>{session:CanvasSession;objectId:string}|null;
 prepare:()=>void;
 preview:(model:AssetDocument|null)=>void;
 commit:(objectId:string,axis:ObjectStepScaleAxis,steps:number)=>void|Promise<void>;
 message:(text:string,error?:boolean)=>void;
};
type Token={session:CanvasSession;objectId:string;model:AssetDocument};
type Plan=ReturnType<typeof planObjectStepScale>;
/** A modal object preview: source identity and geometry change only on confirmation. */
export class ObjectStepScaleTool {
 private options:ObjectStepScaleToolOptions;
 private token:Token|null=null;private plan:Plan|null=null;
 private axis:ObjectStepScaleAxis='xyz';private steps=0;private busy=false;private disposed=false;private generation=0;
 private lastPointer:{x:number;y:number}|null=null;private pointer:{x:number;steps:number}|null=null;
 private press:{id:number;x:number;y:number;moved:boolean}|null=null;
 private root:HTMLDivElement|null=null;private status:HTMLElement|null=null;private stepsInput:HTMLInputElement|null=null;private confirmButton:HTMLButtonElement|null=null;
 private axes=new Map<ObjectStepScaleAxis,HTMLButtonElement>();
 constructor(options:ObjectStepScaleToolOptions){
  this.options=options;const canvas=options.canvas;
  canvas.addEventListener('pointermove',this.move,true);canvas.addEventListener('pointerdown',this.down,true);canvas.addEventListener('pointerup',this.up,true);canvas.addEventListener('pointercancel',this.abort,true);canvas.addEventListener('pointerleave',this.leave,true);
  canvas.ownerDocument.addEventListener('keydown',this.key,true);canvas.ownerDocument.defaultView?.addEventListener('blur',this.abort);
 }
 get active(){return !this.disposed&&this.token!==null;}
 start(){
  if(this.disposed)return false;if(this.active)return true;
  try{
   const context=this.options.context();if(!context)throw Error('请在物体模式选择一个物体后缩放');
   const model=context.session.model,preflight=planObjectStepScale(model,context.objectId,'xyz',0);
   this.options.prepare();
   const current=this.options.context();if(!current||current.session!==context.session||current.objectId!==context.objectId||current.session.model!==model)throw Error('缩放范围已变化，请重新选择物体');
   this.token={...context,model};this.axis='xyz';this.steps=0;this.busy=false;this.pointer=this.lastPointer?{x:this.lastPointer.x,steps:0}:null;
   this.mount(model.objects?.find(o=>o.objectId===context.objectId)?.name??'物体');this.show(preflight);
   this.options.message('物体缩放：移动鼠标或左右键调整步数 · X/Y/Z 约束 · 左键确认 · Esc 取消');return true;
  }catch(error){this.options.message(this.error(error),true);return false;}
 }
 private mount(name:string){
  const doc=this.options.canvas.ownerDocument,root=doc.createElement('div');root.className='object-step-scale-tool';root.dataset.objectScaleToolbar='';root.setAttribute('role','group');root.setAttribute('aria-label','物体步进缩放');
  Object.assign(root.style,{position:'absolute',left:'14px',bottom:'18px',zIndex:'35',display:'grid',gap:'7px',maxWidth:'calc(100% - 28px)',padding:'10px 12px',background:'var(--panel-primary, #252c32)',border:'1px solid var(--accent-main, #c6a56d)',borderRadius:'3px',boxShadow:'0 4px 18px #0006',color:'var(--text, #e6eef3)',fontSize:'12px',pointerEvents:'auto'});
  const title=doc.createElement('strong');title.textContent='物体缩放 · '+name;root.append(title);
  const row=doc.createElement('div');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap'});
  for(const axis of ['x','y','z','xyz'] as const){const button=doc.createElement('button');button.type='button';button.textContent=axis.toUpperCase();button.dataset.objectScaleAxis=axis;button.onclick=()=>{if(this.valid()&&!this.busy){this.axis=axis;this.pointer=null;this.render();}};this.axes.set(axis,button);row.append(button);}
  const label=doc.createElement('label');label.textContent='每端步数 ';const input=doc.createElement('input');input.id='object-scale-steps';input.type='number';input.min='-8192';input.max='8192';input.step='1';input.value='0';input.setAttribute('aria-label','物体缩放每端步数');Object.assign(input.style,{width:'64px',margin:'0'});input.oninput=()=>this.setSteps(Number(input.value));label.append(input);row.append(label);this.stepsInput=input;
  const confirm=doc.createElement('button');confirm.type='button';confirm.dataset.objectScaleConfirm='';confirm.textContent='确认 · Enter';confirm.onclick=()=>void this.finish();this.confirmButton=confirm;
  const cancel=doc.createElement('button');cancel.type='button';cancel.dataset.objectScaleCancel='';cancel.textContent='取消 · Esc';cancel.onclick=()=>{if(!this.busy){this.cancel();this.options.message('已取消物体缩放，模型未改变');}};row.append(confirm,cancel);root.append(row);
  const status=doc.createElement('span');status.setAttribute('role','status');this.status=status;root.append(status);
  const hint=doc.createElement('small');hint.textContent='鼠标横移每 24 px 调整一格；左键确认，右键旋转、中键平移。';hint.style.color='var(--text-muted, #a1adb4)';root.append(hint);
  this.root=root;this.options.host.append(root);
 }
 private valid(){
  if(!this.active||!this.token)return false;
  try{const context=this.options.context();if(context&&context.session===this.token.session&&context.objectId===this.token.objectId&&context.session.model===this.token.model)return true;}catch{}
  this.cancel();this.options.message('物体或画布已变化，已取消缩放预览',true);return false;
 }
 private render(){
  if(!this.valid()||!this.token)return;
  try{this.show(planObjectStepScale(this.token.model,this.token.objectId,this.axis,this.steps));}
  catch(error){this.plan=null;this.options.preview(null);if(this.status)this.status.textContent=this.error(error);this.syncControls();this.options.message(this.error(error),true);}
 }
 private show(plan:Plan){
  this.plan=plan;this.options.preview(this.steps===0?null:plan.model);
  const data=this.options.host.dataset;data.objectScaleAxis=this.axis;data.objectScaleCount=String(plan.destinationCount);data.objectScaleSteps=String(this.steps);
  if(this.status)this.status.textContent=`${plan.before.join('×')} → ${plan.after.join('×')} 格 · ${plan.sourceCount} → ${plan.destinationCount} 体素`;
  this.syncControls();
 }
 private syncControls(){
  for(const[axis,button]of this.axes){button.classList.toggle('active',axis===this.axis);button.setAttribute('aria-pressed',String(axis===this.axis));button.disabled=this.busy;}
  if(this.stepsInput){this.stepsInput.disabled=this.busy;if(this.options.canvas.ownerDocument.activeElement!==this.stepsInput)this.stepsInput.value=String(this.steps);}
  if(this.confirmButton)this.confirmButton.disabled=this.busy||this.steps===0||!this.plan;
  if(this.active){this.options.host.dataset.objectScaleAxis=this.axis;this.options.host.dataset.objectScaleSteps=String(this.steps);if(!this.plan)this.options.host.dataset.objectScaleCount='0';}
 }
 private setSteps(value:number){
  if(!this.valid()||this.busy)return;
  if(!Number.isSafeInteger(value)){this.plan=null;this.options.preview(null);if(this.status)this.status.textContent='请输入整数步数';this.syncControls();return;}
  const next=Math.max(-8192,Math.min(8192,value));if(next===this.steps&&this.plan)return;this.steps=next;this.render();
 }
 private consume(event:Event){event.preventDefault();event.stopImmediatePropagation();}
 private move=(event:PointerEvent)=>{
  this.lastPointer={x:event.clientX,y:event.clientY};if(!this.active||this.busy)return;
  if(event.buttons&6){this.pointer=null;return;}if(!this.valid())return;this.consume(event);
  if(this.press&&Math.hypot(event.clientX-this.press.x,event.clientY-this.press.y)>4)this.press.moved=true;
  if(!this.pointer){this.pointer={x:event.clientX,steps:this.steps};return;}
  this.setSteps(this.pointer.steps+Math.trunc((event.clientX-this.pointer.x)/24));
 };
 private down=(event:PointerEvent)=>{
  this.lastPointer={x:event.clientX,y:event.clientY};if(!this.active||event.button!==0||!this.valid())return;this.consume(event);if(this.busy)return;
  this.press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};try{this.options.canvas.setPointerCapture(event.pointerId);}catch{}
 };
 private up=(event:PointerEvent)=>{
  if(!this.active||event.button!==0||this.press?.id!==event.pointerId)return;this.consume(event);const click=!this.press.moved;this.release();this.pointer={x:event.clientX,steps:this.steps};if(click)void this.finish();
 };
 private leave=()=>{if(!this.press)this.pointer=null;};
 private key=(event:KeyboardEvent)=>{
  if(!this.active||event.defaultPrevented||event.isComposing)return;
  const target=event.target as HTMLElement|null,typing=!!target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])'),own=!!target&&!!this.root?.contains(target);
  if(typing&&!(own&&['Enter','Escape'].includes(event.key)))return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const key=event.key.toLowerCase();if(!['x','y','z','arrowleft','arrowright','enter','escape'].includes(key))return;
  this.consume(event);if(this.busy||!this.valid())return;
  if(key==='escape'){this.cancel();this.options.message('已取消物体缩放，模型未改变');}
  else if(key==='enter')void this.finish();
  else if(key==='arrowleft'||key==='arrowright'){this.pointer=null;this.setSteps(this.steps+(key==='arrowright'?1:-1));}
  else{this.axis=key as ObjectStepScaleAxis;this.pointer=null;this.render();}
 };
 private async finish(){
  if(this.busy||!this.valid()||!this.token)return;
  if(this.steps===0){this.cancel();this.options.message('步数为 0，物体未改变');return;}
  if(!this.plan)return;
  const token=this.token,generation=this.generation;this.busy=true;this.release();this.syncControls();
  try{await this.options.commit(token.objectId,this.axis,this.steps);if(generation===this.generation)this.cancel();}
  catch(error){this.options.message(this.error(error),true);}
  finally{this.busy=false;if(this.active)this.syncControls();}
 }
 private release(){const press=this.press;this.press=null;if(press)try{if(this.options.canvas.hasPointerCapture(press.id))this.options.canvas.releasePointerCapture(press.id);}catch{}}
 private abort=()=>this.cancel();
 private error(error:unknown){return error instanceof Error?error.message:String(error);}
 cancel(){
  const active=this.token!==null;this.generation++;this.release();this.token=null;this.plan=null;this.pointer=null;this.root?.remove();this.root=null;this.status=null;this.stepsInput=null;this.confirmButton=null;this.axes.clear();
  const data=this.options.host.dataset;delete data.objectScaleAxis;delete data.objectScaleCount;delete data.objectScaleSteps;if(active)this.options.preview(null);
 }
 dispose(){
  if(this.disposed)return;this.cancel();this.disposed=true;const canvas=this.options.canvas;
  canvas.removeEventListener('pointermove',this.move,true);canvas.removeEventListener('pointerdown',this.down,true);canvas.removeEventListener('pointerup',this.up,true);canvas.removeEventListener('pointercancel',this.abort,true);canvas.removeEventListener('pointerleave',this.leave,true);canvas.ownerDocument.removeEventListener('keydown',this.key,true);canvas.ownerDocument.defaultView?.removeEventListener('blur',this.abort);
 }
}
