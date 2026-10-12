import {FIELD_LAMP,querySampleLightUse,type SampleLightRequest} from './core/environment-sample';
import {queryTransferAlItem,queryAlPriority,type AlItemRequest} from './core/al-items';
import type {Command,GameState} from './core/types';
import {farmItem,inventoryQuantity,queryBackpack,queryAssignHotbar,queryAssignCompanionFreeItem,type InventoryVisit} from './core/world-inventory';

type Drag={pointerId:number;source:HTMLElement;itemId:string;token:InventoryVisit;revision:number;sourceKind:'team'|'reserve'};
const digit=(code:string)=>/^Digit[0-9]$/.test(code)?(Number(code.slice(5))+9)%10:null;
/** UI holds request identity and physical inputs; WorldSession alone holds inventory. */
export class BackpackPanel{
 private root:HTMLElement;private ghost:HTMLElement;private token:InventoryVisit|null=null;
 private selectedSource:'team'|'reserve'='team';private selected:string|null=null;private drag:Drag|null=null;private blockedDigits=new Set<string>();
 private ownership='';private previousFocus:HTMLElement|null=null;private suppressClickUntil=0;
 get open(){return this.token!==null;}
 constructor(private host:HTMLElement,private state:()=>GameState,private release:()=>void,private send:(c:Command)=>boolean,private notice:(s:string)=>void,private allowed:()=>boolean,private lightAllowed:()=>boolean){
  host.insertAdjacentHTML('beforeend',`<section id="backpack-panel" hidden role="dialog" aria-modal="true" aria-labelledby="backpack-title"><header><div><small>当前世界 · 团队库存</small><h2 id="backpack-title">背包</h2></div><button data-close-backpack>关闭 · Tab / Esc</button></header><p>团队物品可绑定数字栏，或交给阿尔。后备道具可设优先；优先考虑不代表立即使用。右键自由槽清空意图。</p><div class="inventory-columns"><section><div data-inventory-list></div><p data-inventory-empty hidden>背包为空 · 当前没有可绑定的团队物品。</p><div class="al-transfer-actions"><button data-use-field-lamp hidden disabled>点亮照明 · 消耗1</button><button data-give-al disabled>交给阿尔 ×1</button><button data-bind-companion disabled>交给阿尔并设优先 ×1</button></div></section><section><h3>阿尔后备 <small>5槽 · 同类叠加</small></h3><div data-al-reserve-list></div><div class="al-transfer-actions"><button data-priority-al disabled>设为优先</button><button data-withdraw-al disabled>收回团队 ×1</button></div></section></div><p data-backpack-feedback role="status" aria-live="polite">选择一件物品。</p><footer>农具开垦/收获、种子播种：选择数字栏后靠近试验田左键。交付后托管阿尔会先治疗，再择机投弹；炸弹优先可单敌，普通后备需双敌。便携灯需进入南侧支廊暗区后在背包点亮，阿尔不会自动使用；均为SAMPLE，不自动种田。<br>实验库存 · SAMPLE；同世界保留，刷新不存档。背包打开时暂停。</footer></section><div data-drag-ghost hidden aria-hidden="true"></div>`);
  this.root=host.querySelector('#backpack-panel')!;this.ghost=host.querySelector('[data-drag-ghost]')!;
  window.addEventListener('keydown',e=>{
   const slot=digit(e.code),text=(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]');
   if(slot!==null){if(!text)e.preventDefault();if(e.repeat||this.blockedDigits.has(e.code))return;this.blockedDigits.add(e.code);if(!text&&(this.open||this.allowed()))this.slot(slot);return;}
   if(!this.open){if(e.code==='Tab'&&!text){e.preventDefault();if(!e.repeat&&this.allowed())this.show();}return;}
   e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
   if(e.code==='Tab'||e.code==='Escape'){this.close();return;}
   if(e.code==='Enter'||e.code==='Space'){(document.activeElement as HTMLButtonElement)?.click();return;}
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){const bs=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=bs.indexOf(document.activeElement as HTMLButtonElement),d=['ArrowUp','ArrowLeft'].includes(e.code)?-1:1;bs[(i+d+bs.length)%bs.length]?.focus();}
  },true);
  window.addEventListener('keyup',e=>this.blockedDigits.delete(e.code),true);
  window.addEventListener('pointerdown',e=>{
   if(!this.open)return;const item=(e.target as HTMLElement).closest<HTMLElement>('[data-inventory-item],[data-al-item]');
   if(item&&e.button===0){e.preventDefault();e.stopImmediatePropagation();this.selected=item.dataset.inventoryItem??item.dataset.alItem!;this.selectedSource=item.hasAttribute('data-al-item')?'reserve':'team';item.focus();this.cancelDrag();this.drag={pointerId:e.pointerId,source:item,itemId:this.selected,token:{...this.token!},revision:this.state().world!.backpack!.alReserve.revision,sourceKind:this.selectedSource};item.setPointerCapture(e.pointerId);this.ghost.textContent=farmItem(this.selected)!.name;this.ghost.hidden=false;this.move(e);this.render(this.state());return;}
   if(!(e.target as HTMLElement).closest('#backpack-panel,#quick-reserved,[data-companion-free-item]')){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.addEventListener('pointermove',e=>{if(!this.drag)return;e.preventDefault();e.stopImmediatePropagation();this.move(e);},true);
  window.addEventListener('pointerup',e=>{if(!this.drag||e.pointerId!==this.drag.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const d=this.drag,b=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-hotbar-index],[data-companion-free-item],[data-al-reserve-index]');this.cancelDrag();if(b&&this.valid()){this.bindTarget(b,d.itemId,d.token,d.sourceKind,d.revision);}else this.feedback('已取消拖拽 · 请松在数字格或阿尔自由栏内');this.render(this.state());},true);
  window.addEventListener('pointercancel',()=>this.cancelDrag('已取消拖拽'),true);
  this.root.addEventListener('lostpointercapture',e=>{if(this.drag?.source===e.target&&this.drag.pointerId===(e as PointerEvent).pointerId)this.cancelDrag();});
  window.addEventListener('click',e=>{
   if(e.detail>0&&performance.now()<this.suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return;}
   if(this.open&&!(e.target as HTMLElement).closest('#backpack-panel,#quick-reserved,[data-companion-free-item]')){e.preventDefault();e.stopImmediatePropagation();return;}
   const target=(e.target as HTMLElement).closest<HTMLElement>('[data-inventory-item],[data-close-backpack],[data-reserve-kind=backpack],[data-hotbar-index],[data-companion-free-item],[data-bind-companion],[data-al-item],[data-give-al],[data-priority-al],[data-withdraw-al],[data-use-field-lamp]');if(!target)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(target.hasAttribute('data-close-backpack'))this.close();
   else if(target.hasAttribute('data-inventory-item')||target.hasAttribute('data-al-item')){this.selected=target.dataset.inventoryItem??target.dataset.alItem!;this.selectedSource=target.hasAttribute('data-al-item')?'reserve':'team';this.feedback(`已选${farmItem(this.selected)!.name} · ${this.selected===FIELD_LAMP?'在南侧暗区点亮，数字栏不直接消费':'按数字键绑定'}`);this.render(this.state());}
   else if(target.hasAttribute('data-use-field-lamp')){if(this.open&&this.valid()&&this.selectedSource==='team'&&this.selected===FIELD_LAMP){this.cancelDrag();if(!this.lightAllowed()){this.feedback('先结束暂停、其它模态或失焦，再点亮照明');return;}if(this.send({type:'useSampleLight',...this.lightRequest()}))this.feedback(this.state().notice);this.render(this.state());}}
   else if(target.hasAttribute('data-give-al')||target.hasAttribute('data-withdraw-al')||target.hasAttribute('data-priority-al')){if(this.open&&this.valid()&&this.selected){this.cancelDrag();const c:Command={type:target.hasAttribute('data-priority-al')?'setAlPriority':'transferAlItem',...this.itemRequest(this.selected,this.selectedSource)};if(this.send(c))this.feedback(this.state().notice);this.render(this.state());}}
   else if(target.hasAttribute('data-bind-companion')||target.hasAttribute('data-companion-free-item')){if(this.open&&this.valid()&&this.selected){this.cancelDrag();this.bindTarget(this.host.querySelector('[data-companion-free-item]')!,this.selected,this.token!,this.selectedSource);this.render(this.state());}else if(this.allowed())this.notice('Tab打开背包以交付或设置阿尔优先意图');}
   else if(target.hasAttribute('data-hotbar-index')){if(this.open||this.allowed())this.slot(Number(target.dataset.hotbarIndex));}
   else if(this.open)this.close();else if(this.allowed())this.show();
  },true);
  window.addEventListener('contextmenu',e=>{
   const b=(e.target as HTMLElement).closest<HTMLElement>('[data-hotbar-index],[data-companion-free-item]');if(!b&&!this.open)return;e.preventDefault();e.stopImmediatePropagation();if(this.drag){this.cancelDrag('已取消拖拽');return;}
   if(b&&(this.open||this.allowed())){const w=this.state().world;if(w){const request={worldId:w.id,visit:w.visit.generation};const c:Command=b.hasAttribute('data-companion-free-item')?{type:'clearCompanionFreeItem',...request,ownerId:'ranger'}:{type:'clearHotbar',...request,slot:Number(b.dataset.hotbarIndex)};if(this.send(c))this.feedback(`已解除 ${b.hasAttribute('data-companion-free-item')?'阿尔自由栏':b.dataset.slot} 绑定 · 库存保留`);this.render(this.state());}}
  },true);
  window.addEventListener('blur',()=>this.close());window.addEventListener('resize',()=>this.cancelDrag('窗口变化，已取消拖拽'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.close();});
 }
 private lightRequest():SampleLightRequest{const s=this.state();return {...this.token!,actorId:s.controlledBodyId!,controlRevision:s.controlRevision??0,expectedRevision:s.world?.sampleLight?.revision??-1};}
 private identity(s:GameState){return `${s.controlledBodyId}|${s.controlRevision}|${s.inputEpoch}`;}
 private valid(){const s=this.state();return !!this.token&&s.world?.id===this.token.worldId&&s.world.visit.generation===this.token.visit&&this.ownership===this.identity(s)&&queryBackpack(s).ok;}
 private feedback(message:string){this.root.querySelector('[data-backpack-feedback]')!.textContent=message;this.notice(message);}
 show(){const s=this.state(),q=queryBackpack(s);if(!q.ok){this.notice(q.reason!);return;}this.previousFocus=document.activeElement as HTMLElement;this.release();this.token={worldId:s.world!.id,visit:s.world!.visit.generation};this.ownership=this.identity(s);this.selected=null;this.root.hidden=false;this.host.classList.add('backpack-open');this.feedback('选择一件物品，拖拽或用数字键绑定。');this.render(s);this.root.querySelector<HTMLButtonElement>('[data-inventory-item],button')?.focus();}
 close(){if(!this.open)return;this.cancelDrag();this.token=null;this.root.hidden=true;this.host.classList.remove('backpack-open');this.release();if(this.previousFocus?.isConnected)this.previousFocus.focus();this.previousFocus=null;}
 private slot(slot:number){const s=this.state(),w=s.world;if(!w)return;if(this.open){this.cancelDrag();if(!this.valid()){this.close();return;}if(!this.selected||this.selectedSource!=='team'){this.feedback('先选择一件团队背包物品');return;}if(this.send({type:'assignHotbar',...this.token!,itemId:this.selected,slot}))this.feedback(`${farmItem(this.selected)!.name}已绑定 ${(slot+1)%10}`);this.render(s);}
  else this.send({type:'activateHotbar',worldId:w.id,visit:w.visit.generation,slot});
 }
 private itemRequest(itemId:string,source:'team'|'reserve',token=this.token!,revision=this.state().world!.backpack!.alReserve.revision):AlItemRequest{return {...token,ownerId:'ranger',source,itemId,amount:1,expectedRevision:revision};}
 private bindTarget(target:HTMLElement,itemId:string,token:InventoryVisit,source:'team'|'reserve',revision=this.state().world!.backpack!.alReserve.revision){
  const free=target.hasAttribute('data-companion-free-item'),reserve=target.hasAttribute('data-al-reserve-index'),req=this.itemRequest(itemId,source,token,revision);
  if(source==='reserve'&&!free){this.feedback('后备道具仅可拖到自由槽设优先；收回团队请用按钮');return;}
  const c:Command=free?(source==='team'?{type:'assignCompanionFreeItem',...req}:{type:'setAlPriority',...req}):reserve?{type:'transferAlItem',...req}:{type:'assignHotbar',...token,itemId,slot:Number(target.dataset.hotbarIndex)};
  if(this.send(c))this.feedback(free||reserve?this.state().notice:`${farmItem(itemId)!.name}已绑定 ${target.dataset.slot} · 团队库存保留`);
 }
 private move(e:PointerEvent){
  this.ghost.style.left=`${Math.min(innerWidth-145,e.clientX+12)}px`;this.ghost.style.top=`${Math.min(innerHeight-48,e.clientY+12)}px`;
  const b=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-hotbar-index],[data-companion-free-item],[data-al-reserve-index]');
  for(const slot of this.host.querySelectorAll<HTMLElement>('[data-hotbar-index],[data-companion-free-item],[data-al-reserve-index]'))slot.classList.remove('drop-valid','drop-invalid');
  if(b&&this.drag){const req=this.itemRequest(this.drag.itemId,this.drag.sourceKind,this.drag.token,this.drag.revision),free=b.hasAttribute('data-companion-free-item'),reserve=b.hasAttribute('data-al-reserve-index');const q=free?(req.source==='team'?queryAssignCompanionFreeItem(this.state(),req):queryAlPriority(this.state(),req)):reserve&&req.source==='team'?queryTransferAlItem(this.state(),req):!reserve&&req.source==='team'?queryAssignHotbar(this.state(),{...req,slot:Number(b.dataset.hotbarIndex)}):{ok:false,reason:'后备道具仅可拖到自由槽设优先'};b.classList.add(q.ok?'drop-valid':'drop-invalid');this.root.querySelector('[data-backpack-feedback]')!.textContent=q.ok?`松开${free?(req.source==='team'?'交付1件并设优先':'设为优先'):reserve?'交付1件给阿尔':'绑定数字栏'}`:q.reason!;}
 }
 private cancelDrag(message?:string){const d=this.drag;this.drag=null;this.ghost.hidden=true;if(d){this.suppressClickUntil=performance.now()+150;if(d.source.hasPointerCapture(d.pointerId))d.source.releasePointerCapture(d.pointerId);}for(const b of this.host.querySelectorAll('[data-hotbar-index],[data-companion-free-item],[data-al-reserve-index]'))b.classList.remove('drop-valid','drop-invalid');if(message&&d)this.feedback(message);}
 render(s:GameState){if(!this.open)return;if(!this.valid()){this.close();return;}const bag=s.world!.backpack!,list=this.root.querySelector('[data-inventory-list]')!,ids=bag.stacks.filter(x=>inventoryQuantity(bag,x.itemId)>0).map(x=>x.itemId);
  const held=bag.alReserve.slots.filter(Boolean).map(x=>x!.itemId);const selectedIds=this.selectedSource==='team'?ids:held;
  if(this.drag&&!(this.drag.sourceKind==='team'?ids:held).includes(this.drag.itemId))this.cancelDrag('库存已失效，拖拽取消');if(this.selected&&!selectedIds.includes(this.selected))this.selected=null;
  for(const b of list.querySelectorAll<HTMLElement>('[data-inventory-item]'))if(!ids.includes(b.dataset.inventoryItem!))b.remove();
  for(const id of ids){let b=list.querySelector<HTMLButtonElement>(`[data-inventory-item="${id}"]`);if(!b){b=document.createElement('button');b.dataset.inventoryItem=id;b.innerHTML='<strong></strong><b></b><small></small>';list.append(b);}b.querySelector('strong')!.textContent=farmItem(id)!.name;b.querySelector('b')!.textContent=`×${inventoryQuantity(bag,id)}`;b.querySelector('small')!.textContent=`${farmItem(id)!.category} · 可绑定 · ${[...bag.hotbar.flatMap((v,i)=>v===id?[String((i+1)%10)]:[]),...(bag.companionFreeItem.itemId===id?['阿尔自由栏']:[])].join(' / ')||'未绑定'}`;b.setAttribute('aria-pressed',String(this.selected===id&&this.selectedSource==='team'));}
  const reserve=this.root.querySelector('[data-al-reserve-list]')!;
  for(let i=0;i<5;i++){let btn=reserve.querySelector<HTMLButtonElement>(`[data-al-reserve-index="${i}"]`);if(!btn){btn=document.createElement('button');btn.dataset.alReserveIndex=String(i);reserve.append(btn);}const row=bag.alReserve.slots[i];if(row)btn.dataset.alItem=row.itemId;else delete btn.dataset.alItem;btn.textContent=row?`${farmItem(row.itemId)!.name} ×${row.quantity}`:'空槽';btn.setAttribute('aria-pressed',String(!!row&&this.selectedSource==='reserve'&&this.selected===row.itemId));}
  const lampButton=this.root.querySelector<HTMLButtonElement>('[data-use-field-lamp]')!;lampButton.hidden=this.selectedSource!=='team'||this.selected!==FIELD_LAMP;const lampGate=querySampleLightUse(s,this.lightRequest());lampButton.disabled=!this.lightAllowed()||!lampGate.ok;lampButton.title=lampGate.ok?'消耗团队1盏，当前位置照明20模拟秒（SAMPLE）':lampGate.reason!;
  const request=this.selected?this.itemRequest(this.selected,this.selectedSource):null;
  for(const attr of ['data-bind-companion','data-give-al','data-priority-al','data-withdraw-al']){const action=this.root.querySelector<HTMLButtonElement>(`[${attr}]`)!;action.disabled=!request||(['data-bind-companion','data-give-al'].includes(attr)?request.source!=='team'||!queryTransferAlItem(s,request).ok:request.source!=='reserve'||!(attr==='data-priority-al'?queryAlPriority(s,request):queryTransferAlItem(s,request)).ok);}

  (this.root.querySelector('[data-inventory-empty]') as HTMLElement).hidden=ids.length>0;
 }
}
