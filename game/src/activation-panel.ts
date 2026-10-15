import {RESOURCE_NAMES} from './core/resource-label';
import type {Command,GameState} from './core/types';
import {queryWeaponActivationOpen,queryWeaponActivationUpgrade} from './core/weapon-activation';
import {ACTIVATION_SAMPLE,PASSIVES} from './core/passive-definition';
import {preparedMain} from './core/right-preparation';

/** Modal owns only visibility/request identity. WorldSession owns the level and payment. */
export class ActivationPanel{
 private root:HTMLElement;private worldId:string|null=null;private expectedLevel=0;
 get open(){return this.worldId!==null;}
 constructor(host:HTMLElement,private state:()=>GameState,private release:()=>void,private send:(c:Command)=>boolean,private notice:(s:string)=>void){
  host.insertAdjacentHTML('beforeend',`<div id="activation-panel" class="dialog-shade" hidden role="dialog" aria-modal="true" aria-labelledby="activation-title"><section class="eq-dialog"><header><h2 id="activation-title">双人武器激活</h2><button data-close-activation>关闭 · Esc</button></header><p data-activation-summary></p><div class="eq-columns">${['hunter','ranger'].map(id=>`<section><h3>${id==='hunter'?'猎人':'芙萝蕾茜娅'}</h3><ol data-activation-body="${id}"></ol></section>`).join('')}</div><p data-activation-reason role="status" aria-live="polite"></p><button class="primary" data-activation-upgrade></button><footer>SAMPLE · 费用 4 / 8 / 12；两人同步激活，只支付一份。<br>倍率仅作用于调息及 Q/R 样板，原生 E、普攻和左手不受影响。<br>同世界离区、死亡与返场保留；新测试世界归零。刷新不存档。</footer></section></div>`);
  this.root=host.querySelector('#activation-panel')!;
  this.root.addEventListener('click',e=>{e.stopPropagation();const b=(e.target as HTMLElement).closest('button');if(!b)return;e.preventDefault();if(b.hasAttribute('data-close-activation'))this.close();else if(b.hasAttribute('data-activation-upgrade')&&e.detail<=1&&!b.disabled&&this.expectedLevel<3){this.send({type:'upgradePartyWeaponActivation',worldId:this.worldId!,expectedLevel:this.expectedLevel as 0|1|2});this.render(this.state());}});
  this.root.addEventListener('pointerdown',e=>e.stopPropagation());this.root.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();});
  window.addEventListener('keydown',e=>{if(!this.open)return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')this.close();else if((e.key==='Enter'||e.key===' ')&&!e.repeat)(document.activeElement as HTMLButtonElement)?.click();else if(e.key==='Tab'){const bs=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=bs.indexOf(document.activeElement as HTMLButtonElement);bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length]?.focus();}},true);
 }
 show(){const s=this.state(),check=queryWeaponActivationOpen(s);if(!check.ok){this.notice(check.reason!);return;}this.release();this.worldId=s.world!.id;this.root.hidden=false;this.render(s);this.root.querySelector<HTMLButtonElement>('[data-close-activation]')!.focus();}
 close(){if(!this.open)return;this.worldId=null;this.root.hidden=true;this.release();}
 render(s:GameState){if(!this.open)return;if(s.phase!=='battle'||s.world?.id!==this.worldId||!s.world.visit.active){this.close();return;}
  const level=s.world.activation.activeLevel;this.expectedLevel=level;
  this.root.querySelector('[data-activation-summary]')!.textContent=`共同 Level ${level} / 3 · 随身${RESOURCE_NAMES.vitality} ${s.economy.carried.vitality}`;
  for(const id of ['hunter','ranger']){const ids=preparedMain(s,id)?.preparedPassives,el=this.root.querySelector(`[data-activation-body=${id}]`)!;el.innerHTML=ids?.map((key,i)=>`<li class="${level>i?'passive-active':''}"><b>Level ${i+1} · ${PASSIVES[key].name}</b><small>${level>i?'已激活':'未激活'} · ${PASSIVES[key].effect} · SAMPLE</small></li>`).join('')??'预设不可用';}
  const check=queryWeaponActivationUpgrade(s,this.worldId,level),b=this.root.querySelector<HTMLButtonElement>('[data-activation-upgrade]')!;b.disabled=!check.ok;b.textContent=level===3?'已全部激活':`激活 Level ${level+1} · 支付 ${ACTIVATION_SAMPLE.costs[level]} ${RESOURCE_NAMES.vitality}`;
  this.root.querySelector('[data-activation-reason]')!.textContent=check.ok?'下一次升级为两人各激活一个被动。':check.reason!;
 }
}
