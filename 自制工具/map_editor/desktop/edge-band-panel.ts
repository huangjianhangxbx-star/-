import { EdgeBandComputer } from './edge-band-computer.ts';
import { applyEdgeBands,edgeBandLayerSignature,validateEdgeBandOptions,type EdgeBandOptions,type EdgeBandPlan } from '../core/edge-band-plan.ts';
import type { AssetDocument } from '../core/workshop-documents.ts';
import type { SurfacePaint } from '../core/surface-paint.ts';
import type { StructureEdgeDomain } from '../core/structure-edge-domain.ts';
import { paintCount,paintSample } from './paint-performance.ts';
type Group={ids:string[];signature:string;options:string};
type Deps={snapshot:()=>{model:AssetDocument;objectId:string;canvasId:string};source:()=>SurfacePaint;selection:()=>string[];color:()=>string;prepare:()=>Promise<void>;preview:(source?:SurfacePaint)=>void;guides:(edges:StructureEdgeDomain['edges'])=>void;commit:(options:EdgeBandOptions,ids:string[],fingerprint:string,replace:{ids:string[];signature:string}|undefined,preview:SurfacePaint)=>Promise<void>;message:(s:string)=>void;changed:()=>void};
/** A frozen author operation. Pixels are ordinary layers after one atomic apply. */
export class EdgeBandPanel {
 private opened=false;
 private applying=false;
 private computer:EdgeBandComputer|null=null;
 private model:AssetDocument|null=null;
 private objectId='';
 private canvasId='';
 private selected:string[]=[];
 private source:SurfacePaint|undefined;
 private plan:EdgeBandPlan|null=null;
 private output:SurfacePaint|undefined;
 private edges:StructureEdgeDomain['edges']=[];
 private geometry='';
 private initializing:Promise<void>|null=null;
 private generation=0;
 private requestedOptions='';
 private frame=0;
 private group:Group|undefined;
 private ids:string[]=[];
 private pendingGuard:Promise<boolean>|null=null;
 private resolveGuard:((v:boolean)=>void)|null=null;
 private off:()=>void;
 constructor(private host:HTMLElement,private deps:Deps){
  host.innerHTML=`<div class="edge-band-heading"><div><small>自动处理</small><h2>结构描边</h2></div><button id="edge-band-close" aria-label="关闭结构描边">关闭</button></div>
   <p id="edge-band-target"></p><label>范围<select id="edge-band-scope"><option value="all">当前目标全部表面</option><option value="selection">当前贴图选区</option></select></label>
   <label>预设<select id="edge-band-preset"><option value="side">侧面上沿</option><option value="top">顶面内描边</option><option value="both">顶面 + 侧面</option><option value="convex">通用凸棱</option></select></label>
   <label>几何判断<select id="edge-band-geometry"><option value="asset">完整资产</option><option value="target">独立目标</option></select></label><p id="edge-band-isolated" hidden>独立目标会显露与其他物体接触处的边。</p>
   <label>颜色方式<select id="edge-band-color-mode"><option value="color">指定颜色</option><option value="darken">相对底色压暗</option></select></label>
   <label id="edge-band-gain-row" hidden>底色增益<input id="edge-band-gain" type="number" min="0.1" max="1" step="0.05" value="0.65"></label>
   <fieldset id="edge-band-side-fields"><legend>侧边</legend><div class="edge-band-color"><input id="edge-band-side-color" type="color" value="#ffffff" aria-label="侧边颜色"><input id="edge-band-side-hex" value="#ffffff" maxlength="7" aria-label="侧边HEX"></div><label>宽度<input id="edge-band-side-width" type="number" min="1" max="64" value="2"><span>px</span><output id="edge-band-side-meters"></output></label></fieldset>
   <fieldset id="edge-band-top-fields" hidden><legend>顶面</legend><div class="edge-band-color"><input id="edge-band-top-color" type="color" value="#ffffff" aria-label="顶面颜色"><input id="edge-band-top-hex" value="#ffffff" maxlength="7" aria-label="顶面HEX"></div><label>宽度<input id="edge-band-top-width" type="number" min="1" max="64" value="1"><span>px</span><output id="edge-band-top-meters"></output></label></fieldset>
   <div class="edge-band-color-actions"><label><input id="edge-band-link" type="checkbox" checked>颜色联动</label><button id="edge-band-pick">取当前画笔色</button></div>
   <details><summary>接收面方向</summary><div id="edge-band-faces">${['+X','−X','+Y','−Y','+Z','−Z'].map((s,i)=>`<label><input type="checkbox" data-edge-face="${i}" checked>${s}</label>`).join('')}</div></details>
   <label>图层位置<select id="edge-band-placement"><option value="below">手绘下方（保护）</option><option value="above">置顶生成</option></select></label>
   <label>预览<select id="edge-band-preview"><option value="result">结果</option><option value="original">原始</option><option value="edges">识别边与覆盖范围</option></select></label>
   <p id="edge-band-status" role="status"></p><p class="edge-band-note">生成普通绘图层；造型改变后需重新生成。按 Esc 取消本次草稿。</p><p class="edge-band-note">指定色仍按现有暗面与视口光照显示；原色检查便于核对。</p>
   <div id="edge-band-leave" hidden><p>先处理当前结构描边草稿</p><button id="edge-band-leave-apply">应用后继续</button><button id="edge-band-leave-discard">放弃后继续</button><button id="edge-band-leave-stay">返回调整</button></div>
   <div class="edge-band-bottom"><button id="edge-band-cancel">取消</button><button id="edge-band-apply" class="edge-band-primary" disabled>应用到独立图层</button><button id="edge-band-new" hidden>新建一组</button></div>`;
  this.get('edge-band-close').onclick=()=>void this.leave();this.get('edge-band-cancel').onclick=()=>this.cancel();
  this.get('edge-band-apply').onclick=()=>void this.apply();
  this.get('edge-band-new').onclick=()=>{this.group=undefined;this.ids=[];this.requestedOptions='';this.schedule();};
  this.get('edge-band-pick').onclick=()=>{this.setColor('side',deps.color());this.setColor('top',deps.color());this.schedule();};
  this.host.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(el.id.includes('-color')||el.id.includes('-hex')){const which=el.id.includes('-top-')?'top':'side';if(/^#[0-9a-f]{6}$/i.test(el.value)){this.setColor(which,el.value);if(this.checked('edge-band-link'))this.setColor(which==='top'?'side':'top',el.value);}}this.schedule();});
  this.host.addEventListener('change',e=>{if((e.target as HTMLElement).id==='edge-band-preview')this.refreshPreview();else this.schedule();});
  this.get('edge-band-leave-stay').onclick=()=>this.finishGuard(false);
  this.get('edge-band-leave-discard').onclick=()=>{this.finishGuard(true);this.cancel();};
  this.get('edge-band-leave-apply').onclick=async()=>{if(await this.apply()){this.finishGuard(true);this.close();}};
  const key=(e:KeyboardEvent)=>{if(!this.active||e.key!=='Escape')return;if(document.querySelector('#paint-display details[open]'))return;e.preventDefault();e.stopImmediatePropagation();if(this.pendingGuard)this.finishGuard(false);else this.cancel();};
  document.addEventListener('keydown',key,true);this.off=()=>document.removeEventListener('keydown',key,true);
 }
 get active(){return this.opened;}
 private get(id:string){return this.host.querySelector<HTMLElement>('#'+id)!;}
 private value(id:string){return (this.get(id) as HTMLInputElement).value;}
 private checked(id:string){return (this.get(id) as HTMLInputElement).checked;}
 private setColor(which:string,value:string){for(const tail of ['color','hex'])(this.get('edge-band-'+which+'-'+tail) as HTMLInputElement).value=value;}
 private status(text:string,state='ready'){this.get('edge-band-status').textContent=text;this.host.dataset.state=state;document.body.dataset.edgeBandState=state;}
 private options(){return validateEdgeBandOptions({preset:this.value('edge-band-preset'),geometry:this.value('edge-band-geometry'),scope:this.value('edge-band-scope'),selection:this.value('edge-band-scope')==='selection'?this.selected:undefined,sideWidth:Number(this.value('edge-band-side-width')),topWidth:Number(this.value('edge-band-top-width')),sideColor:this.value('edge-band-side-hex'),topColor:this.value('edge-band-top-hex'),colorMode:this.value('edge-band-color-mode'),gain:Number(this.value('edge-band-gain')),faces:[...this.host.querySelectorAll<HTMLInputElement>('[data-edge-face]:checked')].map(e=>Number(e.dataset.edgeFace)),placement:this.value('edge-band-placement')});}
 async open(){
  if(this.active)return;
  try{await this.deps.prepare();const current=this.deps.snapshot();this.model=structuredClone(current.model);this.objectId=current.objectId;this.canvasId=current.canvasId;this.selected=[...this.deps.selection()];this.source=this.deps.source();this.group=undefined;this.ids=[];this.plan=null;this.output=undefined;this.geometry='';this.requestedOptions='';this.edges=[];this.opened=true;
   const canvas=this.model.canvases!.find(c=>c.canvasId===this.canvasId)!,object=this.model.objects!.find(o=>o.objectId===this.objectId)!;
   this.get('edge-band-target').textContent=object.name+' / '+canvas.name+' / '+canvas.voxelStepM+' m';this.setColor('side',this.deps.color());this.setColor('top',this.deps.color());
   this.host.hidden=false;document.body.dataset.edgeBandOpen='true';this.deps.changed();this.schedule();
  }catch(e){this.deps.message((e as Error).message);}
 }
 private schedule(){if(!this.active)return;let signature:string;try{signature=JSON.stringify(this.options());}catch{signature='invalid:'+JSON.stringify([...this.host.querySelectorAll<HTMLInputElement>('input,select')].map(e=>e.value));}if(signature===this.requestedOptions)return;this.requestedOptions=signature;this.plan=null;(this.get('edge-band-apply') as HTMLButtonElement).disabled=true;this.status('正在更新预览 · Esc取消','computing');if(this.frame)cancelAnimationFrame(this.frame);const generation=++this.generation;this.frame=requestAnimationFrame(()=>{this.frame=0;void this.calculate(generation);});}
 private async calculate(generation:number){
  try{
   const options=this.options();
   const top=options.preset==='top'||options.preset==='both';this.get('edge-band-top-fields').hidden=!top;this.get('edge-band-side-fields').hidden=options.preset==='top';this.get('edge-band-side-fields').querySelector('legend')!.textContent=options.preset==='convex'?'凸棱':'侧边';
   this.get('edge-band-isolated').hidden=options.geometry!=='target';this.get('edge-band-gain-row').hidden=options.colorMode!=='darken';
   for(const k of ['top','side']){this.get('edge-band-'+k+'-meters').textContent=String(Number(this.value('edge-band-'+k+'-width'))/64)+' m';(this.get('edge-band-'+k+'-color') as HTMLInputElement).disabled=options.colorMode==='darken';}
   if(options.geometry!==this.geometry||!this.computer){
    this.computer?.dispose();const computer=this.computer=new EdgeBandComputer();this.geometry=options.geometry;
    this.initializing=computer.init(this.model!,this.objectId,options.geometry).then(initialized=>{if(this.computer!==computer)return;this.edges=initialized.value.edges;paintCount('outlineRecognition');paintSample('outlineRecognition',initialized.elapsed);});
   }
   await this.initializing;if(!this.active||generation!==this.generation)return;
   const computed=await this.computer.plan(options);if(!this.active||generation!==this.generation)return;
   this.plan=computed.value;paintSample('outlinePlan',computed.elapsed);
   if(this.ids.length!==this.plan.bands.length)this.ids=this.plan.bands.map(()=>crypto.randomUUID());
   const base=this.deps.source();this.output=applyEdgeBands(base,this.plan,{ids:this.ids,...(this.group?{replace:{ids:this.group.ids,signature:this.group.signature}}:{}),placement:options.placement});
   const same=this.group?.options===JSON.stringify(options)&&this.group.signature===edgeBandLayerSignature(base,this.group.ids);
   (this.get('edge-band-apply') as HTMLButtonElement).disabled=!this.plan.pixelCount||!!same;
   this.get('edge-band-apply').textContent=this.group?'替换本次结果':'应用到独立图层';this.get('edge-band-new').hidden=!this.group;
   this.status(this.plan.edgeCount+' 段边 · '+this.plan.pixelCount+' 像素 · '+this.plan.faceCount+' 个面'+(this.plan.coveredPixels?' · 上层遮盖 '+this.plan.coveredPixels+' 像素':''));
   this.refreshPreview();
  }catch(e){if(!this.active||generation!==this.generation)return;this.plan=null;this.output=undefined;this.status((e as Error).message,'error');this.get('edge-band-new').hidden=!this.group;this.deps.preview(this.deps.source());this.deps.guides([]);}
 }
 refreshPreview(){if(!this.active)return;const kind=this.value('edge-band-preview');this.deps.preview(kind==='original'?this.source:this.output??this.source);this.deps.guides(kind==='edges'?this.edges:[]);}
 async apply():Promise<boolean>{
  if(this.applying||!this.plan||!this.output||!this.plan.pixelCount){this.deps.message('请等待有效预览后再应用');return false;}
  this.applying=true;const controls=[...this.host.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,select,button')].filter(e=>e.id!=='edge-band-apply'),disabled=controls.map(e=>e.disabled);controls.forEach(e=>e.disabled=true);const plan=this.plan,output=this.output,replace=this.group?{ids:this.group.ids,signature:this.group.signature}:undefined,ids=[...this.ids];
  (this.get('edge-band-apply') as HTMLButtonElement).disabled=true;this.status('正在应用 · 确认后可一次撤销','applying');
  try{
   await this.deps.commit(plan.options,ids,plan.geometryFingerprint,replace,output);
   const confirmed=this.deps.source();this.output=confirmed;this.group={ids,signature:edgeBandLayerSignature(confirmed,ids),options:JSON.stringify(plan.options)};
   this.get('edge-band-new').hidden=false;this.get('edge-band-apply').textContent='替换本次结果';this.status('已应用 '+plan.pixelCount+' 像素 · 可整组撤销');this.deps.message('结构描边已生成普通图层 · 可撤销');this.refreshPreview();return true;
  }catch(e){this.status((e as Error).message,'error');(this.get('edge-band-apply') as HTMLButtonElement).disabled=false;return false;}finally{this.applying=false;controls.forEach((e,i)=>e.disabled=disabled[i]);}
 }
 private get dirty(){return !this.group||!this.plan||this.group.options!==JSON.stringify(this.plan.options);}
 guard():Promise<boolean>{
  if(!this.active)return Promise.resolve(true);
  if(this.applying){this.deps.message('正在确认结构描边，请稍候');return Promise.resolve(false);}
  if(!this.dirty){this.close();return Promise.resolve(true);}
  if(this.pendingGuard)return this.pendingGuard;
  this.get('edge-band-leave').hidden=false;(this.get('edge-band-leave-apply') as HTMLButtonElement).disabled=!this.plan||!this.output;
  this.get('edge-band-leave').scrollIntoView({block:'nearest'});
  this.pendingGuard=new Promise(resolve=>this.resolveGuard=resolve);return this.pendingGuard;
 }
 private finishGuard(result:boolean){this.get('edge-band-leave').hidden=true;const resolve=this.resolveGuard;this.resolveGuard=null;this.pendingGuard=null;resolve?.(result);}
 private async leave(){if(await this.guard())this.close();}
 cancel(){if(this.applying){this.deps.message('操作已发送，确认后可撤销');return;}this.close();this.deps.message('已取消结构描边草稿');}
 private close(){this.finishGuard(false);this.generation++;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.computer?.dispose();this.computer=null;this.geometry='';this.opened=false;this.plan=null;this.output=undefined;this.host.hidden=true;delete document.body.dataset.edgeBandOpen;this.deps.guides([]);this.deps.preview(this.deps.source());this.deps.changed();}
 dispose(){this.applying=false;this.close();this.finishGuard(false);this.off();}
}
