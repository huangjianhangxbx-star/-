import type {GameState,Pos} from '../../core/types';
import {propBounds} from '../../core/scene-layout';
import {activityAnchors} from '../../core/activity-anchors';
/** Screen-space diagnostic only. No state writes, transactions, reservations or AI. */
export function mountHomeDiagnostics(s:GameState,project:(p:Pos)=>Pos,close:()=>void){
 const host=document.createElement('div');host.dataset.homeSpatial='';host.style.cssText='position:fixed;inset:0;z-index:12000;pointer-events:none';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');host.append(svg);
 const shape=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const el=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);};
 for(const p of s.exploration?.definition.sceneLayout?.props??[]){const b=propBounds(p),a=project({x:b.left,y:b.top}),z=project({x:b.right,y:b.bottom}),foot=project(p.pos);shape('rect',{x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y,fill:'none',stroke:p.blocksMovement?'#ff8066':'#82b8bc','stroke-width':2});shape('line',{x1:a.x,x2:z.x,y1:foot.y,y2:foot.y,stroke:'#f8d576','stroke-width':2});}
 const anchors=activityAnchors(s);for(const a of anchors){const p=project(a.approach);shape('circle',{cx:p.x,cy:p.y,r:6,fill:Object.values(a.reachable).every(Boolean)?'#77e69a':'#ff6262'});shape('text',{x:p.x+9,y:p.y-8,fill:'#fff','font-size':13,stroke:'#000','stroke-width':.3},a.id+' / '+a.facing);}
 const info=document.createElement('pre');info.style.cssText='position:absolute;left:12px;bottom:12px;background:#09131ee8;color:#e3edef;padding:10px;max-width:31vw;max-height:30vh;overflow:auto;pointer-events:auto;font-size:11px';info.textContent='HOME-02 只读 · 红=移动底座 / 黄=脚点基线 / 绿=可达站位\n'+JSON.stringify(anchors,null,2);host.append(info);
 const button=document.createElement('button');button.textContent='返回 F10 面板';button.style.cssText='position:absolute;right:25px;top:20px;pointer-events:auto';button.onclick=close;host.append(button);document.body.append(host);return ()=>host.remove();
}
