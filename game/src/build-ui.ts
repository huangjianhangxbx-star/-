import {skillInSlot,foregroundSkill} from './core/skill-slots';
import {skillState} from './core/progression';
import {TENDENCIES} from './core/autonomy';
import type {GameState,Unit} from './core/types';
import {SKILL_CATALOG,professionOf,skillInfo} from './core/skill-catalog';
import {skillStatus} from './skill-ui';
import {currentSkill,resolveSkill} from './core/skills';
import {canConfigure} from './core/loadout';

const names:Record<string,string>={hunter:'巡夜猎手',healer:'守夜司祭',cantor:'霜镜使',guard:'毒刃守卫',ranger:'弓手',shieldguard:'回响盾卫',scythe:'镰舞者'};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class BuildPanel {
 readonly el:HTMLElement;private stamp='';selectedSlot=0;selectedSkillId:import('./core/types').SkillId|undefined;
 constructor(host:HTMLElement){host.insertAdjacentHTML('beforeend','<aside id="build-panel" hidden aria-label="职业与构筑"></aside>');this.el=host.querySelector('#build-panel')!;}
 render(s:GameState,open:boolean,unitId:string){
  this.el.hidden=!open;if(!open)return;
  const u=s.units.find(u=>u.id===unitId&&u.team==='ally'&&!u.cloneOf)||s.units.find(u=>u.id==='fiorre')!;
  const id=skillInSlot(u,u.skillSlots?this.selectedSlot:0);this.selectedSkillId=id??undefined;
  const d=id?SKILL_CATALOG[id]:skillInfo(u),st=id?skillState(u,id):currentSkill(u),r=resolveSkill(u,undefined,d.id),caps=s.profile!.unlockCaps[d.id];
  const editable=!!u.skillSlots||canConfigure(s),purchasable=!!id&&['briefing','battle','nodes'].includes(s.phase),count=Object.values(st.branches).filter(n=>n>0).length;
  const key=JSON.stringify([this.selectedSlot,u.skillSlots,u.aiTendency,u.id,u.life,u.weaponIndex,u.skillId,st.stage,st.branches,s.fragments,caps,editable,!!u.loadout,s.phase]);
  if(key!==this.stamp){this.stamp=key;
   const stage=d.stages[st.stage],limit=Math.min(d.stages.length,caps.stage),canStage=purchasable&&!!stage&&st.stage<limit&&s.fragments>=stage.cost;
   this.el.innerHTML=`<header><div><small>FIELD JOURNAL / 构筑手册</small><h2>职业与构筑</h2></div><button data-action="close-build" aria-label="关闭构筑">×</button></header>
    <nav class="build-roster">${s.units.filter(a=>a.team==='ally'&&!a.cloneOf).map(a=>`<button data-build-unit="${a.id}" class="${a.id===u.id?'chosen':''}">${esc(a.name)}</button>`).join('')}</nav>
    <div class="build-summary"><img src="/assets/portraits/${u.asset}.png" alt=""><div><small>${names[professionOf(u)]}</small><h3>${esc(u.name)}</h3><span>${esc(u.weapons[u.weaponIndex].name)}</span></div><b>${Math.floor(s.fragments)}<small>随身生命力</small></b></div>
    <p class="build-context">${u.skillSlots?(s.phase==='battle'?'战斗临时换槽 · 返回整备后仍用默认配置':'整备默认技能槽'):editable?'整备阶段 · 可选择本职业默认技能':'战斗构筑 · 同职业技能锁定，允许提升已装备技能'}<br><small>培养、抽牌与召影共用余额；本轮未接正式生命力经济。</small></p>
    <section class="build-tendency"><div class="build-label">首要倾向 <span>队友局部行动</span></div><div class="tendency-options">${Object.entries(TENDENCIES).map(([id,label])=>`<button data-ai-tendency="${id}" aria-pressed="${(u.aiTendency||'default')===id}" ${!editable?'disabled':''} class="${(u.aiTendency||'default')===id?'chosen':''}">${label}</button>`).join('')}</div><p class="build-muted">围绕你指定的位置微调；选中或下令立即接管。倾向不扩大活动范围。</p></section>
    ${u.skillSlots?`<nav class="build-slot-tabs">${[0,1,2].map(slot=>`<button data-build-slot="${slot}" class="${this.selectedSlot===slot?'chosen':''}"><kbd>${['E','R','T'][slot]}</kbd> ${skillInSlot(u,slot)?esc(SKILL_CATALOG[skillInSlot(u,slot)!].name):'— 空'}</button>`).join('')}</nav>`:''}<section><div class="build-label">装备技能 <span>${editable?'可配置':'已锁定'}</span></div><div class="build-skills">${Object.values(SKILL_CATALOG).filter(a=>a.profession===professionOf(u)).map(a=>`<button data-config-skill="${a.id}" ${!editable||a.id===id||!!u.skillSlots?.includes(a.id)||!!id&&foregroundSkill(u)===id&&id!==a.id?'disabled':''} class="${a.id===id?'chosen':''}">${esc(a.name)}${a.id===id?'<small>当前装备</small>':''}</button>`).join('')}${u.skillSlots&&this.selectedSlot>0?`<button data-config-skill="empty" ${id&&foregroundSkill(u)!==id?'':'disabled'}>卸下 · 空槽</button>`:''}</div><p>${id?esc(d.description):'空槽 · 选择本职业已有技能。不能重复装备。'}</p><p class="build-numbers">范围 ${r.range.toFixed(1)} · ${d.kind==='toggle'?'持续模式':d.kind==='count'?'直接受击蓄印 · 手动':d.kind==='return'?'5次普攻 · 自动往返':d.kind==='chargedMode'?`充能 ${r.cooldown}s · 自动无限模式`:`施法 ${r.duration}s / 充能 ${r.cooldown}s${d.kind==='auto'?' · 自动':''}`}<span data-build-clock></span></p></section>
    <p class="build-numbers">当前进阶效果：${esc(st.stage?d.stages[st.stage-1].description:'基础技能')} · 当前分支：${esc(d.branches.filter(b=>(st.branches[b.id]||0)>0).map(b=>b.name+' Lv'+st.branches[b.id]).join('、')||'尚未选择')}</p><section><div class="build-label">线性进阶 <span>${st.stage} / ${d.stages.length} · 解锁上限 ${limit}</span></div>${d.stages.length?`<p>${stage?esc(stage.description):'已达到本轮最高进阶'}</p><button data-buy-stage data-level="${st.stage}" ${canStage?'':'disabled'}>${!purchasable?'当前阶段不可培养':st.stage>=limit?(st.stage>=d.stages.length?'进阶已满':'局外上限锁定'):s.fragments<stage.cost?`生命力不足 · ${stage.cost}`:`提升至进阶 ${st.stage+1} · ${stage.cost}生命力`}</button>`:'<p class="build-muted">此技能保留现有能力。</p>'}</section>
    <section><div class="build-label">技能分支 <span>已选 ${count} / 2</span></div><div class="build-branches">${d.branches.map(b=>{const level=st.branches[b.id]||0,next=b.levels[level],cap=Math.min(b.levels.length,caps.branches[b.id]||0),locked=!level&&count>=2;const reason=!purchasable?'当前阶段不可培养':locked?'本副本名额已满':level>=cap?(level>=b.levels.length?'已达最高等级':'局外上限锁定'):next&&s.fragments<next.cost?'生命力不足':null;return `<article class="${level?'purchased':''}"><h4>${esc(b.name)}<span>${level} / ${b.levels.length}</span></h4>${level?`<p>当前：${esc(b.levels[level-1].description)}</p>`:''}${next?`<p>${level?'下一级：':''}${esc(next.description)}</p>`:''}<small>解锁上限 ${cap}${level?' · 已选路线':''}</small><button data-buy-branch="${b.id}" data-level="${level}" ${reason?'disabled':''}>${reason||`购买 Lv${level+1} · ${next.cost}生命力`}</button></article>`}).join('')}</div></section>
    <section><div class="build-label">本次携带武器 <span>${editable?'战前配装':'换装 0.8s'}</span></div><div class="build-weapons">${u.weapons.map((w,i)=>`<button data-weapon-index="${i}" ${i===u.weaponIndex||!!u.loadout||!(u.life==='active'||editable&&['reserve','withdrawn'].includes(u.life))?'disabled':''} class="${i===u.weaponIndex?'chosen':''}"><b>${esc(w.name)}</b><small>${names[w.profession||professionOf(u)]} · ${w.remote?'远程':'近战'} ${w.range} · ${w.shadow?'影武器':`耐久 ${w.durability}/${w.maxDurability}`}</small></button>`).join('')}</div><p data-loadout-clock>${u.loadout?'换装中…':!editable&&u.life!=='active'?'战斗换装需本体在场；影庭不等于脱战。':'移动取消换装；受击不中断。复制体保留出生配置。'}</p></section>
    <footer>节点间保留培养 · 新副本清空培养<br>本轮原型内容，可在后续版本调整。</footer>`;
  }
  this.el.querySelector('[data-build-clock]')!.textContent=' · '+skillStatus(u,u.skillSlots?this.selectedSlot:0).label;
  if(u.loadout)this.el.querySelector('[data-loadout-clock]')!.textContent='换装中 · '+Math.max(0,u.loadout.duration-u.loadout.elapsed).toFixed(3)+'s';
 }
}
