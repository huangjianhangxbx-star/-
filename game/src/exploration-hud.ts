import {alQuantity,queryAlItemCandidates} from './core/al-items';
import {farmItem,inventoryQuantity,queryBackpack,queryActivateHotbar} from './core/world-inventory';
import {queryHealingBottle} from './core/healing-bottle';
import {ACTIVATION_SAMPLE,PASSIVES,DEFAULT_PASSIVES} from './core/passive-definition';
import {usesRightSkills,rightSkillSpec,rightSkillCooldown,queryRightSkill,type RightSkillKey} from './core/right-hand-skills';
import type {GameState,Unit,Pos} from './core/types';
import type {UIState} from './hud-state';
import {controlledBody} from './core/direct-control';
import {isPartyBody} from './core/exploration-party';
import {isHunterV2} from './core/hunter-state';
import {isAlV2} from './core/al-state';
import {equippedSkills} from './core/skill-slots';
import {SKILL_CATALOG} from './core/skill-catalog';
import {queryExplorationExit} from './core/exploration';
import {positionVisible} from './core/visibility';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const geometryRoot='/assets/ui/geometry/';
const geometryFiles=['portrait/frame.png','bar/base.png','bar/frame.png','bar/fill_full.png','square/preview.png','diamond/preview.png'];
const reservedSlot=(label:string,attrs='')=>`<span class="geometry-slot reserved-slot" data-ui-reserved aria-disabled="true" aria-label="${label} · 尚未接入" title="${label} · 尚未接入" ${attrs}><span>${label}</span></span>`;
const portraitFor=(u:Unit)=>u.id==='ranger'?'/assets/ui/portraits/al-user.png':`/assets/portraits/${esc(u.asset)}.png`;
const handSlot=(hand:string)=>`<button class="geometry-slot equipped-slot" data-hand="${hand}" aria-label="${hand==='right'?'右手':'左手'}装备"><span>${hand==='right'?'右手':'左手'}</span></button>`;
const partyCluster=(u:Unit)=>{
 const hero=u.id==='hunter';
 return `<article id="${hero?'hero':'companion'}-cluster" data-ui-cluster="${hero?'hero':'companion'}" data-body="${esc(u.id)}" data-role="${hero?'protagonist':'companion'}"><div class="duo-readout"><div class="duo-hp geometry-bar" aria-label="生命"><i class="duo-gray"></i><i class="duo-health"></i></div><div class="duo-secondary"><div class="duo-stamina" role="progressbar" aria-label="体力"><i></i><span></span></div><div class="duo-posture geometry-bar" aria-label="架势"><i></i></div></div><header><b>${esc(u.name)}</b><small class="duo-control"></small></header><small class="duo-values"></small></div>${hero?'':`<div class="duo-face"><img ${u.id==='ranger'?'data-portrait-source="user"':''} alt="${esc(u.name)}头像" src="${portraitFor(u)}"></div>`}<div class="duo-kit"><div class="duo-weapons">${handSlot('right')}${handSlot('left')}</div><div class="duo-passives">${[1,2,3].map(level=>`<span class="geometry-slot passive-slot" data-passive-level="${level}"><span></span></span>`).join('')}</div>${hero?`<span class="geometry-slot reserved-slot healing-bottle" data-reserve-kind="bottle" role="status"><span>Y<small data-bottle-count>1/1</small></span></span>`:u.id==='ranger'?`<button class="geometry-slot reserved-slot companion-free-item" data-reserve-kind="free-item" data-companion-free-item="ranger"><span><small>自由道具</small><strong data-free-item-name>未绑定</strong><small data-free-item-count></small><small data-free-item-status>仅绑定</small></span></button>`:reservedSlot('自由道具','data-reserve-kind="free-item"')}</div><small class="duo-condition"></small></article>`;
};
const tactics={free:'自由',rally:'集合',focus:'集火',cautious:'保守'};
function actionRows(s:GameState,u:Unit){
 const h=u.hunterCombat,a=u.alCombat,recovery=Math.max(0,(h?.finalRecoveryUntil??a?.finalRecoveryUntil??0)-s.time);
 const blocked=u.life!=='active'?'无法行动':u.stagger>0||u.forcedMotion||u.ready>0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||s.time<(h?.hurtUntil??a?.hurtUntil??0)?'受控中':u.basicAction?'普攻中':h?.special||a?.special?'动作中':'';
 const left=u.equipment?.equipped.left,bomb=left?.action==='bomb',offhandReason=left?.durability===0?'副手损坏':'';
 const ready=(cooldown=0,reason='')=>[blocked||reason,cooldown>0?cooldown.toFixed(1)+'s':''].filter(Boolean).join(' · ')||'就绪';
 if(isHunterV2(s,u))return [['LMB',u.equipment?.equipped.right.currentForm==='II'?'II · 两段重击':'I · 四段普攻',ready(recovery)],['RMB',bomb?'投弹':'方向格挡',ready(left?.cd??0,offhandReason||(bomb?'单按 · 20体力':h?.special?.kind==='guard'?'格挡中':(h?.frost??3)<1?'霜寒不足':''))],['Shift','闪避',ready(h?.dodgeCharges===0?h.dodgeCooldown:0)+` · ${h?.dodgeCharges??2}/2`],['E','盾冲',ready(h?.activeCooldown??0,h?.activeCharge===0&&!(h.activeCooldown>0)?'次数耗尽':'')]];
 if(isAlV2(s,u))return [['LMB',u.equipment?.equipped.right.currentForm==='II'?'II · 两段重击':'I · 三段普攻',ready(recovery)],['RMB',bomb?'投弹':'四发射击',bomb?ready(left?.cd??0,offhandReason||'单按 · 20体力'):ready(a?.reload??0,offhandReason||((a?.ammo??4)===0?'装弹中':''))+` · ${a?.ammo??4}/4`],['Shift','翻滚',ready(a?.rollCd??0)],['E','火箭弹射',ready(a?.rocketCd??0)]];
 const skills=u.skillSlots??[...equippedSkills(u)];return [['LMB','普攻',ready()],['Shift','机动',ready(u.evasion?.charges===0?u.evasion.progress:0)],...skills.flatMap((id,i)=>id?[[['E','R','T'][i],SKILL_CATALOG[id].name,ready(u.skillStates?.[id]?.cd??0)]]:[])];
}
function rightSlots(s:GameState,u:Unit){return (['Q','E','R'] as RightSkillKey[]).map(key=>{const a=rightSkillSpec(u,key),cd=rightSkillCooldown(u,key),check=queryRightSkill(s,u,key,{x:u.pos.x+Math.cos(u.heading??0),y:u.pos.y+Math.sin(u.heading??0)}),status=!a?'空槽':cd>0?cd.toFixed(1)+'s':check.ok?'就绪':check.reason!;return `<button class="skill-diamond right-active ${!check.ok?'unavailable':''}" data-skill-key="${key}" data-right-skill="${key}" aria-disabled="${!check.ok}" aria-label="${key} ${esc(a?.name??'空槽')}" title="${esc(status)}${a?' · '+a.stamina+' 体力':''}"><kbd>${key}</kbd><span>${esc(a?.name??'—')}</span><small>${esc(status)}${a?' · '+a.stamina+'体力':''}</small></button>`;}).join('')+'<button class="edit-right-skills" data-edit-skills title="仅脱战且动作结束时可配置">编辑技能</button>';}
/** Keep physical button identity/focus through live cooldown updates. */
function updateActionMarkup(root:HTMLElement,markup:string){
 const template=document.createElement('template');template.innerHTML=markup;
 const next=[...template.content.children],current=[...root.children];
 if(next.length!==current.length||next.some((n,i)=>n.tagName!==current[i].tagName)){root.innerHTML=markup;return;}
 next.forEach((n,i)=>{const old=current[i];if(old.outerHTML===n.outerHTML)return;for(const a of [...old.attributes])if(!n.hasAttribute(a.name))old.removeAttribute(a.name);for(const a of [...n.attributes])if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);if(old.innerHTML!==n.innerHTML)old.innerHTML=n.innerHTML;});
}
/** Official component tree has no card, clone, selected-detail or shadow controls. */
export class ExplorationHUD{
 readonly root:HTMLElement;
 private phase='';
 private actionMarkup='';
 constructor(host:HTMLElement){
  host.insertAdjacentHTML('beforeend',`<div id="hud" class="exploration-hud geometry-hud">
   <section id="duo-status" aria-label="双人状态"></section>
   <section id="world-cluster" data-ui-cluster="world" aria-label="世界信息"><div class="world-clock"><span id="clock"></span><small title="天气没有消费者">天气 —</small></div><div id="world-status" role="status"></div><small class="world-event" aria-disabled="true" title="危险事件与日历尚未接入">日历 / 事件 —</small></section>
   <nav class="exploration-controls" aria-label="设置与帮助"><button data-action="sound">音效：开</button><button data-action="speed" id="speed-btn">1×</button><button data-action="pause" id="pause-btn">暂停</button><button data-action="help" aria-label="操作说明">帮助</button></nav>
   <div id="journey-status"></div><div id="time-mode" role="status"></div><div id="notice" role="status"></div>
   <section id="skill-cluster" data-ui-cluster="skills" aria-label="当前主控技能"><section id="action-strip" aria-label="当前主控动作"></section></section><section id="vitality-cluster" data-ui-cluster="vitality" aria-label="升级与随身生命力"><button class="geometry-slot equipped-slot" data-reserve-kind="upgrade" aria-label="V 双人武器激活"><span>V · L0/3</span></button><span class="carried-vitality"></span></section>
   <section id="quick-reserved" data-ui-cluster="hotbar" aria-label="农用物品快捷栏"><button class="geometry-slot reserved-slot backpack-toggle" data-reserve-kind="backpack" aria-label="Tab 背包"><span>Tab<small>背包</small></span></button><div>${Array.from({length:10},(_,i)=>`<button class="geometry-slot reserved-slot inventory-hotbar" data-slot="${(i+1)%10}" data-hotbar-index="${i}"><span>${(i+1)%10}</span><small data-hotbar-name>—</small><small data-hotbar-count></small></button>`).join('')}</div></section><div id="exploration-objective"></div>
   <div id="phase-panel"></div>
   <div id="help" class="dialog-shade" hidden><section class="dialog help-dialog"><h2>双人探索</h2><p>WASD 移动 · Z 切换主控 · F 选路（左键确认，右键取消）<br>按住 G 选择自由 / 集合 / 集火 / 保守，松开下达。<br>LMB 普攻 · C 切换右手 I/II（须动作结束） · RMB 当前副动作 · Shift 机动 · Q/E/R 右手技能。<br>其他伙伴仍使用 E/R/T 过渡技能，按动作条显示为准。<br>Space 暂停 · 左 Alt 切换1×/2× · Esc 取消操作。<br>Q/R 为实验样板，脱战点击槽或“编辑技能”可互换/清空，E 保留原生动作；V 打开双人武器激活：共同 Level 0–3，每级仅扣一份随身生命力（4/8/12 SAMPLE）；被动从左至右逐级生效。</p><p>普通探索同页保留当前世界；到合法出口后点“离开当前区域”，再“继续当前探索”。离区等待时间冻结，不治疗、不修复、不补弹。新的测试世界须二次确认；刷新不存档。普通探索默认敌方高压 SAMPLE（有效接触约1/3最大生命，原始架势60%）；三箭各自结算，叠加危险。网址加 ?enemyPressure=baseline 可对照。普通探索已接入僵尸与骷髅弓原生战斗；具名入口仅用于开发验证。</p><button data-action="help" class="primary">返回战场</button></section></div>
   <div id="exploration-exit-confirm" class="dialog-shade" hidden><section class="dialog"><h2>确认离开</h2><p>濒死伙伴无法同行；取消可继续探索。死亡规则沿用当前合同。</p><div id="exploration-abandon-list"></div><button data-action="confirm-exploration-exit">确认放弃并离开</button><button data-action="cancel-exploration-exit">取消</button></section></div>
   <div id="record-dialog" class="dialog-shade" hidden><section class="dialog"><h2>探索记录</h2><textarea readonly></textarea><button data-action="close-record">返回</button></section></div><div id="error" class="error-banner" hidden></div>
  </div>`);this.root=host.querySelector('#hud')!;
  void Promise.all(geometryFiles.map(async p=>{const im=new Image();im.src=geometryRoot+p;await im.decode();})).catch(()=>this.error('UI资源加载失败，请刷新重试（geometry）'));
  this.root.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).closest('[data-ui-reserved]'))e.preventDefault();});
  this.root.addEventListener('contextmenu',e=>{if((e.target as HTMLElement).closest('[data-ui-reserved]'))e.preventDefault();});
 }
 private renderInventory(s:GameState){
  const bag=s.world?.backpack,q=queryBackpack(s),tab=this.root.querySelector<HTMLElement>('[data-reserve-kind=backpack]')!;
  tab.setAttribute('aria-disabled',String(!q.ok));tab.title=q.ok?'Tab 打开背包 · 打开时暂停':q.reason!;tab.setAttribute('aria-expanded',String(this.root.parentElement?.classList.contains('backpack-open')??false));
  const free=this.root.querySelector<HTMLElement>('[data-companion-free-item]');
  if(free){const id=bag?.companionFreeItem.itemId,item=farmItem(id),quantity=alQuantity(bag,id);
   free.querySelector('[data-free-item-name]')!.textContent=item?.name??(id?'无效物品':'未绑定');free.querySelector('[data-free-item-count]')!.textContent=id?'×'+quantity:'';
   free.querySelector('[data-free-item-status]')!.textContent=id?(quantity>0?(item?.kind==='usable'?queryAlItemCandidates(s).reason:'优先考虑 · 农用不可自动使用'):'未持有 / 耗尽'):'拖入交付并设优先';free.dataset.available=String(!!item&&quantity>0);free.setAttribute('aria-disabled',String(!q.ok));
   free.setAttribute('aria-label',`阿尔自由道具 · ${item?.name??'未绑定'}${id?' ×'+quantity:''} · 优先意图，不强制使用`);free.title='Tab交付/设置优先 · 右键清空意图，持有数量保留';
  }
  for(const b of this.root.querySelectorAll<HTMLElement>('[data-hotbar-index]')){const slot=Number(b.dataset.hotbarIndex),id=bag?.hotbar[slot],quantity=inventoryQuantity(bag,id),item=quantity>0?farmItem(id):undefined;
   b.querySelector('[data-hotbar-name]')!.textContent=item?.name??'—';b.querySelector('[data-hotbar-count]')!.textContent=item?'×'+quantity:'';b.classList.toggle('hotbar-selected',!!item&&bag?.selectedSlot===slot);b.dataset.itemId=item?id!:'';
   const check=s.world?queryActivateHotbar(s,{worldId:s.world.id,visit:s.world.visit.generation,slot}):q;b.setAttribute('aria-disabled',String(!check.ok));b.setAttribute('aria-pressed',String(!!item&&bag?.selectedSlot===slot));b.setAttribute('aria-label',`${(slot+1)%10} · ${item?item.name+' ×'+quantity:'空槽'}`);b.title=item?'选择 '+item.name+' · 选择后靠近试验田左键（收成仅展示） · 右键解绑':check.reason??'空槽';
  }
 }
 private el(id:string){return this.root.querySelector<HTMLElement>('#'+id)!;}
 render(s:GameState,v:UIState){
  const actor=controlledBody(s),battle=s.phase==='battle',party=s.exploration?s.units.filter(u=>isPartyBody(s,u)):[];
  this.el('duo-status').hidden=!battle&&s.phase!=='world';this.el('action-strip').hidden=!battle;this.el('journey-status').hidden=!battle;
  party.sort((a,b)=>Number(b.id==='hunter')-Number(a.id==='hunter'));
  for(const id of ['quick-reserved','skill-cluster','vitality-cluster'])this.el(id).hidden=!battle;
  this.renderInventory(s);
  const key=party.map(u=>u.id).join('|'),status=this.el('duo-status');
  if(status.dataset.party!==key){status.dataset.party=key;status.innerHTML=party.map(partyCluster).join('');const im=status.querySelector<HTMLImageElement>('.duo-face img');if(im)im.addEventListener('error',()=>this.error('伙伴头像加载失败，请刷新重试'));}
  for(const u of party){const card=status.querySelector<HTMLElement>(`[data-body="${u.id}"]`)!;for(const [i,k] of DEFAULT_PASSIVES.entries()){const slot=card.querySelector<HTMLElement>(`[data-passive-level="${i+1}"]`)!,active=(s.world?.activation.activeLevel??0)>i;slot.dataset.active=String(active);slot.querySelector('span')!.textContent=`L${i+1} ${PASSIVES[k].name}`;slot.title=`Level ${i+1} · ${PASSIVES[k].name} · ${active?'已激活':'未激活'} · ${PASSIVES[k].effect} · SAMPLE`;slot.setAttribute('aria-label',slot.title);}for(const hand of ['right','left'] as const){const slot=card.querySelector<HTMLButtonElement>(`[data-hand="${hand}"]`)!;const item=u.equipment?.equipped[hand],w=hand==='right'?u.equipment?.equipped.right.weapon:undefined;slot.disabled=!item;slot.title=item?`${hand==='right'?'右手':'左手'} · ${w?.name??u.equipment!.equipped.left.name} · 耐久 ${w?.durability??u.equipment!.equipped.left.durability}/${w?.maxDurability??u.equipment!.equipped.left.maxDurability} · 点击更换`: '本模式未接入装备';slot.querySelector('span')!.textContent=hand==='right'?u.equipment?.equipped.right.currentForm??'I':u.equipment?.equipped.left.action==='guard'?'盾':u.equipment?.equipped.left.action==='shot'?'枪':'弹';slot.setAttribute('aria-label',slot.title);slot.dataset.instanceId=item?.id??'';}const stamina=card.querySelector<HTMLElement>('.duo-stamina')!,st=u.stamina;stamina.querySelector<HTMLElement>('i')!.style.width=`${st?Math.max(0,Math.min(100,st.current/st.max*100)):0}%`;stamina.querySelector('span')!.textContent=st?`体力 ${Math.ceil(st.current)}/${st.max}${st.current<22?' · 低':''}`:'体力 —';stamina.classList.toggle('low',!!st&&st.current<22);stamina.setAttribute('aria-valuenow',String(st?.current??0));stamina.setAttribute('aria-valuemax',String(st?.max??100));stamina.title=st?'SAMPLE · 攻击/格挡/机动/主动消耗体力':'本模式未接入体力';card.classList.toggle('controlled',u.id===actor?.id);card.querySelector('.duo-control')!.textContent=u.id===actor?.id?'◆ 主控':'◇ 同行';(card.querySelector('.duo-gray') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.min(1,(u.hp+u.grayHp)/u.maxHp)*95.7)}% 0 0)`;(card.querySelector('.duo-health') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.max(0,Math.min(1,u.hp/u.maxHp))*95.7)}% 0 0)`;(card.querySelector('.duo-posture i') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.max(0,Math.min(1,u.posture/u.maxPosture))*95.7)}% 0 0)`;card.querySelector('.duo-values')!.textContent=`生命 ${Math.ceil(u.hp)}/${u.maxHp} · 虚血 ${Math.ceil(u.grayHp)} · 架势 ${Math.ceil(u.posture)}/${u.maxPosture}`;const t=s.partyTactics?.[u.id];card.querySelector('.duo-condition')!.textContent=[u.life==='active'?'':u.life==='respawning'?(s.partyLifecycle?.wipeAt!==undefined?'全灭 · 等待安全返场':u.respawnTimer>0?`复活等待 ${Math.ceil(u.respawnTimer)}s`:'等待安全位置'):u.life,u.stagger>0?'失衡':null,...u.statuses.filter(x=>x.remaining>0).map(x=>x.name||x.kind),u.id===actor?.id?'':`${tactics[t?.kind??'free']}${t?' · '+({'pending-body':'等待动作','active':'执行中','blocked':'受阻'}[t.execution]):''}${t?.reason?' · '+t.reason:''}`].filter(Boolean).join(' · ');}
  this.el('clock').textContent=`模拟 ${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;this.el('speed-btn').textContent=v.speed+'×';this.el('pause-btn').textContent=v.paused?'继续':'暂停';this.el('time-mode').textContent=v.paused?'已暂停':v.slow?'战术观察 · 0.1×':'';this.el('notice').textContent=v.notice||s.notice||'';
  this.el('world-status').textContent=s.world?`${s.world.id} · ${s.exploration?.definition.name??'当前地点'} · 访问 ${s.world.visit.generation} · ${s.world.visit.active?'区域内':'区域外 · 时间冻结'} · 天气/日历待接入${s.enemyPressure==='high-pressure-v1'?' · 敌方高压试验':''}`:'';
  this.el('journey-status').textContent=s.context==='explorationBattle'?'交战中':battle?'探索中':'';
  if(actor){const rows=actionRows(s,actor);if(actor.equipment)rows.push(['C',`右手 ${actor.equipment.equipped.right.currentForm}`, '动作结束后切换']);const active=rows.find(([key])=>key==='E');this.el('action-strip').dataset.actor=actor.id;const markup=`<b>${esc(actor.name)} <small>当前主控</small></b>${usesRightSkills(s,actor)?rightSlots(s,actor):`<div class="skill-diamond reserved-slot" data-ui-reserved data-skill-key="Q" data-skill-reserved="Q" aria-disabled="true" title="Q · 尚未接入"><kbd>Q</kbd><small>—</small></div><div class="skill-diamond native-active ${active?.[2]?.includes('需要装备')?'equipment-disabled':''}" aria-disabled="${active?.[2]?.includes('需要装备')?'true':'false'}" data-skill-key="E" aria-label="E ${esc(active?.[1]??'未接入')}"><kbd>E</kbd><span>${esc(active?.[1]??'—')}</span><small>${esc(active?.[2]??'未接入')}</small></div><div class="skill-diamond reserved-slot" data-ui-reserved data-skill-key="R" data-skill-reserved="R" aria-disabled="true" title="R · 尚未接入"><kbd>R</kbd><small>—</small></div>`}<div class="action-hints">${rows.filter(([key])=>key!=='E').map(([key,name,value])=>`<span title="${esc(name)} · ${esc(value)}"><kbd>${key}</kbd> ${esc(name)} <small>${esc(value)}</small></span>`).join('')}</div>`;if(this.actionMarkup!==markup){updateActionMarkup(this.el('action-strip'),markup);this.actionMarkup=markup;}}
  else{this.actionMarkup='';this.el('action-strip').dataset.actor='';this.el('action-strip').textContent='当前无可控角色';}
  const bottle=this.root.querySelector<HTMLElement>('[data-reserve-kind=bottle]');
  if(bottle){const q=queryHealingBottle(s);bottle.querySelector('[data-bottle-count]')!.textContent=`${q.count}/1`;bottle.dataset.available=String(q.ok);bottle.setAttribute('aria-disabled',String(!q.ok));bottle.setAttribute('aria-label',`Y 共享回血瓶 ${q.count}/1 · ${q.ok?'存活本体各瞬回100 HP（SAMPLE）':q.reason}`);bottle.title=bottle.getAttribute('aria-label')!;}
  this.el('vitality-cluster').querySelector('[data-reserve-kind=upgrade] span')!.textContent=`V · L${s.world?.activation.activeLevel??0}${(s.world?.activation.activeLevel??0)<3?' · '+ACTIVATION_SAMPLE.costs[(s.world?.activation.activeLevel??0) as 0|1|2]:' 满'}`;
  this.el('vitality-cluster').querySelector('.carried-vitality')!.textContent=`生命力 ${s.economy.carried.vitality} · 随身`;
  const obj=this.el('exploration-objective');obj.hidden=!battle;
  if(battle&&s.exploration){const r=s.exploration,check=queryExplorationExit(s,s.units.filter(u=>isPartyBody(s,u)&&u.life==='downed').map(u=>u.id)),known=r.definition.points.filter(p=>positionVisible(s,p.pos)),sig=known.map(p=>p.id+r.memory.mechanisms.includes(p.id)).join('|')+check.ok+check.reason+!!s.world;
   if(obj.dataset.key!==sig){const expanded=obj.querySelector('details')?.open??false;obj.dataset.key=sig;obj.innerHTML=`<details><summary>探索目标 · 抵达出口</summary><p>当前地图：${esc(r.definition.name)}</p>`+known.map(p=>`<button data-exploration-point="${p.id}" ${r.memory.mechanisms.includes(p.id)?'disabled':''}>${p.kind==='campfire'?'篝火休息':p.kind==='resource'?'搜寻生命力':'激活静钟'}</button>`).join('')+`<button data-action="exit-exploration" ${check.ok?'':'disabled'}>${s.world?'离开当前区域':'离开暗牢'}</button><small>${esc(check.reason||'已可离开')}</small></details>${s.world?'<button data-action="restart-world">开始新的测试世界</button>':'<button data-action="abandon">结束本次探索</button>'}`;obj.querySelector('details')!.open=expanded;}
  }
  const phaseKey=s.phase+':'+(s.world?.id??'');if(this.phase!==phaseKey){this.phase=phaseKey;this.el('phase-panel').innerHTML=s.phase==='world'?'<section class="exploration-ended"><h2>当前世界仍在继续</h2><p>区域已离开。角色伤势、耐久、地点进度、原生冷却及随身资源保留；等待不会恢复或结算。刷新将丢失此会话。</p><button class="primary" data-action="continue-world">继续当前探索</button><button data-action="restart-world">开始新的测试世界</button><button data-action="export">查看开发记录</button></section>':s.phase==='ended'?'<section class="exploration-ended"><h2>本次探索已结束</h2><p>这是会话内原型，当前结算与损耗沿用过渡规则。</p><button class="primary" data-action="new">重新开始</button><button data-action="export">查看开发记录</button></section>':'';}
 }
 error(message:string){this.el('error').hidden=false;this.el('error').textContent=message;}
}
