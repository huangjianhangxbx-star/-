import {nativeCombatDiagnostics} from './core/companion-combat';
import {EnemyDanger} from './enemy-danger';
import type {GameState,Pos} from './core/types';
import type {EnemyPlaytestMode} from './core/enemy-playtest';
import './en01-panel.css';
/** Read-only feedback for committed danger. Reset/mode buttons delegate to the main world. */
export class EnemyV2Panel{
 private panel:HTMLElement;private danger:EnemyDanger;
 constructor(app:HTMLElement,onReset:(mode?:EnemyPlaytestMode)=>void){
  this.panel=document.createElement('aside');this.panel.id='en01-panel';this.panel.style.maxHeight='calc(100vh - 365px)';this.panel.innerHTML='<h2>原怪物主探索 <small>SOURCE＋SAMPLE · 架势：归零立即受控</small></h2><p>WASD 移动 · Z 切人 · Shift 闪避<br>猎人右键格挡／阿尔右键射击<br>左键攻击 · E 主动 · Space 暂停</p><div class="en01-buttons en05-groups"><button data-v2="zombie">僵尸</button><button data-v2="ranged">骷髅弓</button><button data-v2="mix">双怪</button><button data-v2="three">三怪 2＋1</button><button data-v2="four">四怪 2＋2</button><button data-v2="five">五怪压力 3＋2</button><button data-v2="reset">重置</button></div><details><summary>诊断（可收起）</summary><pre></pre></details><a href="/?en01=1">EN01 技术夹具</a> · <a href="/">普通入口</a>';
  for(const b of this.panel.querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>onReset(b.dataset.v2==='reset'?undefined:b.dataset.v2 as EnemyPlaytestMode);
  app.append(this.panel);this.danger=new EnemyDanger(app);
 }
 update(s:GameState,project:(p:Pos,alt?:number)=>Pos,visual:(id:string)=>string){
  const entities=s.enemyRuntime?.entities??[];this.panel.querySelector('pre')!.textContent=s.units.filter(u=>u.enemyV2).map(u=>{const st=u.enemyV2!;return `${u.name} HP ${u.hp.toFixed(0)} / ${u.maxHp} · 架势 ${u.posture.toFixed(0)} / ${u.maxPosture} · ${visual(u.id)}\n${st.profile.id} · ${st.brain?.decision??'fixture'}\n目标 ${st.brain?.known?.id??'—'} · 动作 ${st.action?.context.actionId??'—'}\nMoveReady ${!st.action||st.action.moveReady} · ${u.life}\n危险 ${entities.filter(e=>e.context.actorId===u.id).map(e=>`${e.id}:${e.kind}${s.time<e.spawnAt?'待生':''}`).join(',')||'—'}\n${st.trace.slice(-3).map(r=>`${r.at.toFixed(2)} ${r.event??r.kind} ${r.reason??r.defense??''}`).join('\n')}`;}).join('\n\n')+'\n\n'+s.units.filter(u=>['hunter-v2','al-basic-v1'].includes(u.basicProfileId??'')).map(u=>u.name+' '+JSON.stringify(nativeCombatDiagnostics(s,u))).join('\n');
  this.danger.update(s,project);
 }
}
