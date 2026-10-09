import type {GameState,Pos} from './core/types';
import {positionVisible} from './core/visibility';
import {visibleEnemyHazards} from './core/enemy-observation';
import {areaFootprint} from './core/attack-area';
import './en01-panel.css';
/** Official and developer routes share the same read-only main-world feedback. */
export class EnemyDanger {
 private overlay:SVGSVGElement;private arrow=new Image();private arrowReady=false;
 constructor(app:HTMLElement){this.overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');this.overlay.id='en01-overlay';this.overlay.setAttribute('aria-label','可见敌人出招与落点');app.append(this.overlay);this.arrow.onload=()=>this.arrowReady=true;this.arrow.onerror=()=>window.dispatchEvent(new CustomEvent('character-load-error',{detail:'原箭附件加载失败（无旧素材回退）'}));this.arrow.src='/__al01-assets/ranged/arrow.png';}
 update(s:GameState,project:(p:Pos,alt?:number)=>Pos){
  if(s.phase!=='battle'){this.overlay.replaceChildren();return;}const entities=(s.enemyRuntime?.entities??[]).filter(e=>e.generation===s.combatIdentity?.generation&&s.time<e.expireAt);
  this.overlay.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  const tells=s.units.filter(u=>u.life==='active'&&u.enemyV2?.action&&positionVisible(s,u.pos)).map(u=>{const p=project(u.pos),a=u.enemyV2!.action!,released=s.time>=a.context.acceptedAt+u.enemyV2!.profile.events.find(e=>e.kind==='attack')!.at;return `<text x="${p.x}" y="${p.y-62}">${released?'已释放':'准备出招'}</text>`;});
  const danger=entities.filter(e=>e.profile.visual==='ranged').map(e=>{
   const center=e.kind==='transport'?e.to:e.pos;if(!positionVisible(s,center))return '';const points=areaFootprint(s,{kind:'circle',center,radius:e.profile.radius}).map(p=>project(p));
   const ring=`<path data-danger="${e.id}" d="${points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')}Z" fill="${e.kind==='hazard'?'#dc5c4360':'none'}" stroke="${e.kind==='hazard'?'#ed8163':'#d5bd85'}" opacity=".8"/>`;
   if(e.kind==='hazard'||s.time<e.spawnAt)return ring;
   const t=Math.max(0,Math.min(1,(s.time-e.spawnAt)/e.profile.travel)),next=Math.min(1,t+.02),p=project(e.pos,4*3.8*t*(1-t)+.05),ahead=project({x:e.from.x+(e.to.x-e.from.x)*next,y:e.from.y+(e.to.y-e.from.y)*next},4*3.8*next*(1-next)+.05),angle=Math.atan2(ahead.y-p.y,ahead.x-p.x)*180/Math.PI;
   const arrow=this.arrowReady?`<image href="${this.arrow.src}" x="-6" y="-17" width="12" height="34" style="image-rendering:pixelated" transform="translate(${p.x} ${p.y}) rotate(${angle-75})"/>`:'';
   return ring+arrow;
  });const sectors=visibleEnemyHazards(s).filter(h=>h.area.kind==='sector').map(h=>{const points=areaFootprint(s,h.area).map(p=>project(p));return `<path data-native-risk="${h.observationKey}" d="${points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')}Z" fill="#d5bd8518" stroke="#d5bd85" stroke-width="1.5" stroke-dasharray="5 3"/>`;});this.overlay.innerHTML=[...sectors,...tells,...danger].join('');
 }
}
