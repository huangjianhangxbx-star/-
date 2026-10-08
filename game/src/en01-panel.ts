import type {GameState,Pos} from './core/types';
import {enemyEntityArea} from './core/enemy-attack-entity';
import './en01-panel.css';

/** Read-only presentation; these controls only select/reset the opt-in fixture. */
export class EnemyFixturePanel {
 private panel:HTMLElement;private svg:SVGSVGElement;private abort=new AbortController();
 constructor(app:HTMLElement,onControl:(kind:'melee'|'transport'|'reset')=>void){
  this.panel=document.createElement('aside');this.panel.id='en01-panel';this.panel.innerHTML='<h2>单敌动作验证 <small>EN01 FIXTURE</small></h2><p>主探索 · 实际 HP 与防御<br>WASD 移动 · Z 切人 · Shift 闪避<br>猎人右键格挡 · 阿尔右键射击 · Space 暂停</p><div class="en01-buttons"><button data-en01="melee">近战扇区</button><button data-en01="transport">延迟运输</button><button data-en01="reset">重置</button></div><div class="en01-timeline" aria-label="动作时序"></div><output></output><details><summary>接触记录</summary><pre></pre></details><a href="/">返回普通试玩</a>';
  this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.id='en01-overlay';this.svg.setAttribute('aria-hidden','true');app.append(this.svg,this.panel);
  this.panel.addEventListener('click',e=>{const kind=(e.target as HTMLElement).closest<HTMLElement>('[data-en01]')?.dataset.en01;if(kind==='melee'||kind==='transport'||kind==='reset')onControl(kind);},{signal:this.abort.signal});
 }
 update(s:GameState,project:(p:Pos)=>Pos){
  const u=s.units.find(u=>u.enemyV2),st=u?.enemyV2;if(!u||!st){this.svg.replaceChildren();return;}
  const a=st.action,labels={'dash':'冲击','prepare':'准备','lock':'锁定','attack':'释放','attack-ready':'可攻击','move-ready':'可移动','finish':'结束'};
  const root=a?.context.actionId??st.trace.slice().reverse().find(x=>x.kind==='accepted')?.actionId;
  const events=new Set(st.trace.filter(x=>x.actionId===root&&x.kind==='event').map(x=>x.event));
  this.panel.querySelector('.en01-timeline')!.innerHTML=st.profile.events.map(e=>`<span class="${events.has(e.kind)?'done':''}">${labels[e.kind]}</span>`).join('');
  this.panel.querySelector('output')!.textContent=`${st.profile.kind==='melee'?'近战扇区':'延迟运输'} · 敌 HP ${u.hp}/${u.maxHp}\n${u.life==='dead'?'死亡':a?'动作 '+a.context.actionId:'等待 '+(st.lastReason??'资格')} · 实体 ${s.enemyRuntime?.entities.length??0}\n锁定目标 ${a?.targetId??'—'} · 方向 ${a?.facing.toFixed(2)??'—'}\n模拟时间 ${s.time.toFixed(2)} · generation ${st.generation}`;
  this.panel.querySelector('pre')!.textContent=st.trace.slice(-8).map(r=>`${r.at.toFixed(2)} ${r.event?labels[r.event]:r.kind} ${r.reason??r.targetId??''}${r.hpLost!==undefined?' HP −'+r.hpLost+' / '+r.defense:''}`).join('\n');
  this.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  const shapes:string[]=[];const point=(p:Pos)=>{const q=project(p);return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;};
  if(a){const p=project(u.pos);shapes.push(`<text x="${p.x}" y="${p.y-65}">${events.has('attack')?'已释放':'准备 → 锁定'}</text>`);}
  for(const e of s.enemyRuntime?.entities??[]){if(s.time<e.spawnAt)continue;
   if(e.kind==='transport'){const p=project(e.pos);shapes.push(`<polyline points="${point(e.from)} ${point(e.to)}" class="flight"/><circle cx="${p.x}" cy="${p.y}" r="7"/>`);}
   else{const area=enemyEntityArea(e);if(area.kind==='sector'){const ps=[point(area.origin)];for(let i=0;i<=24;i++){const t=area.heading-area.arc/2+area.arc*i/24;ps.push(point({x:area.origin.x+Math.cos(t)*area.range,y:area.origin.y+Math.sin(t)*area.range}));}shapes.push(`<polygon points="${ps.join(' ')}"/>`);}
    else if(area.kind==='circle'){const ps=Array.from({length:32},(_,i)=>point({x:area.center.x+Math.cos(i*Math.PI/16)*area.radius,y:area.center.y+Math.sin(i*Math.PI/16)*area.radius}));shapes.push(`<polygon points="${ps.join(' ')}"/>`);}
   }
  }this.svg.innerHTML=shapes.join('');
 }
 dispose(){this.abort.abort();this.panel.remove();this.svg.remove();}
}
