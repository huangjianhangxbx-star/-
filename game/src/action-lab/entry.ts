import type {PlayerKind} from './runtime/player-controller';
import {NativeRanged} from './presentation/ranged';
import {al03} from './profiles/al03';
import type {Encounter} from './runtime/world';
import {LabWorld,type Actor} from './runtime/world';
import {NativeUnit,loadNativeRuntime} from './presentation/spine';
import {LabAudio} from './presentation/audio';
import {rmbAudioCues} from './presentation/rmb-audio';
import './style.css';
import {NativeColumns} from './presentation/columns';
import type {LabBuild} from './profiles/al02';
const world=new LabWorld(),audio=new LabAudio();
// Read-only diagnostics for browser acceptance: no mutation, damage or advance hooks.
Object.defineProperty(window,'AL03Snapshot',{value:()=>JSON.parse(JSON.stringify({simTime:world.simTime,realTime:world.realTime,generation:world.generation,
 playerKind:world.playerKind,playerId:world.player.id,resources:world.controller.resourceRows(),encounter:world.encounter,build:world.build,paused:world.paused,blue:{x:world.blue.x,y:world.blue.y,hp:world.blue.hp},
 enemies:world.enemies.map(e=>({id:e.id,kind:e.enemyKind,x:e.x,y:e.y,hp:e.hp,cooldown:e.cooldown,action:e.action?{id:e.action.id,time:e.action.track.time,facing:e.action.facing}:null})),
 projectiles:world.projectiles.entities,hazards:world.hazards,events:world.log,frost:world.controller.resources?.frost,axeCooldown:world.axeCooldown})),writable:false});
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><a href="/">星骸回廊</a><span>动作参照样板 / AL—04</span><span id="readiness">读取原资源…</span></header>
<main><section class="intro"><div><p class="eyebrow">LOCAL REFERENCE LAB · AL04 · TWO CHARACTER CONTROLLERS</p><h1>两种动作语法<span>同一战场，不同应对。</span></h1></div><p class="description">原始骨架 · 原始贴图 · 原始音效<br>事件时点采用原数据；缺失的判定与表现参数标为 SAMPLE。</p></section>
<section class="workspace"><div class="stage"><div class="meters"><div><span id="player-label">小蓝</span><strong id="blue-hp">100 / 100</strong><meter id="blue-meter" max="100" value="100"></meter></div><div><span id="enemy-label">僵尸1</span><strong id="enemy-hp">110 / 110</strong><meter id="enemy-meter" max="110" value="110"></meter></div><div id="ranged-hp-row" hidden><span>骷髅弓</span><strong id="ranged-hp">110 / 110</strong><meter id="ranged-meter" max="110" value="110"></meter></div></div><div class="resource-strip"><div><span>霜寒 · 松盾后延迟 2s / 恢复 0.8/s</span><strong id="frost-resource"></strong></div><div><span>闪避次数</span><strong id="dash-resource"></strong></div><div><span>破阵猛冲</span><strong id="active-resource"></strong></div><div><span>MP</span><strong id="mp-resource"></strong></div></div><div id="field"><canvas id="arena"></canvas><canvas class="unit" id="blue-unit" width="512" height="512"></canvas><canvas class="unit" id="yellow-unit" width="512" height="512" hidden></canvas><canvas class="unit" id="zombie-unit" width="512" height="512"></canvas><canvas class="unit" id="ranged-unit" width="512" height="512" hidden></canvas><div id="outcome"></div></div><div class="controls"><label>角色（切换重置） <select id="player"><option value="isdara">小蓝</option><option value="cannoneer">魔弹射手 · 内部ID小黄</option></select></label><button id="reset">重置</button><button id="close">近身重置</button><button id="pause">暂停</button><button id="mute">音效：开</button><label><input id="debug" type="checkbox">判定范围</label><label>构筑（切换会近身重置） <select id="build"><option value="base">基础</option><option value="energy">旧能量回复</option><option value="ice">B1 · 凿冰</option><option value="axe">B2 · 大斧</option><option value="ice-axe">B3 · 凿冰＋大斧</option></select></label><label>敌人（切换重置） <select id="encounter"><option value="melee">近战僵尸</option><option value="ranged">骷髅弓</option><option value="mixed">僵尸＋骷髅弓</option></select></label><label>速度 <select id="speed"><option value="1">1×</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select></label></div><p id="player-readiness" class="help">小蓝原语法保留；魔弹射手为 AL04 来源＋已批准 SAMPLE</p><p id="al03-readiness" class="help">远程原素材按敌人选择加载；近战不依赖新增素材</p><p id="al02-readiness" class="help">新增素材按构筑选择加载；基础不依赖新增素材</p><p id="player-help" class="help">WASD 移动 · 鼠标指向 · 左键点击 / 按住普攻 · 右键按住架盾 · Space 闪避 · Q 按住瞄准 / 松开盾冲 · Esc 取消瞄准 / 暂停 · R 重置</p></div>
<aside><p class="eyebrow">LIVE AUTHORITY</p><h2>动作与结果</h2><p id="feedback" role="status">等待出手</p><dl><dt>输入</dt><dd id="input-state">就绪</dd><dt>位置</dt><dd id="position"></dd><dt>连击</dt><dd id="combo"></dd><dt>大斧 CD</dt><dd id="axe-resource"></dd><dt>敌人资格</dt><dd id="qualification"></dd><dt>远程样本</dt><dd id="ranged-profile">RANGED PROFILE: AL03 · SOURCE + SAMPLE</dd><dt>落点</dt><dd id="landings"></dd></dl><p class="note">虚线与短暂接触闪光仅作 SAMPLE 判定反馈。已复用原戳地动作、冰柱与大斧像素；未移植完整原粒子系统。</p><details><summary>数据来源与实验边界</summary><p>a1–a4 / attack 的事件轨由 Spine 4.1.23 提取。伤害使用技能基础值，不宣称原作最终结算。命中几何、移动规则、硬直及音效绑定为 SAMPLE；原作 OBS 对照待补。骷髅弓采用具名抛物线运输与落地爆炸；随机分布、半径0.8、方向格挡、死亡保留、AI和边界处理是获准 AL03 SAMPLE，不实现反弹。格挡方向／生效窗、霜寒初始化／恢复延迟、闪避次数CD与主动阶段映射为本轮获准 SAMPLE；没有完美格挡奖励。AL01 M3 已获用户试玩认可；AL02 新几何、冰柱到期策略与大斧运动为本轮批准 SAMPLE，已获得用户有限试玩认可；AL03 新组合已获用户有限试玩反馈。AL04 魔弹射手原个人显示名未知，使用实际Prefab与内部ID；翻滚无敌、右键扣弹／默认弹种、即时Q输入和二维判定为2026-10-07 Q1批准SAMPLE，不称原作还原。</p></details><button id="export">导出本轮事件 JSON</button><pre id="events" aria-live="off"></pre></aside></section></main>`;
const el=(id:string)=>document.getElementById(id)!;
const canvas=el('arena') as HTMLCanvasElement,field=el('field'),ctx=canvas.getContext('2d')!;
const nativeColumns=new NativeColumns(),nativeRanged=new NativeRanged();
const units=[new NativeUnit(el('blue-unit') as HTMLCanvasElement,'blue'),new NativeUnit(el('zombie-unit') as HTMLCanvasElement,'zombie'),new NativeUnit(el('ranged-unit') as HTMLCanvasElement,'ranged'),new NativeUnit(el('yellow-unit') as HTMLCanvasElement,'yellow')];
let ready=false,width=0,height=0,scale=1,last=performance.now(),logCursor=0;const keys=new Set<string>();let feedbackTime=-Infinity,feedbackKind="";let pointerWorld:{x:number;y:number}|null=null;
function resize(){const r=field.getBoundingClientRect();width=r.width;height=r.height;scale=Math.min(width/16,height/9);const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
const observer=new ResizeObserver(resize);observer.observe(field);
function point(a:{x:number;y:number}){return {x:width/2+a.x*scale,y:height/2-a.y*scale};}
function stopInputs(){keys.clear();world.release();world.shield(false);world.move={x:0,y:0};audio.stop();}
function reset(close=false){stopInputs();world.reset(close);logCursor=0;pointerWorld=null;feedbackTime=-Infinity;feedbackKind='';el('feedback').textContent='等待出手';el('pause').textContent='暂停';}
function pause(value=!world.paused){stopInputs();world.pause(value);logCursor=world.log.at(-1)?.sequence??logCursor;el('pause').textContent=value?'继续':'暂停';}

let playerRequest=0;let yellowLoad:Promise<boolean>|undefined;
(el('player') as HTMLSelectElement).onchange=async()=>{
 const select=el('player') as HTMLSelectElement,request=++playerRequest;let kind=select.value as PlayerKind;stopInputs();world.pause(true);
 if(kind==='cannoneer'){
  el('player-readiness').textContent='读取原魔弹射手骨架…';
  const loaded=await(yellowLoad??=Promise.all([units[3].load(),audio.prepareYellow()]).then(()=>true).catch(()=>false));if(request!==playerRequest)return;
  if(!loaded){select.options[1].disabled=true;kind='isdara';select.value=kind;el('player-readiness').textContent='原魔弹射手素材缺失：该角色不可用，小蓝仍可玩';}
  else el('player-readiness').textContent='原魔弹射手骨架就绪 · 个人显示名未知 · AL04 SOURCE + APPROVED SAMPLE';
 }else el('player-readiness').textContent='小蓝原语法 · AL01–03 已认可基线';
 world.setPlayer(kind);(el('build') as HTMLSelectElement).value='base';(el('build') as HTMLSelectElement).disabled=!world.controller.profile.builds;logCursor=0;pointerWorld=null;feedbackTime=-Infinity;el('pause').textContent='暂停';select.blur();
};

let encounterRequest=0;let rangedLoad:Promise<boolean>|undefined;
(el('encounter') as HTMLSelectElement).onchange=async()=>{
 const select=el('encounter') as HTMLSelectElement,request=++encounterRequest;let value=select.value as Encounter;stopInputs();world.pause(true);
 if(value!=='melee'){
  el('al03-readiness').textContent='读取原骷髅弓骨架与箭贴图…';
  const loaded=await(rangedLoad??=Promise.all([units[2].load(),nativeRanged.load()]).then(()=>true).catch(()=>false));
  if(request!==encounterRequest)return;
  if(!loaded){for(const o of select.options)if(o.value!=='melee')o.disabled=true;value='melee';select.value=value;el('al03-readiness').textContent='远程原素材缺失：远程与双敌不可用；近战仍可玩';}
  else el('al03-readiness').textContent='原骷髅弓 / 原箭附件 · 抛物线、落点预警、爆炸与音效绑定为 AL03 SAMPLE';
 }
 world.setEncounter(value);logCursor=0;pointerWorld=null;el('pause').textContent='暂停';select.blur();
};
let buildRequest=0;let effectLoad:ReturnType<NativeColumns['load']>|undefined;
(el('build') as HTMLSelectElement).onchange=async()=>{
 const select=el('build') as HTMLSelectElement,request=++buildRequest;let build=select.value as LabBuild;stopInputs();
 if(['ice','axe','ice-axe'].includes(build)){
  world.pause(true);el('al02-readiness').textContent='读取新增原素材…';
  const loaded=await(effectLoad??=nativeColumns.load());
  for(const option of select.options)option.disabled=(['ice','ice-axe'].includes(option.value)&&!loaded.column)||(['axe','ice-axe'].includes(option.value)&&!loaded.axe);
  if(request!==buildRequest)return;
  el('al02-readiness').textContent=loaded.column&&loaded.axe?'原戳地 / 原冰柱 / 原大斧贴图 · 显示运动与音效绑定为 AL02 SAMPLE':`新增原素材缺失：${!loaded.column?'冰柱 ':''}${!loaded.axe?'大斧':''} · 相关构筑不可用，基础仍可玩`;
  if(select.selectedOptions[0].disabled){build='base';select.value='base';}
 }
 world.setBuild(build,true);logCursor=0;pointerWorld=null;feedbackTime=-Infinity;el('pause').textContent='暂停';select.blur();
};
el('reset').onclick=()=>reset();el('close').onclick=()=>reset(true);el('pause').onclick=()=>pause();
el('mute').onclick=()=>{audio.muted=!audio.muted;if(audio.muted)audio.stop();el('mute').textContent=`音效：${audio.muted?'关':'开'}`;};
(el('speed') as HTMLSelectElement).onchange=e=>world.speed=Number((e.target as HTMLSelectElement).value);
el('export').onclick=()=>{const blob=new Blob([JSON.stringify({profile:'AL03 SOURCE + SAMPLE',encounter:world.encounter,rangedProfile:al03,build:world.build,axeCooldown:world.axeCooldown,growth:world.growthEnabled,player:world.controller.profile,resources:world.controller.resourceRows(),events:world.log},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AL03-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
function aim(e:PointerEvent){const r=canvas.getBoundingClientRect();pointerWorld={x:(e.clientX-r.left-width/2)/scale,y:-(e.clientY-r.top-height/2)/scale};world.aim={x:pointerWorld.x-world.blue.x,y:pointerWorld.y-world.blue.y};}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',aim);canvas.addEventListener('pointerdown',e=>{if(![0,2].includes(e.button)||!ready)return;aim(e);canvas.setPointerCapture(e.pointerId);void audio.unlock().catch(()=>{el('mute').textContent='音效：不可用';});if(e.button===0)world.press();else world.shield(true);});
canvas.addEventListener('pointerup',e=>{if(e.button===0)world.release();else if(e.button===2)world.shield(false);});canvas.addEventListener('pointercancel',stopInputs);canvas.addEventListener('lostpointercapture',()=>{world.release();world.shield(false);});
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT'].includes((e.target as HTMLElement).tagName))return;
 if(['Space','KeyW','KeyA','KeyS','KeyD','KeyQ','Escape'].includes(e.code))e.preventDefault();
 if(!e.repeat&&e.code==='Escape'){if(!world.cancelUpper())pause();return;}
 if(!e.repeat&&e.code==='KeyR'){reset();return;}
 if(!ready||world.paused)return;
 if(!e.repeat&&['Space','KeyQ'].includes(e.code)){void audio.unlock().catch(()=>{});if(e.code==='Space')world.dodge();else world.prepareActive();}
 keys.add(e.code);
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyQ')world.releaseActive();});
window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
function drawActor(a:Actor,index:number){const p=point(a);ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(p.x,p.y,scale*.42,scale*.19,0,0,Math.PI*2);ctx.fill();
 const c=units[index].canvas,size=scale*6;c.style.width=`${size}px`;c.style.height=`${size}px`;c.style.left=`${p.x-size/2}px`;const flight=a===world.player?world.projectiles.entities.find(p=>p.ownerId===a.id&&p.kind==='ballistic'):undefined;c.style.top=`${p.y-size*.7-(flight?.altitude??0)*scale*.6}px`;c.style.zIndex=String(Math.round(1000-a.y*10));
 units[index].draw(a,world.simTime,a===world.player?Math.hypot(world.move.x,world.move.y)>0:!a.action&&a.cooldown<=0&&a.reject==='range',world.generation,a===world.player?world.controller.presentationPose?.():undefined);
}
function draw(){ctx.clearRect(0,0,width,height);ctx.fillStyle='#182227';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
 for(let x=-8;x<=8;x++){const p=point({x,y:0});ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,height);ctx.stroke();}for(let y=-4;y<=4;y++){const p=point({x:0,y});ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(width,p.y);ctx.stroke();}
 const block=point({x:-1.1,y:2.65});ctx.fillStyle='#465257';ctx.fillRect(block.x,block.y,2.2*scale,.65*scale);
 if((el('debug') as HTMLInputElement).checked)for(const a of [world.blue,...world.enemies]){const p=point(a);ctx.strokeStyle=a===world.player?'#64d8e6':'#d7ad80';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(p.x,p.y,.25*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(a.facing)*scale,p.y-Math.sin(a.facing)*scale);ctx.stroke();}
 const bluePoint=point(world.blue);
 if(world.defense.guardHeld){ctx.strokeStyle='#83cbe5';ctx.lineWidth=4;ctx.beginPath();ctx.arc(bluePoint.x,bluePoint.y,scale*.65,-world.defense.guardFacing-Math.PI/3,-world.defense.guardFacing+Math.PI/3);ctx.stroke();ctx.lineWidth=1;}
 if(world.defense.invulnerable(world.simTime)){ctx.strokeStyle='#a4edda';ctx.beginPath();ctx.ellipse(bluePoint.x,bluePoint.y,scale*.5,scale*.28,0,0,Math.PI*2);ctx.stroke();}
 if(world.blue.action?.kind==='active-prepare'){ctx.strokeStyle='#cbe5ed';ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(bluePoint.x,bluePoint.y);ctx.lineTo(bluePoint.x+Math.cos(world.blue.action.facing)*6*scale,bluePoint.y-Math.sin(world.blue.action.facing)*6*scale);ctx.stroke();ctx.setLineDash([]);}
 if(world.simTime-feedbackTime<.2){ctx.strokeStyle=feedbackKind==='block'?'#c8f6ff':feedbackKind==='frost-return'?'#a2e8bb':'#e49f82';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bluePoint.x,bluePoint.y,scale*(.55+(world.simTime-feedbackTime)*2),0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}
 for(const h of world.hazards){const a=h.origin??(h.owner===world.player.id?world.blue:world.enemies.find(e=>e.id===h.owner)!),p=point(a);ctx.fillStyle=h.owner===world.player.id?'#78ccdc22':'#dc896b33';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,h.range*scale,-h.facing-h.halfAngle,-h.facing+h.halfAngle);ctx.closePath();ctx.fill();}
 for(const projectile of world.projectiles.entities.filter(p=>p.ownerId===world.player.id)){
  const pos=point(projectile.position);
  if(!projectile.landing){
   const length=Math.hypot(projectile.velocity.x,projectile.velocity.y),tail=Math.min(.7,(world.simTime-projectile.spawnedAt)*length);
   ctx.strokeStyle='#fff3cd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pos.x,pos.y);ctx.lineTo(pos.x-projectile.velocity.x/length*tail*scale,pos.y+projectile.velocity.y/length*tail*scale);ctx.stroke();ctx.lineWidth=1;
  }else{ctx.fillStyle='#efdca5';ctx.beginPath();ctx.arc(pos.x,pos.y,scale*.13,0,Math.PI*2);ctx.fill();}
  if(projectile.landing){const landing=point(projectile.landing);ctx.strokeStyle='#eed494';ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(landing.x,landing.y,scale*2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 }
 for(const event of world.log.filter(e=>e.eventKind==='yellow-fire'&&world.simTime-e.simTime<.06)){
  const muzzle=point({x:event.position.x+Math.cos(event.facing)*.4,y:event.position.y+Math.sin(event.facing)*.4});
  ctx.save();ctx.translate(muzzle.x,muzzle.y);ctx.rotate(-event.facing);ctx.fillStyle='#fff3cd';ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(14,0);ctx.lineTo(0,4);ctx.closePath();ctx.fill();ctx.restore();
 }
 nativeColumns.draw(ctx,world.columns,world.effects,width,height,scale,world.simTime);
 nativeRanged.draw(ctx,world.projectiles.entities.filter(p=>p.ownerId!==world.player.id),world.hazards,point,scale,world.simTime);
 units[1].canvas.hidden=!world.enemies.some(e=>e.enemyKind==='zombie-melee');units[2].canvas.hidden=!world.enemies.some(e=>e.enemyKind==='ranged-reference');
 units[0].canvas.hidden=world.controller.profile.family!=='blue';units[3].canvas.hidden=world.controller.profile.family!=='yellow';
 drawActor(world.player,world.controller.profile.family==='yellow'?3:0);for(const enemy of world.enemies)drawActor(enemy,enemy.enemyKind==='ranged-reference'?2:1);
 el('enemy-label').textContent=world.enemy.enemyKind==='ranged-reference'?'骷髅弓':'僵尸1';
 el('ranged-hp-row').hidden=world.encounter!=='mixed';const ranged=world.enemies.find(e=>e.enemyKind==='ranged-reference');
 if(ranged){el('ranged-hp').textContent=`${ranged.hp} / ${ranged.maxHp}`;(el('ranged-meter') as HTMLMeterElement).value=ranged.hp;}
 el('landings').textContent=world.projectiles.entities.map((p,i)=>`#${i+1} ${p.landing?.x.toFixed(1)},${p.landing?.y.toFixed(1)} · ETA ${Math.max(0,p.expiresAt-world.simTime).toFixed(2)}s`).join(' | ')||'等待发射';
 el('player-label').textContent=world.controller.profile.label;
 for(const [a,id] of [[world.blue,'blue'],[world.enemy,'enemy']] as const){el(`${id}-hp`).textContent=`${a.hp} / ${a.maxHp}`;(el(`${id}-meter`) as HTMLMeterElement).max=a.maxHp;(el(`${id}-meter`) as HTMLMeterElement).value=a.hp;}
 if(world.controller.resources){
 el('frost-resource').textContent=`${world.resources.frost.toFixed(2)} / 3`;el('dash-resource').textContent=`${world.resources.dashCharges} / 2${world.resources.dashCharges<2?' · '+world.resources.dashCooldown.toFixed(1)+'s':''}`;el('active-resource').textContent=`${world.resources.activeCharge} / 1${world.resources.activeCharge<1?' · '+world.resources.activeCooldown.toFixed(1)+'s':''}`;el('mp-resource').textContent=`${world.resources.mp} / 100 · 费用 0`;
 }
 const rows=world.controller.resourceRows(),resourceIds=['frost-resource','dash-resource','active-resource','mp-resource'];for(let i=0;i<resourceIds.length;i++){const strong=el(resourceIds[i]),container=strong.parentElement!;container.hidden=!rows[i];if(rows[i]){container.querySelector('span')!.textContent=rows[i].name;if(!world.controller.resources)strong.textContent=rows[i].value;}}
 el('player-help').textContent=world.controller.profile.builds?'WASD 移动 · 鼠标指向 · 左键普攻 · 右键架盾 · Space 闪避 · Q 按住瞄准 / 松开盾冲 · Esc 取消 / 暂停 · R 重置':'WASD 移动 · 左键三段炮筒近战 · 右键射击 / 自动装弹 · Space 翻滚 · Q 指向落点火箭弹射 · Esc 取消火箭跳 / 暂停 · R 重置';
 el('axe-resource').textContent=world.build==='axe'||world.build==='ice-axe'?`${world.axeCooldown.toFixed(2)}s · 独立装备`:'未装备';
 el('input-state').textContent=world.paused?'暂停':world.input.held?'按住普攻':'就绪';el('position').textContent=`${world.blue.x.toFixed(2)}, ${world.blue.y.toFixed(2)}`;el('combo').textContent=world.blue.action?`${world.blue.action.kind==='basic'?(world.blue.action.executedSkillId==='小蓝a4.8戳地'?'a3 → 戳地':'a'+(world.blue.action.stage+1)):({'dash-strike':'冲刺攻击','shield':'架盾','active-prepare':'准备／瞄准','shield-charge':'盾冲','roll':'翻滚','cannon-shot':'射击','rocket-jump':'火箭弹射'} as Record<string,string>)[world.blue.action.kind]} · ${world.blue.action.track.time.toFixed(3)}s`:`下一段 a${world.nextStage+1}`;el('qualification').textContent=world.enemies.map(e=>`${e.id}: ${e.action?`attack ${e.action.track.time.toFixed(3)}s`:e.reject||`CD ${e.cooldown.toFixed(2)}s`}`).join(' / ');
 el('outcome').textContent=world.blue.hp<=0?world.controller.profile.label+'倒下 · R 重置':world.enemies.every(e=>e.hp<=0)?(world.encounter==='melee'?'僵尸倒下 · R 重置':'敌人倒下 · R 重置'):'';
 el('events').textContent=world.log.slice(-12).reverse().map(e=>`${e.simTime.toFixed(3)} ${e.actorId} ${e.eventKind} ${e.result}${e.resourceDelta?' '+(e.resourceName??'HP')+' '+e.resourceDelta:''}`).join('\n');
}
function frame(now:number){const delta=Math.min(30,(now-last)/1000);last=now;if(ready){if(pointerWorld)world.aim={x:pointerWorld.x-world.blue.x,y:pointerWorld.y-world.blue.y};world.move={x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyW'))-Number(keys.has('KeyS'))};world.advance(delta);for(const e of world.log.filter(e=>e.sequence>logCursor)){const rmbCues=rmbAudioCues(e);if(rmbCues!==null)rmbCues.forEach(c=>audio.play(c));else{if(e.eventKind==='hazard-created'||e.eventKind==='derived-hazard-created'||e.eventKind==='projectile-created')audio.play('release');if(e.eventKind==='explosion-created')audio.play('hit');if(e.eventKind==='damage')audio.play('hit');if(e.eventKind==='hurt'||e.eventKind==='death')audio.play('hurt');}
 const messages:Record<string,string>={'resource-payment':'射击 · 弹药 −1','reload-complete':'装弹完成 · 炮筒就绪','projectile-created':'骷髅弓发射 · 离开金色落点','explosion-created':'落地爆炸 · 真实空间接触','ice-payment':'凿冰释放 · 霜寒 −1','column-created':'原冰柱 · 延迟生成','column-shattered':'碎冰 · 独立冲击波','axe-created':'大斧触发 · CD 已提交','dodge':'闪避 · 冲刺攻击','block':'格挡成功 · 霜寒 −1','block-failed':'格挡失败 · '+e.result,'active-payment':'攻击节点 · 主动充能 −1','frost-return':'首次有效命中 · 霜寒回复 +'+e.resourceDelta,'evade':'无敌窗口 · 避开伤害'};
 if(e.actorId===world.player.id&&e.eventKind==='projectile-created')messages['projectile-created']='原事件释放 · SAMPLE 投射反馈';if(e.actorId===world.player.id&&e.eventKind==='explosion-created')messages['explosion-created']='火箭落地 · 独立爆炸';if(world.controller.profile.family==='yellow')messages['dodge']='翻滚 · 短无敌窗口';if(messages[e.eventKind]){el('feedback').textContent=messages[e.eventKind];feedbackTime=world.simTime;feedbackKind=e.eventKind;if(rmbCues===null)audio.play(e.eventKind==='block'?'block':e.eventKind==='block-failed'?'hurt':e.eventKind==='frost-return'?'return':e.eventKind==='dodge'?'dodge':'release');}}logCursor=world.log.at(-1)?.sequence??logCursor;draw();}requestAnimationFrame(frame);}
void(async()=>{try{await loadNativeRuntime();await Promise.all([...units.slice(0,2).map(u=>u.load()),audio.prepare()]);ready=true;el('readiness').textContent='原资源就绪';}catch(e){el('readiness').textContent='资源未就绪';el('outcome').textContent=String(e);console.error(e);}})();requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{audio.dispose();nativeColumns.dispose();nativeRanged.dispose();observer.disconnect();units.forEach(u=>u.dispose());});
