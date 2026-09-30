import type {Unit} from './core/types';
import {skillInfo} from './core/skill-catalog';
import {currentSkill,resolveSkill} from './core/skills';
const icons:Record<string,string>={hunt:'✥',prayer:'✚',ward:'◇',bell:'♧',poison:'◈',snipe:'⌖'};
export function skillButton(u:Unit,id=''){const info=skillInfo(u);return `<button data-skill="${u.id}" ${id?`id="${id}"`:''} class="skill-key" title="${info.description}"><i class="skill-fill"></i><span class="skill-icon">${icons[info.id]||'✧'}</span><span class="skill-name">${info.name}</span><strong class="skill-clock"></strong></button>`;}
export function updateSkillButton(b:HTMLButtonElement,u:Unit,battle:boolean){
 const info=skillInfo(u),st=currentSkill(u),r=resolveSkill(u),toggle=info.kind==='toggle',remaining=u.skillTime>0?u.skillTime:u.skillCd,active=toggle?st.enabled:u.skillTime>0;
 b.disabled=!battle||u.life!=='active'||!!u.loadout||!!u.crossing||u.ready>0||(!toggle&&remaining>0);
 b.classList.toggle('is-active',active);b.classList.toggle('is-ready',!b.disabled);b.title=info.description;b.setAttribute('aria-label',info.name+(toggle?(active?' · 已开启':' · 已关闭'):remaining>0?' · 充能中':' · 就绪'));
 b.querySelector<HTMLElement>('.skill-name')!.textContent=info.name;b.querySelector<HTMLElement>('.skill-icon')!.textContent=icons[info.id]||'✧';
 b.querySelector<HTMLElement>('.skill-clock')!.textContent=u.loadout?'换装中':u.life!=='active'?'待部署':u.ready>0?'始动 '+u.ready.toFixed(3)+'s':toggle?(active?'已开启 · 点击关闭':'点击开启'):remaining>0?remaining.toFixed(3)+'s':'就绪 · 施放';
 const fill=toggle?(active?1:0):remaining>0?(u.skillTime>0?remaining/(st.snapshot?.duration||r.duration||1):1-remaining/u.skillMax):1;
 b.querySelector<HTMLElement>('.skill-fill')!.style.height=Math.max(0,Math.min(1,fill))*100+'%';
}
