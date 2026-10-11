import {querySwitchMainForm} from './core/main-form';
import type {MainFormId} from './core/main-form-spec';
import type {GameState,Unit} from './core/types';
import {equipmentBusy,queryEquipOffhand} from './core/equipment';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const rules={guard:'按住 RMB 方向格挡 · E 为右手技能',shot:'按住 RMB 四发射击 · 原装弹循环',bomb:'RMB 单按投一颗 · 20体力 · 5秒冷却'};
/** A view of core equipment, never a second loadout store. */
export class EquipmentPanel{
 private root:HTMLElement;private actorId:string|null=null;private markup='';
 get open(){return this.actorId!==null;}
 constructor(host:HTMLElement,private state:()=>GameState,private release:()=>void,private equip:(u:Unit,id:string)=>void,private notice:(s:string)=>void,private switchForm:(u:Unit,form:MainFormId)=>void){
 host.insertAdjacentHTML('beforeend','<div id="equipment-panel" class="dialog-shade" hidden role="dialog" aria-modal="true" aria-label="双手装备"><section class="eq-dialog"></section></div>');this.root=host.querySelector('#equipment-panel')!;
 host.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[data-hand],[data-equip-instance],[data-main-form],[data-close-equipment]');if(!target)return;e.preventDefault();e.stopPropagation();
  if(target.hasAttribute('data-close-equipment')){this.close();return;}
  const s=this.state(),u=s.units.find(u=>u.id===(target.closest<HTMLElement>('[data-body]')?.dataset.body??this.actorId));if(!u?.equipment)return;
  if(target.hasAttribute('data-hand')){if(equipmentBusy(u)){this.notice('动作尚未结束，松开按键后再打开装备');return;}this.release();this.actorId=u.id;this.root.hidden=false;this.markup='';this.render(s);this.root.querySelector<HTMLElement>('[data-close-equipment]')?.focus();}
  else if(this.open&&target.hasAttribute('data-main-form')){this.switchForm(u,target.dataset.mainForm as MainFormId);this.render(this.state());}
  else if(this.open){this.equip(u,target.dataset.equipInstance!);this.render(this.state());}
 });
 window.addEventListener('keydown',e=>{if(!this.open)return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')this.close();else if(e.key==='Enter'||e.key===' '){(document.activeElement as HTMLButtonElement)?.click();}else if(e.key==='Tab'){const buttons=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}},true);
 this.root.addEventListener('pointerdown',e=>{e.stopPropagation();});this.root.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();});
 }
 close(){this.actorId=null;this.root.hidden=true;this.release();}
 render(s:GameState){if(!this.open)return;const u=s.units.find(u=>u.id===this.actorId);if(!u?.equipment||s.phase!=='battle'){this.close();return;}const eq=u.equipment,right=eq.equipped.right,left=eq.equipped.left;
 const markup=`<header><h2>${esc(u.name)} · 双手装备</h2><button data-close-equipment aria-label="关闭装备">关闭 · Esc</button></header><div class="eq-columns"><section><h3>右手 · 主装备</h3><b>${esc(right.weapon.name)}</b><p>LMB · 形态 ${right.currentForm}</p><p>耐久 ${right.weapon.durability}/${right.weapon.maxDurability}</p><small>${esc(right.id)}</small><div class="eq-options">${(['I','II'] as const).map(form=>{const check=querySwitchMainForm(s,u,form),selected=right.currentForm===form;return `<button data-main-form="${form}" class="${selected?'equipped':''}" ${selected||!check.ok?'disabled':''}><strong>形态 ${form}${selected?' · 当前':''}</strong><small>${form==='I'?'原黄金连段':u.id==='hunter'?'a3 → a4 · 两段重击 SAMPLE':'a2 → a3 · 两段重击 SAMPLE'}</small>${!check.ok?`<small>${esc(check.reason??'')}</small>`:''}</button>`;}).join('')}</div><p>C 切形态 · II 范围、架势更强，衔接更慢。共用这一件主武器的耐久，不影响左手。</p></section><section><h3>左手 · 副装备</h3><b>${esc(left.name)}</b><p>耐久 ${left.durability}/${left.maxDurability} · ${left.cd>0?'冷却 '+left.cd.toFixed(1)+'s':'冷却就绪'}</p><small>${esc(left.id)}</small><div class="eq-options">${eq.owned.map(item=>{const check=queryEquipOffhand(s,u,item.id),selected=item===left;return `<button data-equip-instance="${esc(item.id)}" data-equipment-action="${item.action}" ${selected||!check.ok?'disabled':''} class="${selected?'equipped':''}"><span class="eq-icon ${item.action}">${item.action==='bomb'?'●':item.action==='guard'?'◇':'┤'}</span><strong>${esc(item.name)}${selected?' · 已装备':''}</strong><span>耐久 ${item.durability}/${item.maxDurability}${item.durability<=0?' · 损坏':''}</span><small>${rules[item.action]}</small>${!check.ok?`<small>${esc(check.reason??'')}</small>`:''}</button>`;}).join('')}</div></section></div><footer>副手仅脱战更换；形态须当前主控且动作结束 · 两人装备互不共用 · SAMPLE，暂不提供维修<br>炸弹一按一颗；猎人换炸弹后不能举盾；两人 E 属右手技能，独立保留。离手 AI 暂不会投弹。</footer>`;
 if(markup!==this.markup){this.root.querySelector('section')!.innerHTML=markup;this.markup=markup;}
 }
}
