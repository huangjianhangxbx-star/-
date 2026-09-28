import type {Unit} from './core/types';
export const SKILLS:Record<string,{name:string;icon:string;description:string}>={
 hunter:{name:'猎杀时刻',icon:'✥',description:'持续8秒独立射击；每次命中令敌人短暂眩晕。施法时停止普攻。'},
 fiorre:{name:'生命祷告',icon:'✚',description:'治疗以自身为中心、半径3格内的所有在场队友（含复制体）。施法时停止普攻。'},
 guard:{name:'毒刃连锁',icon:'◈',description:'默认开启。飞刀命中累积敌方毒素；满条引爆周围敌人并重新计量。点击可关闭或开启。'},
 ranger:{name:'狙击姿态',icon:'⌖',description:'切换为无时限狙击模式：攻击间隔延长，单发伤害大幅提升；再次点击恢复常规射击。'},
};
export function skillButton(u:Unit,id=''){const info=SKILLS[u.role];return `<button data-skill="${u.id}" ${id?`id="${id}"`:''} class="skill-key" title="${info?.description||'技能'}"><i class="skill-fill"></i><span class="skill-icon">${info?.icon||'✧'}</span><span class="skill-name">${info?.name||'技能'}</span><strong class="skill-clock"></strong></button>`;}
export function updateSkillButton(b:HTMLButtonElement,u:Unit,battle:boolean){
 const toggle=u.role==='guard'||u.role==='ranger';const remaining=u.skillTime>0?u.skillTime:u.skillCd;const active=u.role==='guard'?u.autoSkill!==false:u.role==='ranger'?!!u.sniperMode:u.skillTime>0;
 b.disabled=!battle||u.life!=='active'||u.ready>0||(!toggle&&remaining>0);
 b.classList.toggle('is-active',active);b.classList.toggle('is-ready',!b.disabled);b.setAttribute('aria-label',(SKILLS[u.role]?.name||'技能')+(toggle?(active?' · 已开启':' · 已关闭'):remaining>0?' · 充能中':' · 就绪'));
 b.querySelector<HTMLElement>('.skill-clock')!.textContent=u.life!=='active'?'待部署':u.ready>0?'始动 '+u.ready.toFixed(3)+'s':toggle?(active?'已开启 · 点击关闭':'点击开启'):remaining>0?remaining.toFixed(3)+'s':'就绪 · 施放';
 const fill=toggle?(active?1:0):remaining>0?(u.skillTime>0?remaining/(u.role==='hunter'?8:2):1-remaining/u.skillMax):1;
 b.querySelector<HTMLElement>('.skill-fill')!.style.height=Math.max(0,Math.min(1,fill))*100+'%';
}
