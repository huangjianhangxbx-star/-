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
const partyCluster=(u:Unit)=>{
 const hero=u.id==='hunter';
 return `<article id="${hero?'hero':'companion'}-cluster" data-ui-cluster="${hero?'hero':'companion'}" data-body="${esc(u.id)}" data-role="${hero?'protagonist':'companion'}"><div class="duo-readout"><div class="duo-hp geometry-bar" aria-label="生命"><i class="duo-gray"></i><i class="duo-health"></i></div><div class="duo-secondary"><div class="duo-stamina" aria-disabled="true" title="体力尚未接入">体力 —</div><div class="duo-posture geometry-bar" aria-label="架势"><i></i></div></div><header><b>${esc(u.name)}</b><small class="duo-control"></small></header><small class="duo-values"></small></div>${hero?'':`<div class="duo-face"><img ${u.id==='ranger'?'data-portrait-source="user"':''} alt="${esc(u.name)}头像" src="${portraitFor(u)}"></div>`}<div class="duo-kit"><div class="duo-weapons">${reservedSlot('右手','data-hand="right"')}${reservedSlot('左手','data-hand="left"')}</div><div class="duo-passives">${[1,2,3].map(level=>reservedSlot('level'+level,`data-passive-level="${level}"`)).join('')}</div>${reservedSlot(hero?'Y':'自由道具',`data-reserve-kind="${hero?'bottle':'free-item'}"`)}</div><small class="duo-condition"></small></article>`;
};
const tactics={free:'自由',rally:'集合',focus:'集火',cautious:'保守'};
function actionRows(s:GameState,u:Unit){
 const h=u.hunterCombat,a=u.alCombat,recovery=Math.max(0,(h?.finalRecoveryUntil??a?.finalRecoveryUntil??0)-s.time);
 const blocked=u.life!=='active'?'无法行动':u.stagger>0||u.forcedMotion||u.ready>0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||s.time<(h?.hurtUntil??a?.hurtUntil??0)?'受控中':u.basicAction?'普攻中':h?.special||a?.special?'动作中':'';
 const ready=(cooldown=0,reason='')=>[blocked||reason,cooldown>0?cooldown.toFixed(1)+'s':''].filter(Boolean).join(' · ')||'就绪';
 if(isHunterV2(s,u))return [['LMB','四段普攻',ready(recovery)],['RMB','方向格挡',ready(0,h?.special?.kind==='guard'?'格挡中':(h?.frost??3)<1?'霜寒不足':'')],['Shift','闪避',ready(h?.dodgeCharges===0?h.dodgeCooldown:0)+` · ${h?.dodgeCharges??2}/2`],['E','盾冲',ready(h?.activeCooldown??0,h?.activeCharge===0&&!(h.activeCooldown>0)?'次数耗尽':'')]];
 if(isAlV2(s,u))return [['LMB','三段普攻',ready(recovery)],['RMB','四发射击',ready(a?.reload??0,(a?.ammo??4)===0?'装弹中':'')+` · ${a?.ammo??4}/4`],['Shift','翻滚',ready(a?.rollCd??0)],['E','火箭弹射',ready(a?.rocketCd??0)]];
 const skills=u.skillSlots??[...equippedSkills(u)];return [['LMB','普攻',ready()],['Shift','机动',ready(u.evasion?.charges===0?u.evasion.progress:0)],...skills.flatMap((id,i)=>id?[[['E','R','T'][i],SKILL_CATALOG[id].name,ready(u.skillStates?.[id]?.cd??0)]]:[])];
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
   <section id="skill-cluster" data-ui-cluster="skills" aria-label="当前主控技能"><section id="action-strip" aria-label="当前主控动作"></section></section><section id="vitality-cluster" data-ui-cluster="vitality" aria-label="升级与随身生命力">${reservedSlot('V','data-reserve-kind="upgrade"')}<span class="carried-vitality"></span></section>
   <section id="quick-reserved" data-ui-cluster="hotbar" aria-label="未来道具栏">${reservedSlot('Tab','data-reserve-kind="backpack"')}<div>${Array.from({length:10},(_,i)=>reservedSlot(String((i+1)%10),`data-slot="${(i+1)%10}"`)).join('')}</div></section><div id="exploration-objective"></div>
   <div id="phase-panel"></div>
   <div id="help" class="dialog-shade" hidden><section class="dialog help-dialog"><h2>双人探索</h2><p>WASD 移动 · Z 切换主控 · F 选路（左键确认，右键取消）<br>按住 G 选择自由 / 集合 / 集火 / 保守，松开下达。<br>LMB 普攻 · RMB 当前副动作 · Shift 机动 · E 当前主动。<br>其他伙伴仍使用 E/R/T 过渡技能，按动作条显示为准。<br>Space 暂停 · 左 Alt 切换1×/2× · Esc 取消操作。<br>Q / R 新三槽、C 武器形态、V 升级将在后续模块实施。</p><p>普通探索同页保留当前世界；到合法出口后点“离开当前区域”，再“继续当前探索”。离区等待时间冻结，不治疗、不修复、不补弹。新的测试世界须二次确认；刷新不存档。普通探索已接入僵尸与骷髅弓原生战斗；具名入口仅用于开发验证。</p><button data-action="help" class="primary">返回战场</button></section></div>
   <div id="exploration-exit-confirm" class="dialog-shade" hidden><section class="dialog"><h2>确认离开</h2><p>濒死伙伴无法同行；取消可继续探索。死亡规则沿用当前合同。</p><div id="exploration-abandon-list"></div><button data-action="confirm-exploration-exit">确认放弃并离开</button><button data-action="cancel-exploration-exit">取消</button></section></div>
   <div id="record-dialog" class="dialog-shade" hidden><section class="dialog"><h2>探索记录</h2><textarea readonly></textarea><button data-action="close-record">返回</button></section></div><div id="error" class="error-banner" hidden></div>
  </div>`);this.root=host.querySelector('#hud')!;
  void Promise.all(geometryFiles.map(async p=>{const im=new Image();im.src=geometryRoot+p;await im.decode();})).catch(()=>this.error('UI资源加载失败，请刷新重试（geometry）'));
  this.root.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).closest('[data-ui-reserved]'))e.preventDefault();});
  this.root.addEventListener('contextmenu',e=>{if((e.target as HTMLElement).closest('[data-ui-reserved]'))e.preventDefault();});
 }
 private el(id:string){return this.root.querySelector<HTMLElement>('#'+id)!;}
 render(s:GameState,v:UIState){
  const actor=controlledBody(s),battle=s.phase==='battle',party=s.exploration?s.units.filter(u=>isPartyBody(s,u)):[];
  this.el('duo-status').hidden=!battle&&s.phase!=='world';this.el('action-strip').hidden=!battle;this.el('journey-status').hidden=!battle;
  party.sort((a,b)=>Number(b.id==='hunter')-Number(a.id==='hunter'));
  for(const id of ['quick-reserved','skill-cluster','vitality-cluster'])this.el(id).hidden=!battle;
  const key=party.map(u=>u.id).join('|'),status=this.el('duo-status');
  if(status.dataset.party!==key){status.dataset.party=key;status.innerHTML=party.map(partyCluster).join('');const im=status.querySelector<HTMLImageElement>('.duo-face img');if(im)im.addEventListener('error',()=>this.error('伙伴头像加载失败，请刷新重试'));}
  for(const u of party){const card=status.querySelector<HTMLElement>(`[data-body="${u.id}"]`)!;card.classList.toggle('controlled',u.id===actor?.id);card.querySelector('.duo-control')!.textContent=u.id===actor?.id?'◆ 主控':'◇ 同行';(card.querySelector('.duo-gray') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.min(1,(u.hp+u.grayHp)/u.maxHp)*95.7)}% 0 0)`;(card.querySelector('.duo-health') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.max(0,Math.min(1,u.hp/u.maxHp))*95.7)}% 0 0)`;(card.querySelector('.duo-posture i') as HTMLElement).style.clipPath=`inset(0 ${100-(2.15+Math.max(0,Math.min(1,u.posture/u.maxPosture))*95.7)}% 0 0)`;card.querySelector('.duo-values')!.textContent=`生命 ${Math.ceil(u.hp)}/${u.maxHp} · 虚血 ${Math.ceil(u.grayHp)} · 架势 ${Math.ceil(u.posture)}/${u.maxPosture}`;const t=s.partyTactics?.[u.id];card.querySelector('.duo-condition')!.textContent=[u.life==='active'?'':u.life,u.stagger>0?'失衡':null,...u.statuses.filter(x=>x.remaining>0).map(x=>x.name||x.kind),u.id===actor?.id?'':`${tactics[t?.kind??'free']}${t?' · '+({'pending-body':'等待动作','active':'执行中','blocked':'受阻'}[t.execution]):''}${t?.reason?' · '+t.reason:''}`].filter(Boolean).join(' · ');}
  this.el('clock').textContent=`模拟 ${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;this.el('speed-btn').textContent=v.speed+'×';this.el('pause-btn').textContent=v.paused?'继续':'暂停';this.el('time-mode').textContent=v.paused?'已暂停':v.slow?'战术观察 · 0.1×':'';this.el('notice').textContent=v.notice||s.notice||'';
  this.el('world-status').textContent=s.world?`${s.world.id} · ${s.exploration?.definition.name??'当前地点'} · 访问 ${s.world.visit.generation} · ${s.world.visit.active?'区域内':'区域外 · 时间冻结'} · 天气/日历待接入`:'';
  this.el('journey-status').textContent=s.context==='explorationBattle'?'交战中':battle?'探索中':'';
  if(actor){const rows=actionRows(s,actor),active=rows.find(([key])=>key==='E');this.el('action-strip').dataset.actor=actor.id;const markup=`<b>${esc(actor.name)} <small>当前主控</small></b><div class="skill-diamond reserved-slot" data-ui-reserved data-skill-key="Q" data-skill-reserved="Q" aria-disabled="true" title="Q · 尚未接入"><kbd>Q</kbd><small>—</small></div><div class="skill-diamond native-active" data-skill-key="E" aria-label="E ${esc(active?.[1]??'未接入')}"><kbd>E</kbd><span>${esc(active?.[1]??'—')}</span><small>${esc(active?.[2]??'未接入')}</small></div><div class="skill-diamond reserved-slot" data-ui-reserved data-skill-key="R" data-skill-reserved="R" aria-disabled="true" title="R · 尚未接入"><kbd>R</kbd><small>—</small></div><div class="action-hints">${rows.filter(([key])=>key!=='E').map(([key,name,value])=>`<span title="${esc(name)} · ${esc(value)}"><kbd>${key}</kbd> ${esc(name)} <small>${esc(value)}</small></span>`).join('')}</div>`;if(this.actionMarkup!==markup){this.el('action-strip').innerHTML=markup;this.actionMarkup=markup;}}
  else{this.actionMarkup='';this.el('action-strip').dataset.actor='';this.el('action-strip').textContent='当前无可控角色';}
  this.el('vitality-cluster').querySelector('.carried-vitality')!.textContent=`生命力 ${s.economy.carried.vitality} · 随身`;
  const obj=this.el('exploration-objective');obj.hidden=!battle;
  if(battle&&s.exploration){const r=s.exploration,check=queryExplorationExit(s,s.units.filter(u=>isPartyBody(s,u)&&u.life==='downed').map(u=>u.id)),known=r.definition.points.filter(p=>positionVisible(s,p.pos)),sig=known.map(p=>p.id+r.memory.mechanisms.includes(p.id)).join('|')+check.ok+check.reason+!!s.world;
   if(obj.dataset.key!==sig){const expanded=obj.querySelector('details')?.open??false;obj.dataset.key=sig;obj.innerHTML=`<details><summary>探索目标 · 抵达出口</summary><p>当前地图：${esc(r.definition.name)}</p>`+known.map(p=>`<button data-exploration-point="${p.id}" ${r.memory.mechanisms.includes(p.id)?'disabled':''}>${p.kind==='campfire'?'篝火休息':p.kind==='resource'?'搜寻生命力':'激活静钟'}</button>`).join('')+`<button data-action="exit-exploration" ${check.ok?'':'disabled'}>${s.world?'离开当前区域':'离开暗牢'}</button><small>${esc(check.reason||'已可离开')}</small></details>${s.world?'<button data-action="restart-world">开始新的测试世界</button>':'<button data-action="abandon">结束本次探索</button>'}`;obj.querySelector('details')!.open=expanded;}
  }
  const phaseKey=s.phase+':'+(s.world?.id??'');if(this.phase!==phaseKey){this.phase=phaseKey;this.el('phase-panel').innerHTML=s.phase==='world'?'<section class="exploration-ended"><h2>当前世界仍在继续</h2><p>区域已离开。角色伤势、耐久、地点进度、原生冷却及随身资源保留；等待不会恢复或结算。刷新将丢失此会话。</p><button class="primary" data-action="continue-world">继续当前探索</button><button data-action="restart-world">开始新的测试世界</button><button data-action="export">查看开发记录</button></section>':s.phase==='ended'?'<section class="exploration-ended"><h2>本次探索已结束</h2><p>这是会话内原型，当前结算与损耗沿用过渡规则。</p><button class="primary" data-action="new">重新开始</button><button data-action="export">查看开发记录</button></section>':'';}
 }
 error(message:string){this.el('error').hidden=false;this.el('error').textContent=message;}
}
