import type {GameState,Pos} from './core/types';
/** Path preview only: card targeting and retired rescue/retreat consumers are removed. */
export class WorldFeedback{
 private svg:SVGSVGElement;private route:SVGPathElement;
 constructor(host:HTMLElement){
  host.insertAdjacentHTML('beforeend',`<svg id="world-feedback" aria-hidden="true"><defs><marker id="route-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#aff9ef" stroke-width="1.6"/></marker></defs><path id="move-route"/></svg>`);
  this.svg=host.querySelector('#world-feedback')!;this.route=host.querySelector('#move-route')!;
 }
 update(s:GameState,path:Pos[],project:(p:Pos)=>Pos){
  this.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);const visible=s.phase==='battle'&&path.length>1;
  this.route.style.display=visible?'':'none';this.route.setAttribute('d',visible?path.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q.x},${q.y}`;}).join(' '):'');
 }
}
