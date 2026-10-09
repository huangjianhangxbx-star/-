import type {GameState,Unit,Pos} from './core/types';
import type {UIState} from './ui';
import {controlledBody} from './core/direct-control';
import {isPartyBody} from './core/exploration-party';
import {isHunterV2} from './core/hunter-state';
import {isAlV2} from './core/al-state';
import {equippedSkills} from './core/skill-slots';
import {SKILL_CATALOG} from './core/skill-catalog';
import {queryExplorationExit} from './core/exploration';
import {positionVisible} from './core/visibility';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const tactics={free:'自由',rally:'集合',focus:'集火',cautious:'保守'};
function actionRows(s:GameState,u:Unit){
 const h=u.hunterCombat,a=u.alCombat,recovery=Math.max(0,(h?.finalRecoveryUntil??a?.finalRecoveryUntil??0)-s.time);
 const blocked=u.life!=='active'?'无法行动':u.stagger>0||u.forcedMotion||u.ready>0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||s.time<(h?.hurtUntil??a?.hurtUntil??0)?'受控中':u.basicAction?'普攻中':h?.special||a?.special?'动作中':'';
 const ready=(cooldown=0,reason='')=>[blocked||reason,cooldown>0?cooldown.toFixed(1)+'s':''].filter(Boolean).join(' · ')||'就绪';
 if(isHunterV2(s,u))return [['LMB','四段普攻',ready(recovery)],['RMB','方向格挡',ready(0,h?.special?.kind==='guard'?'格挡中':(h?.frost??3)<1?'霜寒不足':'')],['Shift','闪避',ready(h?.dodgeCharges===0?h.dodgeCooldown:0)+` · ${h?.dodgeCharges??2}/2`],['E','盾冲',ready(h?.activeCooldown??0,h?.activeCharge===0&&!(h.activeCooldown>0)?'次数耗尽':'')]];
 if(isAlV2(s,u))return [['LMB','三段普攻',ready(recovery)],['RMB','四发射击',ready(a?.reload??0,(a?.ammo??4)===0?'装弹中':'')+` · ${a?.ammo??4}/4`],['Shift','翻滚',ready(a?.rollCd??0)],['E','火箭弹射',ready(a?.rocketCd??0)]];
 const skills=u.skillSlots??[...equippedSkills(u)];return [['LMB','普攻',ready()],['Shift','机动',ready(u.evasion?.charges===0?u.evasion.progress:0)],...skills.flatMap((id,i)=>id?[[['E','R','T'][i],SKILL_CATALOG[id].name,ready(u.skillStates?.[id]?.cd??0)]]:[])];
}
/** Official component tree has no card, clone, selected-detail or shadow controls. */
export class ExplorationHUD{
 readonly cardMotion=undefined;
 readonly root:HTMLElement;
 private phase='';
 constructor(host:HTMLElement){
  host.insertAdjacentHTML('beforeend',`<div id="hud" class="exploration-hud">
   <section id="duo-status" aria-label="双人状态"></section>
   <nav class="exploration-controls" aria-label="设置与帮助"><span id="clock"></span><button data-action="sound">音效：开</button><button data-action="speed" id="speed-btn">1×</button><button data-action="pause" id="pause-btn">暂停</button><button data-action="help" aria-label="操作说明">帮助</button></nav>
   <div id="journey-status"></div><div id="time-mode" role="status"></div><div id="notice" role="status"></div>
   <section id="action-strip" aria-label="当前主控动作"></section><div id="exploration-objective"></div>
   <div id="phase-panel"></div><div id="dash-directions" hidden></div>
   <div id="help" class="dialog-shade" hidden><section class="dialog help-dialog"><h2>双人探索</h2><p>WASD 移动 · Z 切换主控 · F 选路（左键确认，右键取消）<br>按住 G 选择自由 / 集合 / 集火 / 保守，松开下达。<br>LMB 普攻 · RMB 当前副动作 · Shift 机动 · E 当前主动。<br>其他伙伴仍使用 E/R/T 过渡技能，按动作条显示为准。<br>Space 暂停 · 左 Alt 切换1×/2× · Esc 取消操作。<br>Q / R 新三槽、C 武器形态、V 升级将在后续模块实施。</p><p>本轮采用会话内探索与过渡测试资源；刷新不存档。敌人换代在具名验证入口，普通暗牢尚未整合全部新怪。</p><button data-action="help" class="primary">返回战场</button></section></div>
   <div id="exploration-exit-confirm" class="dialog-shade" hidden><section class="dialog"><h2>确认离开</h2><p>濒死伙伴无法同行；取消可继续探索。死亡规则沿用当前合同。</p><div id="exploration-abandon-list"></div><button data-action="confirm-exploration-exit">确认放弃并离开</button><button data-action="cancel-exploration-exit">取消</button></section></div>
   <div id="record-dialog" class="dialog-shade" hidden><section class="dialog"><h2>探索记录</h2><textarea readonly></textarea><button data-action="close-record">返回</button></section></div><div id="error" class="error-banner" hidden></div>
  </div>`);this.root=host.querySelector('#hud')!;
 }
 private el(id:string){return this.root.querySelector<HTMLElement>('#'+id)!;}
 render(s:GameState,v:UIState){
  const actor=controlledBody(s),battle=s.phase==='battle',party=s.exploration?s.units.filter(u=>isPartyBody(s,u)):[];
  this.el('duo-status').hidden=!battle;this.el('action-strip').hidden=!battle;this.el('journey-status').hidden=!battle;
  const key=party.map(u=>u.id).join('|'),status=this.el('duo-status');
  if(status.dataset.party!==key){status.dataset.party=key;status.innerHTML=party.map(u=>`<article data-body="${esc(u.id)}"><div class="duo-face"><img alt="" src="/assets/portraits/${esc(u.asset)}.png"></div><div class="duo-readout"><header><b>${esc(u.name)}</b><small class="duo-control"></small></header><div class="duo-hp"><i class="duo-gray"></i><i class="duo-health"></i></div><div class="duo-posture"><i></i></div><small class="duo-values"></small><small class="duo-condition"></small></div></article>`).join('')+'<p>Z 切人 · G 战术 · F 选路</p>';}
  for(const u of party){const card=status.querySelector<HTMLElement>(`[data-body="${u.id}"]`)!;card.classList.toggle('controlled',u.id===actor?.id);card.querySelector('.duo-control')!.textContent=u.id===actor?.id?'◆ 主控':'◇ 同行';(card.querySelector('.duo-gray') as HTMLElement).style.width=Math.min(100,(u.hp+u.grayHp)/u.maxHp*100)+'%';(card.querySelector('.duo-health') as HTMLElement).style.width=Math.max(0,u.hp/u.maxHp*100)+'%';(card.querySelector('.duo-posture i') as HTMLElement).style.width=Math.max(0,u.posture/u.maxPosture*100)+'%';card.querySelector('.duo-values')!.textContent=`生命 ${Math.ceil(u.hp)}/${u.maxHp} · 虚血 ${Math.ceil(u.grayHp)} · 架势 ${Math.ceil(u.posture)}/${u.maxPosture}`;const t=s.partyTactics?.[u.id];card.querySelector('.duo-condition')!.textContent=[u.life==='active'?'':u.life,u.stagger>0?'失衡':null,...u.statuses.filter(x=>x.remaining>0).map(x=>x.name||x.kind),u.id===actor?.id?'':`${tactics[t?.kind??'free']}${t?.reason?' · '+t.reason:''}`].filter(Boolean).join(' · ');}
  this.el('clock').textContent=`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;this.el('speed-btn').textContent=v.speed+'×';this.el('pause-btn').textContent=v.paused?'继续':'暂停';this.el('time-mode').textContent=v.paused?'已暂停':v.slow?'战术观察 · 0.1×':'';this.el('notice').textContent=v.notice||s.notice||'';
  this.el('journey-status').textContent=s.context==='explorationBattle'?'交战中':battle?'探索中':'';
  if(actor){this.el('action-strip').dataset.actor=actor.id;this.el('action-strip').innerHTML=`<b>${esc(actor.name)} <small>当前主控</small></b>`+actionRows(s,actor).map(([key,name,value])=>`<div class="action-cell"><kbd>${key}</kbd><span>${esc(name)}</span><small>${esc(value)}</small></div>`).join('');}
  else{this.el('action-strip').dataset.actor='';this.el('action-strip').textContent='当前无可控角色';}
  const obj=this.el('exploration-objective');obj.hidden=!battle;
  if(battle&&s.exploration){const r=s.exploration,check=queryExplorationExit(s,s.units.filter(u=>isPartyBody(s,u)&&u.life==='downed').map(u=>u.id)),known=r.definition.points.filter(p=>positionVisible(s,p.pos)),sig=known.map(p=>p.id+r.memory.mechanisms.includes(p.id)).join('|')+check.ok+check.reason;
   if(obj.dataset.key!==sig){obj.dataset.key=sig;obj.innerHTML=`<details><summary>探索目标 · 抵达出口</summary><p>当前地图：${esc(r.definition.name)}</p>`+known.map(p=>`<button data-exploration-point="${p.id}" ${r.memory.mechanisms.includes(p.id)?'disabled':''}>${p.kind==='campfire'?'篝火休息':p.kind==='resource'?'搜寻生命力':'激活静钟'}</button>`).join('')+`<button data-action="exit-exploration" ${check.ok?'':'disabled'}>离开暗牢</button><small>${esc(check.reason||'已可离开')}</small></details><button data-action="abandon">结束本次探索</button>`;}
  }
  if(this.phase!==s.phase){this.phase=s.phase;this.el('phase-panel').innerHTML=s.phase==='ended'?'<section class="exploration-ended"><h2>本次探索已结束</h2><p>这是会话内原型，当前结算与损耗沿用过渡规则。</p><button class="primary" data-action="new">重新开始</button><button data-action="export">查看记录</button></section>':'';}
 }
 updatePersonal(_s:GameState,_id:string|null,_aim:string|null,_slow:boolean,_project:(p:Pos)=>Pos){}
 error(message:string){this.el('error').hidden=false;this.el('error').textContent=message;}
}
