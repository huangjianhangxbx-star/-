import type {Unit} from './core/types';
import {skillInfo} from './core/skill-catalog';
import {currentSkill,resolveSkill} from './core/skills';
const icons:Record<string,string>={hunt:'✥',prayer:'✚',ward:'◇',bell:'♧',poison:'◈',snipe:'⌖',pain:'❖',sanctuary:'♜',rain:'⋰',dance:'☽',reap:'↝'};
export function skillStatus(u:Unit){
 const d=skillInfo(u),st=currentSkill(u),r=resolveSkill(u);
 if(d.id==='pain')return {label:`痛印 ${st.counter}/8 · 治疗 ${(st.counter*2).toFixed(0)}%`,fill:st.counter/8,active:false,canActivate:st.counter>0};
 if(d.id==='reap')return {label:st.run?'往返斩':`普攻 ${st.counter}/5 · 自动`,fill:st.counter/5,active:!!st.run,canActivate:false};
 if(d.id==='rain')return {label:st.run?`箭雨 ${st.time.toFixed(3)}s · ${st.run.fired}箭`:`自动 · ${st.cd.toFixed(3)}s`,fill:st.run?st.time/r.duration:1-st.cd/r.cooldown,active:!!st.run,canActivate:false};
 if(d.id==='dance')return {label:st.enabled?'镰舞 · E退出':`自动 · ${st.cd.toFixed(3)}s`,fill:st.enabled?1:1-st.cd/r.cooldown,active:st.enabled,canActivate:st.enabled};
 const active=d.kind==='toggle'?st.enabled:st.time>0,remaining=st.time||st.cd;
 return {label:d.kind==='toggle'?(active?'已开启 · 点击关闭':'点击开启'):remaining>0?remaining.toFixed(3)+'s':'就绪 · 施放',fill:d.kind==='toggle'?(active?1:0):st.time>0?st.time/(st.snapshot?.duration||r.duration||1):st.cd>0?1-st.cd/(st.max||1):1,active,canActivate:d.kind==='toggle'||remaining<=0};
}
export function skillButton(u:Unit,id=''){const info=skillInfo(u);return `<button data-skill="${u.id}" ${id?`id="${id}"`:''} class="skill-key" title="${info.description}"><i class="skill-fill"></i><span class="skill-icon">${icons[info.id]||'✧'}</span><span class="skill-name">${info.name}</span><strong class="skill-clock"></strong></button>`;}
export function updateSkillButton(b:HTMLButtonElement,u:Unit,battle:boolean){
 const info=skillInfo(u),display=skillStatus(u),{active}=display;
 b.disabled=!battle||u.life!=='active'||!!u.loadout||!!u.crossing||u.ready>0||!display.canActivate;
 b.classList.toggle('is-active',active);b.classList.toggle('is-ready',!b.disabled||active);b.title=info.description;b.setAttribute('aria-label',info.name+' · '+display.label);
 b.querySelector<HTMLElement>('.skill-name')!.textContent=info.name;b.querySelector<HTMLElement>('.skill-icon')!.textContent=icons[info.id]||'✧';
 b.querySelector<HTMLElement>('.skill-clock')!.textContent=u.loadout?'换装中':u.life!=='active'?'待部署':u.ready>0?'始动 '+u.ready.toFixed(3)+'s':display.label;
 const fill=display.fill;
 b.querySelector<HTMLElement>('.skill-fill')!.style.height=Math.max(0,Math.min(1,fill))*100+'%';
}
