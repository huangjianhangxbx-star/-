import type {GameState,Unit} from './core/types';
import {SKILLS as skills,skillButton as skillHTML,updateSkillButton} from './skill-ui';
import {COMBAT_CONFIG} from './core/combat-config';
import {CardMotion} from './card-motion';
export type UIState={initialSetup:boolean;selectedId:string|null;paused:boolean;speed:number;slow:boolean;stage:string;backpack:boolean;debug:boolean;cardId:string|null;item:string|null;notice:string;fps:number;assets:string};
const lifeNames:Record<string,string>={active:'在场',reserve:'待部署',withdrawn:'再部署',downed:'濒死',rescued:'已获救',dead:'死亡',respawning:'重生中',departed:'已离场'};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class HUD{
 readonly cardMotion=new CardMotion();
 root:HTMLElement; private phaseKey='';private cardKey='';private selectedKey='';
 constructor(host:HTMLElement){
  host.insertAdjacentHTML('beforeend',`<div id="hud">
   <header class="topbar"><div class="brand"><span class="brand-mark">♜</span><div><strong>影 庭</strong><small>灰钟街区 · 战斗原型</small></div></div><div class="mission"><small id="battle-status">准备行动</small><b id="wave">—</b></div><div class="crystal"><small>水晶完整度</small><b id="crystal-hp">12 / 12</b><div class="meter"><i id="crystal-bar"></i></div></div><div class="top-controls"><span id="clock">00:00</span><button data-action="sound" id="sound-btn">音效：开</button><button data-action="speed" id="speed-btn">1×</button><button data-action="pause" id="pause-btn">暂停</button><button data-action="help" title="操作说明" aria-label="操作说明">?</button></div></header>
   <aside class="location"><small>EXPEDITION / 01</small><h1 id="location-name">灰钟街区</h1><p id="mission-text">守住水晶，保留每一位同行者。</p><span class="location-rule"></span></aside>
   <div id="time-mode" class="time-mode"></div><div id="notice" class="notice" role="status"></div>
   <aside id="unit-detail" class="unit-detail" hidden></aside>
   <div id="world-skill"></div><div id="dash-directions" hidden></div>
   <footer class="bottom-dock"><section class="cards-section"><div class="section-label"><span>战术手牌 <small id="card-target"></small></span><span><b id="fragments">0</b> 碎片 <button data-action="draw" id="draw-btn" class="draw-button" title="消耗20碎片，重新抽取4张背包牌；临场和专属牌保留">主动抽卡 · 20碎片</button><button data-action="autoDraw" class="text-btn" id="auto-draw">自动：关</button></span></div><div id="cards" class="cards"></div></section><section class="roster-section"><div class="section-label"><span>同行者 <small>技能 1–4</small></span><button data-action="backpack" class="text-btn">行囊 <span id="inventory-count"></span></button></div><div id="roster" class="roster"></div></section></footer>
   <div class="bottom-line"><span id="hint">点击选择 · 拖动快捷移动 · 右键取消</span><button data-action="debug">验证面板</button></div>
   <aside id="backpack" class="backpack" hidden></aside><aside id="debug-panel" class="debug-panel" hidden></aside>
   <div id="phase-panel"></div>
   <div id="help" class="dialog-shade" hidden><section class="dialog help-dialog"><small>FIELD MANUAL</small><h2>战场操作</h2><p>点击角色，再点地格：直接移动，无需选择方向。<br>按住战场角色拖到地格，松手：快捷移动。<br>右键取消当前操作；空格暂停；1–4 使用角色技能。<br>选中角色或打开行囊时，战斗降至 0.1 倍速。</p><p>角色栏选择未部署角色，始动结束后点地格部署。<br>点击在场角色头像，消耗20碎片部署复制体。<br>疾行卡先选角色，再选择允许的方向。<br>卡牌不限距离；行囊道具只能作用于猎人周围。<br>濒死角色的救援按钮会让猎人自动前往。<br>失败保留损耗；重新进入节点时水晶满血。</p><button data-action="help" class="primary">返回战场</button></section></div>
   <div id="record-dialog" class="dialog-shade" hidden><section class="dialog"><h2>本场操作记录</h2><textarea readonly style="width:100%;height:260px;background:#101719;color:#d8d4c7"></textarea><button data-action="close-record" class="primary">返回战场</button></section></div><div id="error" class="error-banner" hidden></div>
  </div>`);
  this.root=host.querySelector('#hud')!;
 }
 private el(id:string){return this.root.querySelector<HTMLElement>('#'+id)!;}
 private text(id:string,text:string){const el=this.el(id);if(el.textContent!==text)el.textContent=text;}
 render(s:GameState,v:UIState){
  this.text('battle-status',s.phase==='battle'?'战斗进行中':s.phase==='briefing'?'行动准备':s.phase==='result'?'战斗结束':'远征地图');
  this.text('wave',`波次 ${s.wave}  /  击破 ${s.kills} · ${s.totalEnemies}`);
  this.text('crystal-hp',`${Math.ceil(s.crystalHp)} / ${s.crystalMax}`);this.el('crystal-bar').style.width=`${Math.max(0,s.crystalHp/s.crystalMax)*100}%`;
  this.text('clock',`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`);
  this.text('pause-btn',v.paused?'继续':'暂停');this.text('speed-btn',`${v.speed}×`);
  this.text('time-mode',v.paused?'战术暂停':v.slow?'战术观察 · 0.1×':'');
  this.text('notice',v.notice||s.notice||'');
  this.text('location-name',(s.mode==='dark'||s.node===3)?'熄灯回廊':s.mode==='hunter'?'影庭试炼':'灰钟街区');
  this.text('mission-text',(s.mode==='dark'||s.node===3)?'共享灯火照亮敌人，射程仍由各自武器决定。':s.mode==='hunter'?'猎人周围与据点可部署；受阻后自动续行。':'守住水晶，保留每一位同行者。');
  this.el('backpack').hidden=!v.backpack;this.el('debug-panel').hidden=!v.debug;
  this.root.classList.toggle('not-battle',s.phase!=='battle');
  const allies=s.units.filter(u=>u.team==='ally'&&!u.cloneOf);
  if(!this.el('roster').children.length){this.el('roster').innerHTML=allies.map((u,i)=>`<div class="unit-slot" style="--unit:${u.color}"><button data-unit="${u.id}" class="unit-card"><div class="portrait"><img src="/assets/portraits/${u.asset}.png" alt=""><small>${esc(u.role==='hunter'?'HUNTER':u.role==='fiorre'?'FIORRE':u.role==='guard'?'VANGUARD':'MARKSMAN')}</small></div><b>${esc(u.name)}</b><span id="life-${u.id}"></span><div class="meter hp"><i id="hp-${u.id}"></i></div><div class="meter ready"><i id="ready-${u.id}"></i></div></button></div>`).join('');}
  for(const u of allies){const card=this.root.querySelector<HTMLElement>(`[data-unit="${u.id}"]`)!;card.classList.toggle('selected',v.selectedId===u.id);card.classList.toggle('lost',u.life==='dead'||u.life==='departed');this.text(`life-${u.id}`,u.life==='downed'?`救援 ${Math.ceil(u.downTimer)}s`:u.life==='respawning'?`重生 ${Math.ceil(u.respawnTimer)}s`:['reserve','withdrawn'].includes(u.life)?(u.ready>0?'始动 '+u.ready.toFixed(1)+'s':'可部署'):u.life==='active'?'在场 · 复制 '+COMBAT_CONFIG.cloneCost+'碎片':lifeNames[u.life]);this.el(`hp-${u.id}`).style.width=`${Math.max(0,u.hp/u.maxHp)*100}%`;this.el(`ready-${u.id}`).style.width=`${(u.ready>0?1-Math.min(1,u.ready/(u.role==='hunter'?1:u.role==='fiorre'?8:u.role==='guard'?10:6)):1)*100}%`;}
  this.text('fragments',String(s.fragments));this.text('auto-draw',`自动：${s.autoDraw?'开':'关'}`);this.text('inventory-count',String(s.inventory.heal+s.inventory.weapon+s.inventory.light));
  const order={scene:0,deck:1,exclusive:2};const hand=[...s.cards].sort((a,b)=>order[a.group]-order[b.group]);
  const key=hand.map(c=>c.id+':'+c.group).join('|')+v.cardId;
  const draw=this.el('draw-btn') as HTMLButtonElement;draw.disabled=s.phase!=='battle'||s.fragments<20;draw.style.setProperty('--charge',Math.min(100,s.fragments/20*100)+'%');
  if(key!==this.cardKey){this.cardKey=key;let last='';this.cardMotion.render(this.el('cards'),hand.map(c=>{const sep=last&&last!==c.group?' separated':'';last=c.group;return `<button data-card="${c.id}" class="tactic-card ${c.group}${sep}${v.cardId===c.id?' chosen':''}" title="${esc(c.description)}"><small>${c.group==='scene'?'临场':c.group==='deck'?'背包':'专属'}</small><span class="card-symbol">${c.kind==='dash'?'➶':c.kind==='cooldown'?'◷':c.kind==='barricade'?'▥':c.kind==='heal'?'✚':'✧'}</span><b>${esc(c.name)}</b></button>`}).join(''));}
  this.text('card-target',v.cardId?'选择目标 · 右键取消':v.item?'道具指向 · 猎人周围':'');
  const u=s.units.find(u=>u.id===v.selectedId);this.detail(u,v,s);this.updateSkills(s,v.selectedId);
  if(v.backpack){const sig=JSON.stringify(s.inventory)+s.quickSlots.join()+v.item;if(this.el('backpack').dataset.sig!==sig){this.el('backpack').dataset.sig=sig;this.el('backpack').innerHTML=`<div class="section-label">行囊 <button data-action="backpack">关闭</button></div><p>拖入快捷栏，或点击「装入」</p><div class="bag-items">${(['heal','weapon','light'] as const).map(k=>`<div draggable="true" data-bag-item="${k}"><b>${k==='heal'?'恢复药剂':k==='weapon'?'备用武器':'提灯'}</b><span>× ${s.inventory[k]}</span><button data-equip="${k}">装入</button></div>`).join('')}</div><div id="quick-drop" class="quick-drop">快捷栏 · 拖到这里${s.quickSlots.map(k=>`<button data-item="${k}" ${s.inventory[k]<=0?'disabled':''}>${k==='heal'?'恢复药剂':k==='weapon'?'备用武器':'提灯'} ×${s.inventory[k]}</button>`).join('')}</div><small>关闭行囊后点目标使用；仅限猎人周围。</small>`;}}
  if(v.debug){this.el('debug-panel').innerHTML=`<h3>验证面板 <small>${Math.round(v.fps)} FPS</small></h3><p>${esc(v.assets)}</p><p>节点 ${s.node} · 重置机会 ${s.retries}</p><dl>${Object.entries(s.stats).map(([k,n])=>`<div><dt>${esc(k)}</dt><dd>${Number(n).toFixed(Number.isInteger(n)?0:1)}</dd></div>`).join('')}</dl><button data-action="export">查看操作记录</button><h4>最近事件</h4><p class="events">${s.log.slice(0,6).map(esc).join('<br>')}</p>`;}
  const pk=s.phase+'|'+s.result+'|'+s.mode+'|'+s.completed.join()+'|'+s.canStay+'|'+v.initialSetup;
  if(pk!==this.phaseKey){this.phaseKey=pk;const p=this.el('phase-panel');
   if(s.phase==='briefing')p.innerHTML=`<section class="briefing"><small class="eyebrow">TACTICAL FIELD STUDY / 01</small><h2>灰钟之后<br><em>仍有人同行。</em></h2><p>开局先部署，随后敌群逐波涌入。<br>抽取战术牌、布置复制体，在两路汇流处构筑防线。</p>${v.initialSetup?`<div class="mode-picker"><button data-mode="standard" class="${s.mode==='standard'?'active':''}">街区防御</button><button data-mode="hunter" class="${s.mode==='hunter'?'active':''}">猎人范围</button><button data-mode="dark" class="${s.mode==='dark'?'active':''}">黑暗试炼</button></div>`:`<p>重入节点 · 保留当前生命与装备损耗</p>`}<button data-action="start" aria-label="进入战斗" class="primary">进入战斗 <span>→</span></button><small class="brief-note">${s.width} × ${s.height} 地格 · 8 波递进 · 技能跨战斗重置</small></section>`;
   else if(s.phase==='result')p.innerHTML=`<div class="dialog-shade"><section class="dialog"><small>OPERATION ${s.result==='victory'?'COMPLETE':'FAILED'}</small><h2>${s.result==='victory'?'守住了这一夜':'水晶已破碎'}</h2><p>${s.result==='victory'?'战斗结束。未超时的濒死同伴已被带回。':'本次战斗失败，退出节点。角色损耗不会恢复。'}</p><div class="result-numbers"><span>击破 <b>${s.kills}</b></span><span>用时 <b>${Math.floor(s.time)}s</b></span><span>重置机会 <b>${s.retries}</b></span></div><button data-action="continue" class="primary">返回节点地图</button></section></div>`;
   else if(s.phase==='nodes')p.innerHTML=`<div class="dialog-shade"><section class="dialog node-dialog"><small>EXPEDITION / CURRENT STATE</small><h2>同行者的下一站</h2><p>生命、耐久与精神持续保留。重新开战时水晶满血。</p><div class="nodes"><button data-node="1"><span>Ⅰ</span><b>灰钟街区</b><small>${s.completed.includes(1)?'已完成 · 可再入':'水晶防御'}</small></button><button data-action="rest"><span>✧</span><b>街角休息处</b><small>恢复同伴状态</small></button><button data-node="3"><span>Ⅱ</span><b>熄灯回廊</b><small>${s.completed.includes(3)?'已完成 · 可再入':'共享光照试炼'}</small></button></div><p class="muted">剩余重置机会 ${s.retries} · 自动保留本次远征状态</p></section></div>`;
   else if(s.phase==='ended')p.innerHTML=`<div class="dialog-shade"><section class="dialog"><small>EXPEDITION ENDED</small><h2>远征结束</h2><p>已无法继续留在本次副本。角色损耗保留在记录中。</p><button data-action="new" class="primary">开始新一轮原型测试</button></section></div>`;
   else p.innerHTML='';
  }
 }
 private detail(u:Unit|undefined,v:UIState,s:GameState){const el=this.el('unit-detail');el.hidden=!u;if(!u)return;
 const key=u.id+u.life+u.weaponIndex+u.cloneOf;if(key!==this.selectedKey){this.selectedKey=key;el.innerHTML=`<small>${u.role==='hunter'?'必备角色 · HUNTER':'同行者'}${u.cloneOf?' · 影复制体':''}</small><h2>${esc(u.name)}</h2><div class="detail-hero"><img class="detail-portrait" src="/assets/portraits/${u.asset}.png" alt="${esc(u.name)}立绘"><div class="detail-skill"><div class="skill-description" data-skill-preview="${u.id}" tabindex="0"><span>${skills[u.role]?.icon||'✧'}</span><b>${skills[u.role]?.name||'技能'}</b><small>${skills[u.role]?.description||''}</small><em>悬停查看范围 · 血条旁释放</em></div></div></div><div id="unit-numbers"></div><p id="unit-weapon"></p><div class="detail-actions">${u.life==='downed'?`<button data-rescue="${u.id}" class="primary">猎人救援</button>`:u.life==='active'?`<button data-switch="${u.id}">切换武器</button>${u.cloneOf?`<button data-extract="${u.id}" data-via="gate">消散复制体</button>`:''}`:''}</div><small>${u.cloneOf?'复制体不可移动；消散即消失，不保留至下场。':u.role==='hunter'?'移动指向水晶后可撤离；猎人撤离后本场不能返回。':'点击或拖到目标格移动；指向水晶选择撤离。'}</small>`;}
 this.text('unit-numbers',`生命 ${Math.ceil(u.hp)} / ${u.maxHp}　精神压力 ${Math.round(u.stress)}　${lifeNames[u.life]}`);const w=u.weapons[u.weaponIndex];this.text('unit-weapon',w?`${w.name} · ${w.shadow?'无损耗':`耐久 ${Math.ceil(w.durability)}/${w.maxDurability}`} · 朝向 ${u.facing}`:'未装备武器');
 }
 private updateSkills(s:GameState,selectedId:string|null){const world=document.querySelector<HTMLElement>('#world-skill')!;const u=s.units.find(u=>u.id===selectedId&&u.team==='ally');if(u&&u.life==='active'&&s.phase==='battle'){if(world.dataset.unitId!==u.id){world.dataset.unitId=u.id;world.innerHTML=skillHTML(u,'world-skill-button');}const b=world.querySelector<HTMLButtonElement>('[data-skill]')!;b.dataset.worldSkill='';updateSkillButton(b,u,true);const p=(window as any).prototype.project(u.drawPos||u.pos);world.style.left=(p.x+22)+'px';world.style.top=(p.y-47)+'px';}else{world.replaceChildren();world.dataset.unitId='';}}
 error(message:string){this.el('error').hidden=false;this.text('error',message);}
}








