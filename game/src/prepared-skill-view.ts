import {slotControls,branchPreparation} from './trial-loadout-view';
import {trialPreparation,prepareTrialSlot,prepareTrialBranch,type TrialKey,type TrialRoot} from './core/trial-progression';
import {PASSIVES} from './core/passive-definition';
import type {Command,GameState} from './core/types';
import {preparedMain,queryPreparedSkillChange,type PreparedOwner} from './core/right-preparation';
import {RIGHT_ABILITIES} from './core/right-hand-skills';
import type {RightAbilityId} from './core/right-skill-state';

/** Inline preparation; no local selection or combat resources. Keep native select focus stable. */
export class PreparedSkillView{
 private root:HTMLElement;private current?:GameState;private original='';private trialMarkup='';
 private replaceTrialMarkup(markup:string){
  const open=[...this.root.querySelectorAll<HTMLDetailsElement>('details')].map(el=>el.open);
  const focused=this.root.contains(document.activeElement)?document.activeElement?.getAttribute('aria-label'):null;
  this.root.innerHTML=markup;this.trialMarkup=markup;
  this.root.querySelectorAll<HTMLDetailsElement>('details').forEach((el,i)=>el.open=!!open[i]);
  if(focused)this.root.querySelector<HTMLElement>(`[aria-label="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
 }
 constructor(host:HTMLElement,private send:(c:Command)=>boolean){
  host.insertAdjacentHTML('beforeend',`<section id="prepared-skills" aria-label="出征前技能整备"><h3>本次出征 · 右手技能</h3><p>两人各自选择；新测试世界沿用。I / II 共用，左手装备不限制技能。</p><div class="prepared-pair">${(['hunter','ranger'] as const).map(id=>`<article data-preparation-body="${id}"><h4>${id==='hunter'?'猎人':'芙蕾茜娅'}</h4><small data-main-description="${id}"></small>${(['Q','R'] as const).map(key=>`<label><span>${key}</span><select aria-label="${id==='hunter'?'猎人':'芙蕾茜娅'} ${key} 技能" data-prepared-owner="${id}" data-prepared-key="${key}"><option value="">空槽</option>${Object.values(RIGHT_ABILITIES).filter(a=>!a.native&&a.profession===id).map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select></label>`).join('')}<div class="prepared-fixed"><span>E</span><b>${id==='hunter'?'盾冲':'火箭弹射'}</b><small>本阶段固定</small></div><p data-prepared-passives="${id}"></p></article>`).join('')}</div><p class="prepared-note">Q / R 为当前实验样板；选择另一槽技能时互换。配置不消耗资源。仅当前页面保留，刷新不存档。</p><p data-prepared-feedback aria-live="polite"></p></section>`);
  this.root=host.querySelector('#prepared-skills')!;this.original=this.root.innerHTML;
  this.root.addEventListener('change',e=>{
   const el=e.target as HTMLSelectElement;if(el.dataset.trialBranchRoot&&this.current){e.stopPropagation();prepareTrialBranch(this.current,el.dataset.trialOwner as 'hunter'|'ranger',el.dataset.trialBranchRoot as TrialRoot,Number(el.dataset.trialTier),el.value||null);this.render(this.current);return;}if(el.dataset.trialSlot&&this.current){e.stopPropagation();prepareTrialSlot(this.current,el.dataset.trialOwner as 'hunter'|'ranger',el.dataset.trialSlot as TrialKey,(el.value||null) as TrialRoot|null);this.render(this.current);return;}if(!el.matches('[data-prepared-key]'))return;e.stopPropagation();
   const ok=this.send({type:'configurePreparedSkill',id:el.dataset.preparedOwner!,key:el.dataset.preparedKey as 'Q'|'R',abilityId:(el.value||null) as RightAbilityId|null,mainDefinitionId:el.dataset.mainDefinition!});
   this.root.querySelector('[data-prepared-feedback]')!.textContent=ok?'已更新出征方案':'配置未改变，请检查当前阶段与技能资格';
  });
 }
 render(s:GameState){this.current=s;
  this.root.hidden=s.phase!=='account'||s.sessionMode!=='exploration'||s.journey!=='exploration'||!!s.xxExperiment||!!s.world;
  if(this.root.hidden)return;
  if(s.abilityTrial&&s.trialProgression){const prep=trialPreparation(s),markup='<h3>实验职业技能 · 出征前整备</h3><p>Q / E / R 独立配置，选中另一槽已有技能时互换。未实现职业根保留目录但不可选。</p>'+(['hunter','ranger'] as const).map(id=>`<article><h4>${id==='hunter'?'猎人':'芙蕾茜娅'}</h4>${slotControls(prep[id],id==='hunter'?'blue':'yellow',id)}${branchPreparation(prep[id],id==='hunter'?'blue':'yellow',id)}</article>`).join('')+'<p>新世界从 Level 0 开始。进入后点击“编辑技能” 指定技能、选择实际 A/B 分支并支付。无固定被动槽。</p>';if(markup!==this.trialMarkup)this.replaceTrialMarkup(markup);return;}
  if(this.trialMarkup){this.root.innerHTML=this.original;this.trialMarkup='';}
  for(const id of ['hunter','ranger'] as PreparedOwner[]){
   const p=preparedMain(s,id);this.root.querySelector(`[data-prepared-passives=${id}]`)!.textContent=p?.preparedPassives.map((k,i)=>`L${i+1} ${PASSIVES[k].name}`).join(' · ')+' · 固定实验被动，本阶段不可改选；世界内点击激活按钮';const u=s.units.find(u=>u.id===id);
   this.root.querySelector(`[data-main-description=${id}]`)!.textContent=`${u?.weapons[u.weaponIndex]?.name??'主武器不可用'} · ${id==='hunter'?'猎人':'射手'} · 当前主武器`;
   for(const key of ['Q','R'] as const){const el=this.root.querySelector<HTMLSelectElement>(`[data-prepared-owner=${id}][data-prepared-key=${key}]`)!;
    el.dataset.mainDefinition=p?.mainDefinitionId??'';el.disabled=!p;
    for(const option of el.options)option.disabled=!queryPreparedSkillChange(s,id,key,(option.value||null) as RightAbilityId|null,p?.mainDefinitionId??'').ok;
    const value=p?.slots[key]??'';if(el.value!==value)el.value=value;
   }
  }
 }
}
