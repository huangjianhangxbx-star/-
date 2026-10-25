import type { AssetDocument } from '../core/workshop-documents.ts';
import { StructureEdgeDomain } from '../core/structure-edge-domain.ts';
import { generateEdgeBands,type EdgeBandOptions,type EdgeBandPlan } from '../core/edge-band-plan.ts';
export class EdgeBandComputer {
 private worker:Worker;
 private serial=0;
 private disposed=false;
 private planRunning=false;
 private latest:{options:EdgeBandOptions;resolve:(value:{value:EdgeBandPlan;elapsed:number})=>void;reject:(error:Error)=>void}|undefined;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 constructor(){
  this.worker=new Worker(new URL('edge-band-worker.js',window.location.href));
  this.worker.onmessage=e=>{const p=this.pending.get(e.data.id);if(!p)return;this.pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data);};
  this.worker.onerror=e=>{for(const p of this.pending.values())p.reject(Error(e.message||'结构分析未完成'));this.pending.clear();};
 }
 private request(input:any):Promise<{value:any;elapsed:number}>{return new Promise((resolve,reject)=>{const id=++this.serial;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,...input});});}
 init(model:AssetDocument,objectId:string,geometry:'asset'|'target'){return this.request({kind:'init',model,objectId,geometry});}
 plan(options:EdgeBandOptions):Promise<{value:EdgeBandPlan;elapsed:number}>{
  if(this.disposed)return Promise.reject(Error('已取消结构处理'));
  return new Promise((resolve,reject)=>{this.latest?.reject(Error('预览已被新参数替换'));this.latest={options,resolve,reject};this.pumpPlan();});
 }
 private pumpPlan(){
  if(this.planRunning||!this.latest||this.disposed)return;
  const next=this.latest;this.latest=undefined;this.planRunning=true;
  void this.request({kind:'plan',options:next.options}).then(next.resolve,next.reject).finally(()=>{this.planRunning=false;this.pumpPlan();});
 }
 dispose(){this.disposed=true;this.latest?.reject(Error('已取消结构处理'));this.latest=undefined;this.worker.terminate();for(const p of this.pending.values())p.reject(Error('已取消结构处理'));this.pending.clear();}
}
/** Authority recomputes from its own snapshot, never trusts client-generated pixels. */
export async function computeEdgeBandPlan(model:AssetDocument,objectId:string,options:EdgeBandOptions):Promise<EdgeBandPlan>{
 if(typeof Worker==='undefined'){
  const domain=new StructureEdgeDomain(model,objectId,options.geometry);
  return generateEdgeBands(domain,options,model.canvases!.find(c=>c.canvasId===domain.canvasId)?.paintSource);
 }
 const computer=new EdgeBandComputer();
 try{await computer.init(model,objectId,options.geometry);return (await computer.plan(options)).value;}finally{computer.dispose();}
}
