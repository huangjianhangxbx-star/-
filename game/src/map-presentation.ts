import type {MapDefinition} from './core/map-definitions';
/** Travel owns only this overlay; pause, visibility and dialogue remain separate owners. */
export class MapPresentation{
 readonly element=document.createElement('div');
 constructor(root:HTMLElement){this.element.dataset.mapLoading='';this.element.hidden=true;this.element.setAttribute('role','status');this.element.style.cssText='position:absolute;inset:0;z-index:100;background:#080e17ed;color:#ddd6bc;display:grid;place-content:center;gap:12px;text-align:center;pointer-events:auto;font:18px Microsoft YaHei,sans-serif';root.append(this.element);}
 private paint(){return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
 async transition(stage:string,d:MapDefinition,diagnosticDelay=0){
  const el=this.element;
  if(stage==='first-frame'||stage==='reveal'){el.textContent=`${d.name} · 正在显示`;await this.paint();return;}
  if(stage==='fade-out'){
   el.hidden=false;el.style.display='grid';el.textContent=`正在前往：${d.name}${diagnosticDelay>0?' · 诊断延迟 '+diagnosticDelay+'ms':''}`;
   const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
   await el.animate([{opacity:0},{opacity:1}],{duration:reduce?0:150,easing:'ease-in',fill:'forwards'}).finished;await this.paint();return;
  }
  if(stage==='fade-in'||stage==='failed'){
   if(stage==='failed')el.textContent='准备失败 · 返回原地点';
   await el.animate([{opacity:1},{opacity:0}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:150,easing:'ease-out',fill:'forwards'}).finished;el.hidden=true;el.style.display='none';
  }
 }
}
