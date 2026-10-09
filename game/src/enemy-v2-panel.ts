import {nativeCombatDiagnostics} from './core/companion-combat';
import {positionVisible} from './core/visibility';
import type {GameState,Pos} from './core/types';
import type {EnemyPlaytestMode} from './core/enemy-playtest';
import {visibleEnemyHazards} from './core/enemy-observation';
import {areaFootprint} from './core/attack-area';
import './en01-panel.css';
/** Read-only feedback for committed danger. Reset/mode buttons delegate to the main world. */
export class EnemyV2Panel{
 private panel:HTMLElement;private overlay:SVGSVGElement;private arrow=new Image();private arrowReady=false;private arrowError='';
 constructor(app:HTMLElement,onReset:(mode?:EnemyPlaytestMode)=>void){
  this.panel=document.createElement('aside');this.panel.id='en01-panel';this.panel.style.maxHeight='calc(100vh - 365px)';this.panel.innerHTML='<h2>原怪物主探索 <small>SOURCE＋SAMPLE · 架势：归零立即受控</small></h2><p>WASD 移动 · Z 切人 · Shift 闪避<br>猎人右键格挡／阿尔右键射击<br>左键攻击 · E 主动 · Space 暂停</p><div class="en01-buttons en05-groups"><button data-v2="zombie">僵尸</button><button data-v2="ranged">骷髅弓</button><button data-v2="mix">双怪</button><button data-v2="three">三怪 2＋1</button><button data-v2="four">四怪 2＋2</button><button data-v2="five">五怪压力 3＋2</button><button data-v2="reset">重置</button></div><details><summary>诊断（可收起）</summary><pre></pre></details><a href="/?en01=1">EN01 技术夹具</a> · <a href="/">普通入口</a>';
  for(const b of this.panel.querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>onReset(b.dataset.v2==='reset'?undefined:b.dataset.v2 as EnemyPlaytestMode);
  this.overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');this.overlay.id='en01-overlay';app.append(this.overlay,this.panel);
  this.arrow.onload=()=>this.arrowReady=true;this.arrow.onerror=()=>this.arrowError='原箭附件加载失败（无旧素材回退）';this.arrow.src='/__al01-assets/ranged/arrow.png';
 }
 update(s:GameState,project:(p:Pos,alt?:number)=>Pos,visual:(id:string)=>string){
  const entities=s.enemyRuntime?.entities??[];this.panel.querySelector('pre')!.textContent=s.units.filter(u=>u.enemyV2).map(u=>{const st=u.enemyV2!;return `${u.name} HP ${u.hp.toFixed(0)} / ${u.maxHp} · 架势 ${u.posture.toFixed(0)} / ${u.maxPosture} · ${visual(u.id)}\n${st.profile.id} · ${st.brain?.decision??'fixture'}\n目标 ${st.brain?.known?.id??'—'} · 动作 ${st.action?.context.actionId??'—'}\nMoveReady ${!st.action||st.action.moveReady} · ${u.life}\n危险 ${entities.filter(e=>e.context.actorId===u.id).map(e=>`${e.id}:${e.kind}${s.time<e.spawnAt?'待生':''}`).join(',')||'—'}\n${st.trace.slice(-3).map(r=>`${r.at.toFixed(2)} ${r.event??r.kind} ${r.reason??r.defense??''}`).join('\n')}`;}).join('\n\n')+'\n\n'+s.units.filter(u=>['hunter-v2','al-basic-v1'].includes(u.basicProfileId??'')).map(u=>u.name+' '+JSON.stringify(nativeCombatDiagnostics(s,u))).join('\n')+(this.arrowError?'\n'+this.arrowError:'');
  this.overlay.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  const tells=s.units.filter(u=>u.enemyV2?.action&&positionVisible(s,u.pos)).map(u=>{const p=project(u.pos),a=u.enemyV2!.action!,released=s.time>=a.context.acceptedAt+u.enemyV2!.profile.events.find(e=>e.kind==='attack')!.at;return `<text x="${p.x}" y="${p.y-62}">${released?'已释放':'准备出招'}</text>`;});
  const danger=entities.filter(e=>e.profile.visual==='ranged').map(e=>{
   const center=e.kind==='transport'?e.to:e.pos;if(!positionVisible(s,center))return '';const points=Array.from({length:25},(_,i)=>{const a=i*Math.PI/12;return project({x:center.x+Math.cos(a)*e.profile.radius,y:center.y+Math.sin(a)*e.profile.radius});});
   const ring=`<path data-danger="${e.id}" d="${points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')}Z" fill="${e.kind==='hazard'?'#dc5c4360':'none'}" stroke="${e.kind==='hazard'?'#ed8163':'#d5bd85'}" opacity=".8"/>`;
   if(e.kind==='hazard'||s.time<e.spawnAt)return ring;
   const t=Math.max(0,Math.min(1,(s.time-e.spawnAt)/e.profile.travel)),next=Math.min(1,t+.02),p=project(e.pos,4*3.8*t*(1-t)+.05),ahead=project({x:e.from.x+(e.to.x-e.from.x)*next,y:e.from.y+(e.to.y-e.from.y)*next},4*3.8*next*(1-next)+.05),angle=Math.atan2(ahead.y-p.y,ahead.x-p.x)*180/Math.PI;
   const arrow=this.arrowReady?`<image href="${this.arrow.src}" x="-6" y="-17" width="12" height="34" style="image-rendering:pixelated" transform="translate(${p.x} ${p.y}) rotate(${angle-75})"/>`:'';
   return ring+arrow;
  });const sectors=visibleEnemyHazards(s).filter(h=>h.area.kind==='sector').map(h=>{const points=areaFootprint(s,h.area).map(p=>project(p));return `<path data-native-risk="${h.observationKey}" d="${points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')}Z" fill="#d5bd8518" stroke="#d5bd85" stroke-width="1.5" stroke-dasharray="5 3"/>`;});this.overlay.innerHTML=[...sectors,...tells,...danger].join('');
 }
}
