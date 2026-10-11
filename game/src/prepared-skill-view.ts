import type {Command,GameState} from './core/types';
import {preparedMain,queryPreparedSkillChange,type PreparedOwner} from './core/right-preparation';
import {RIGHT_ABILITIES} from './core/right-hand-skills';
import type {RightAbilityId} from './core/right-skill-state';

/** Inline preparation; no local selection or combat resources. Keep native select focus stable. */
export class PreparedSkillView{
 private root:HTMLElement;
 constructor(host:HTMLElement,private send:(c:Command)=>boolean){
  host.insertAdjacentHTML('beforeend',`<section id="prepared-skills" aria-label="出征前技能整备"><h3>本次出征 · 右手技能</h3><p>两人各自选择；新测试世界沿用。I / II 共用，左手装备不限制技能。</p><div class="prepared-pair">${(['hunter','ranger'] as const).map(id=>`<article data-preparation-body="${id}"><h4>${id==='hunter'?'猎人':'阿尔'}</h4><small data-main-description="${id}"></small>${(['Q','R'] as const).map(key=>`<label><span>${key}</span><select aria-label="${id==='hunter'?'猎人':'阿尔'} ${key} 技能" data-prepared-owner="${id}" data-prepared-key="${key}"><option value="">空槽</option>${Object.values(RIGHT_ABILITIES).filter(a=>!a.native&&a.profession===id).map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select></label>`).join('')}<div class="prepared-fixed"><span>E</span><b>${id==='hunter'?'盾冲':'火箭弹射'}</b><small>本阶段固定</small></div></article>`).join('')}</div><p class="prepared-note">Q / R 为当前实验样板；选择另一槽技能时互换。配置不消耗资源。仅当前页面保留，刷新不存档。</p><p data-prepared-feedback aria-live="polite"></p></section>`);
  this.root=host.querySelector('#prepared-skills')!;
  this.root.addEventListener('change',e=>{
   const el=e.target as HTMLSelectElement;if(!el.matches('[data-prepared-key]'))return;e.stopPropagation();
   const ok=this.send({type:'configurePreparedSkill',id:el.dataset.preparedOwner!,key:el.dataset.preparedKey as 'Q'|'R',abilityId:(el.value||null) as RightAbilityId|null,mainDefinitionId:el.dataset.mainDefinition!});
   this.root.querySelector('[data-prepared-feedback]')!.textContent=ok?'已更新出征方案':'配置未改变，请检查当前阶段与技能资格';
  });
 }
 render(s:GameState){
  this.root.hidden=s.phase!=='account'||s.sessionMode!=='exploration'||s.journey!=='exploration'||!!s.xxExperiment||!!s.world;
  if(this.root.hidden)return;
  for(const id of ['hunter','ranger'] as PreparedOwner[]){
   const p=preparedMain(s,id);const u=s.units.find(u=>u.id===id);
   this.root.querySelector(`[data-main-description=${id}]`)!.textContent=`${u?.weapons[u.weaponIndex]?.name??'主武器不可用'} · ${id==='hunter'?'猎人':'射手'} · 当前主武器`;
   for(const key of ['Q','R'] as const){const el=this.root.querySelector<HTMLSelectElement>(`[data-prepared-owner=${id}][data-prepared-key=${key}]`)!;
    el.dataset.mainDefinition=p?.mainDefinitionId??'';el.disabled=!p;
    for(const option of el.options)option.disabled=!queryPreparedSkillChange(s,id,key,(option.value||null) as RightAbilityId|null,p?.mainDefinitionId??'').ok;
    const value=p?.slots[key]??'';if(el.value!==value)el.value=value;
   }
  }
 }
}
