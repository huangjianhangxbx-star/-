import type {GameState,Pos} from './core/types';
import type {Interaction} from './interaction';
type Point={x:number;y:number};
export class WorldFeedback{
 private svg:SVGSVGElement;private route:SVGPathElement;private chain:SVGPathElement;private target:SVGCircleElement;private label:HTMLElement;private rescues:HTMLElement;
 constructor(host:HTMLElement){
 host.insertAdjacentHTML('beforeend',`<svg id="world-feedback" aria-hidden="true"><defs><marker id="route-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#aff9ef" stroke-width="1.6"/></marker><marker id="card-head" markerUnits="userSpaceOnUse" markerWidth="24" markerHeight="24" viewBox="0 0 12 12" refX="8" refY="5" orient="auto"><path d="M0 0L9 5L0 10L3 5Z" fill="currentColor"/></marker></defs><path id="move-route"/><path id="card-chain"/><circle id="card-target-ring" r="19"/></svg><div id="target-label" hidden></div><div id="world-rescues"></div><div id="crystal-retreat" hidden><small>水晶撤离</small><button data-action="retreat">确认撤离</button><span>右键取消</span></div>`);
 this.svg=host.querySelector('#world-feedback')!;this.route=host.querySelector('#move-route')!;this.chain=host.querySelector('#card-chain')!;this.target=host.querySelector('#card-target-ring')!;this.label=host.querySelector('#target-label')!;this.rescues=host.querySelector('#world-rescues')!;
 }
 update(s:GameState,input:Interaction,path:Pos[],project:(p:Pos)=>Point,cardId:string|null,cursor:Point,hover:Pos|null,retreatId:string|null,dashTarget:string|null=null){
 const battle=s.phase==='battle';this.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
 const showPath=battle&&(!cardId||!!dashTarget)&&path.length>1;
 this.route.style.display=showPath?'':'none';this.route.setAttribute('d',showPath?path.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q.x},${q.y}`}).join(' '):'');
 const retreat=document.querySelector<HTMLElement>('#crystal-retreat')!;retreat.hidden=!retreatId||!battle;if(retreatId){const q=project(s.goal);retreat.style.left=(q.x+35)+'px';retreat.style.top=(q.y-70)+'px';}
 const c=s.cards.find(c=>c.id===cardId);const card=cardId?document.querySelector<HTMLElement>(`[data-card="${cardId}"]`):null;
 const targeting=battle&&!!c&&!!card;this.chain.style.display=targeting?'':'none';this.target.style.display=targeting?'':'none';this.label.hidden=!targeting;
 if(targeting){const r=card!.getBoundingClientRect(),a={x:r.x+r.width/2,y:r.y};const b=cursor;
 const ally=s.units.find(u=>u.team==='ally'&&u.life==='active'&&hover&&u.pos.x===hover.x&&u.pos.y===hover.y);
 const tile=s.tiles.find(t=>hover&&t.x===hover.x&&t.y===hover.y);
 const valid=c!.kind==='barricade'?!!tile&&!tile.obstacle&&!s.units.some(u=>['active','downed'].includes(u.life)&&hover&&u.pos.x===hover.x&&u.pos.y===hover.y):!!ally;
 this.svg.style.color=valid?'#aff9ef':'#d7a66d';this.chain.setAttribute('d',`M${a.x},${a.y} C${a.x},${a.y-110} ${b.x},${b.y+90} ${b.x},${b.y}`);
 this.target.setAttribute('cx',String(b.x));this.target.setAttribute('cy',String(b.y));
 this.label.textContent=valid?(ally?`${c!.name} → ${ally.name}`:`${c!.name} → 地格`):c!.kind==='barricade'?'选择空地放置铁栅':'指向在场同行者';
 if(dashTarget){this.chain.style.display='none';this.target.style.display='none';this.label.textContent=path.length>1?'点击确认疾行 · 右键取消':'该方向不可疾行';}
 this.label.style.left=Math.min(innerWidth-200,b.x+24)+'px';this.label.style.top=Math.max(80,b.y-25)+'px';
 }
 const down=battle?s.units.filter(u=>u.team==='ally'&&u.life==='downed'):[];const ids=down.map(u=>u.id).join('|');
 if(this.rescues.dataset.ids!==ids){this.rescues.dataset.ids=ids;this.rescues.innerHTML=down.map(u=>`<button class="world-rescue" data-world-rescue="${u.id}" data-rescue="${u.id}"></button>`).join('');}
 for(const u of down){const el=this.rescues.querySelector<HTMLButtonElement>(`[data-world-rescue="${u.id}"]`)!;const p=project(u.pos);el.style.left=(p.x+27)+'px';el.style.top=(p.y-35)+'px';el.textContent=`✚ 救援 · ${Math.ceil(u.downTimer)}s`;el.disabled=!s.units.some(a=>a.role==='hunter'&&a.life==='active');}
 }
}

