import type {Unit} from './core/types';
import {skillInfo,SKILL_CATALOG} from './core/skill-catalog';
import {skillInSlot,foregroundSkill} from './core/skill-slots';
import {skillState} from './core/progression';
import {currentSkill,resolveSkill} from './core/skills';
const icons:Record<string,string>={hunt:'✥',prayer:'✚',ward:'◇',bell:'♧',poison:'◈',snipe:'⌖',pain:'❖',sanctuary:'♜',rain:'⋰',dance:'☽',reap:'↝'};
export function skillStatus(u:Unit,slot=0){
 const id=skillInSlot(u,slot);if(!id)return {label:'— 空',fill:0,active:false,canActivate:false};
 const d=SKILL_CATALOG[id],st=skillState(u,id),r=resolveSkill(u,undefined,id);
 if(d.id==='pain')return {label:`痛印 ${st.counter}/8 · 治疗 ${(st.counter*2).toFixed(0)}%`,fill:st.counter/8,active:false,canActivate:st.counter>0};
 if(d.id==='reap')return {label:st.run?'往返斩':`普攻 ${st.counter}/5 · 自动`,fill:st.counter/5,active:!!st.run,canActivate:false};
 if(d.id==='rain')return {label:st.run?`箭雨 ${st.time.toFixed(3)}s · ${st.run.fired}箭`:`自动 · ${st.cd.toFixed(3)}s`,fill:st.run?st.time/r.duration:1-st.cd/r.cooldown,active:!!st.run,canActivate:false};
 if(d.id==='dance')return {label:st.enabled?`镰舞 · ${u.skillSlots?['E','R','T'][slot]:'E'}退出`:`自动 · ${st.cd.toFixed(3)}s`,fill:st.enabled?1:1-st.cd/r.cooldown,active:st.enabled,canActivate:st.enabled};
 const active=d.kind==='toggle'?st.enabled:st.time>0,remaining=st.time||st.cd;
 return {label:d.kind==='toggle'?(active?'已开启 · 点击关闭':'点击开启'):remaining>0?remaining.toFixed(3)+'s':'就绪 · 施放',fill:d.kind==='toggle'?(active?1:0):st.time>0?st.time/(st.snapshot?.duration||r.duration||1):st.cd>0?1-st.cd/(st.max||1):1,active,canActivate:d.kind==='toggle'||remaining<=0};
}
export function skillButton(u:Unit,id='',slot=0){const skillId=skillInSlot(u,slot),info=skillId?SKILL_CATALOG[skillId]:null;return `<button ${slot===0?`data-skill="${u.id}"`:`data-skill-unit="${u.id}"`} data-skill-slot="${slot}" data-skill-preview="${u.id}" ${id?`id="${id}"`:''} class="skill-key ${info?'':'is-empty'}" title="${info?.description||'空技能槽 · 在构筑中装备'}"><i class="skill-fill"></i>${u.skillSlots?`<kbd>${['E','R','T'][slot]}</kbd>`:''}<span class="skill-icon">${info?icons[info.id]:'—'}</span><span class="skill-name">${info?.name||'空'}</span><strong class="skill-clock"></strong></button>`;}
export function updateSkillButton(b:HTMLButtonElement,u:Unit,battle:boolean){
 const slot=Number(b.dataset.skillSlot||0),id=skillInSlot(u,slot),display=skillStatus(u,slot),{active}=display;
 if(!id){b.disabled=true;b.querySelector('.skill-clock')!.textContent='— 空';return;}const info=SKILL_CATALOG[id];
 b.disabled=!!u.forcedMotion||!!u.evasion?.action||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)||(!['toggle','chargedMode'].includes(info.kind)&&!!foregroundSkill(u))||u.stagger>0||!battle||u.life!=='active'||!!u.loadout||!!u.crossing||u.ready>0||!display.canActivate;
 b.classList.toggle('is-active',active);b.classList.toggle('is-ready',!b.disabled||active);b.title=info.description;b.setAttribute('aria-label',info.name+' · '+display.label);
 b.querySelector<HTMLElement>('.skill-name')!.textContent=info.name;b.querySelector<HTMLElement>('.skill-icon')!.textContent=icons[info.id]||'✧';
 b.querySelector<HTMLElement>('.skill-clock')!.textContent=u.stagger>0?'硬直 '+u.stagger.toFixed(1)+'s':u.loadout?'换装中':u.life!=='active'?'待部署':u.ready>0?'始动 '+u.ready.toFixed(3)+'s':display.label;
 const fill=display.fill;
 b.querySelector<HTMLElement>('.skill-fill')!.style.height=Math.max(0,Math.min(1,fill))*100+'%';
}
