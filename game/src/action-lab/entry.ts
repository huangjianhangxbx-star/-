import {LabWorld,type Actor} from './runtime/world';
import {NativeUnit,loadNativeRuntime} from './presentation/spine';
import {LabAudio} from './presentation/audio';
import './style.css';
const world=new LabWorld(),audio=new LabAudio();
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><a href="/">星骸回廊</a><span>动作参照样板 / AL—01</span><span id="readiness">读取原资源…</span></header>
<main><section class="intro"><div><p class="eyebrow">LOCAL REFERENCE LAB · M0 + M1</p><h1>小蓝与僵尸<span>一次出手，一次真实命中。</span></h1></div><p class="description">原始骨架 · 原始贴图 · 原始音效<br>事件时点采用原数据；缺失的判定与表现参数标为 SAMPLE。</p></section>
<section class="workspace"><div class="stage"><div class="meters"><div><span>小蓝</span><strong id="blue-hp">100 / 100</strong><meter id="blue-meter" max="100" value="100"></meter></div><div><span>僵尸1</span><strong id="enemy-hp">110 / 110</strong><meter id="enemy-meter" max="110" value="110"></meter></div></div><div id="field"><canvas id="arena"></canvas><canvas class="unit" id="blue-unit" width="512" height="512"></canvas><canvas class="unit" id="zombie-unit" width="512" height="512"></canvas><div id="outcome"></div></div><div class="controls"><button id="reset">重置</button><button id="close">近身重置</button><button id="pause">暂停</button><button id="mute">音效：开</button><label><input id="debug" type="checkbox">判定范围</label><label>速度 <select id="speed"><option value="1">1×</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select></label></div><p class="help">WASD 移动 · 鼠标指向 · 左键点击 / 按住普攻 · 空格暂停 · R 重置</p></div>
<aside><p class="eyebrow">LIVE AUTHORITY</p><h2>动作与结果</h2><dl><dt>输入</dt><dd id="input-state">就绪</dd><dt>位置</dt><dd id="position"></dd><dt>连击</dt><dd id="combo"></dd><dt>僵尸资格</dt><dd id="qualification"></dd></dl><p class="note">虚线与短暂接触闪光仅作 SAMPLE 判定反馈。原粒子刀光尚未移植，未以自制角色替代原资源。</p><details><summary>数据来源与实验边界</summary><p>a1–a4 / attack 的事件轨由 Spine 4.1.23 提取。伤害使用技能基础值，不宣称原作最终结算。命中几何、移动规则、硬直及音效绑定为 SAMPLE；原作 OBS 对照待补。僵尸为单根近战裁剪，架盾／闪避／主动／成长尚未实现。</p></details><button id="export">导出本轮事件 JSON</button><pre id="events" aria-live="off"></pre></aside></section></main>`;
const el=(id:string)=>document.getElementById(id)!;
const canvas=el('arena') as HTMLCanvasElement,field=el('field'),ctx=canvas.getContext('2d')!;
const units=[new NativeUnit(el('blue-unit') as HTMLCanvasElement,'blue'),new NativeUnit(el('zombie-unit') as HTMLCanvasElement,'zombie')];
let ready=false,width=0,height=0,scale=1,last=performance.now(),logCursor=0;const keys=new Set<string>();let pointerWorld:{x:number;y:number}|null=null;
function resize(){const r=field.getBoundingClientRect();width=r.width;height=r.height;scale=Math.min(width/16,height/9);const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
const observer=new ResizeObserver(resize);observer.observe(field);
function point(a:{x:number;y:number}){return {x:width/2+a.x*scale,y:height/2-a.y*scale};}
function stopInputs(){keys.clear();world.release();world.move={x:0,y:0};audio.stop();}
function reset(close=false){stopInputs();world.reset(close);logCursor=0;pointerWorld=null;el('pause').textContent='暂停';}
function pause(value=!world.paused){stopInputs();world.pause(value);el('pause').textContent=value?'继续':'暂停';}
el('reset').onclick=()=>reset();el('close').onclick=()=>reset(true);el('pause').onclick=()=>pause();
el('mute').onclick=()=>{audio.muted=!audio.muted;if(audio.muted)audio.stop();el('mute').textContent=`音效：${audio.muted?'关':'开'}`;};
(el('speed') as HTMLSelectElement).onchange=e=>world.speed=Number((e.target as HTMLSelectElement).value);
el('export').onclick=()=>{const blob=new Blob([JSON.stringify({profile:'AL01 SAMPLE',events:world.log},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AL01-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
function aim(e:PointerEvent){const r=canvas.getBoundingClientRect();pointerWorld={x:(e.clientX-r.left-width/2)/scale,y:-(e.clientY-r.top-height/2)/scale};world.aim={x:pointerWorld.x-world.blue.x,y:pointerWorld.y-world.blue.y};}
canvas.addEventListener('pointermove',aim);canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!ready)return;aim(e);canvas.setPointerCapture(e.pointerId);void audio.unlock().catch(()=>{el('mute').textContent='音效：不可用';});world.press();});
canvas.addEventListener('pointerup',()=>world.release());canvas.addEventListener('pointercancel',stopInputs);canvas.addEventListener('lostpointercapture',()=>world.release());
window.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes((e.target as HTMLElement).tagName))return;if(['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(!e.repeat&&e.code==='Space')pause();if(!e.repeat&&e.code==='KeyR')reset();if(!world.paused)keys.add(e.code);});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
function drawActor(a:Actor,index:number){const p=point(a);ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(p.x,p.y,scale*.42,scale*.19,0,0,Math.PI*2);ctx.fill();
 const c=units[index].canvas,size=scale*6;c.style.width=`${size}px`;c.style.height=`${size}px`;c.style.left=`${p.x-size/2}px`;c.style.top=`${p.y-size*.7}px`;c.style.zIndex=String(Math.round(1000-a.y*10));
 units[index].draw(a,world.simTime,a.id==='blue'?Math.hypot(world.move.x,world.move.y)>0:!a.action&&a.cooldown<=0&&a.reject==='range',world.generation);
}
function draw(){ctx.clearRect(0,0,width,height);ctx.fillStyle='#182227';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
 for(let x=-8;x<=8;x++){const p=point({x,y:0});ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,height);ctx.stroke();}for(let y=-4;y<=4;y++){const p=point({x:0,y});ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(width,p.y);ctx.stroke();}
 const block=point({x:-1.1,y:2.65});ctx.fillStyle='#465257';ctx.fillRect(block.x,block.y,2.2*scale,.65*scale);
 if((el('debug') as HTMLInputElement).checked)for(const a of [world.blue,world.enemy]){const p=point(a);ctx.strokeStyle=a.id==='blue'?'#64d8e6':'#d7ad80';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(p.x,p.y,.25*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(a.facing)*scale,p.y-Math.sin(a.facing)*scale);ctx.stroke();}
 for(const h of world.hazards){const a=h.owner==='blue'?world.blue:world.enemy,p=point(a);ctx.fillStyle=h.owner==='blue'?'#78ccdc22':'#dc896b33';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,h.range*scale,-h.facing-h.halfAngle,-h.facing+h.halfAngle);ctx.closePath();ctx.fill();}
 drawActor(world.blue,0);drawActor(world.enemy,1);
 for(const [a,id] of [[world.blue,'blue'],[world.enemy,'enemy']] as const){el(`${id}-hp`).textContent=`${a.hp} / ${a.maxHp}`;(el(`${id}-meter`) as HTMLMeterElement).value=a.hp;}
 el('input-state').textContent=world.paused?'暂停':world.input.held?'按住普攻':'就绪';el('position').textContent=`${world.blue.x.toFixed(2)}, ${world.blue.y.toFixed(2)}`;el('combo').textContent=world.blue.action?`a${world.blue.action.stage+1} · ${world.blue.action.track.time.toFixed(3)}s`:`下一段 a${world.nextStage+1}`;el('qualification').textContent=world.enemy.action?`attack · ${world.enemy.action.track.time.toFixed(3)}s`:world.enemy.reject||`CD ${world.enemy.cooldown.toFixed(2)}s`;
 el('outcome').textContent=world.blue.hp<=0?'小蓝倒下 · R 重置':world.enemy.hp<=0?'僵尸倒下 · R 重置':'';
 el('events').textContent=world.log.slice(-12).reverse().map(e=>`${e.simTime.toFixed(3)} ${e.actorId} ${e.eventKind} ${e.result}${e.resourceDelta?' HP '+e.resourceDelta:''}`).join('\n');
}
function frame(now:number){const delta=Math.min(30,(now-last)/1000);last=now;if(ready){if(pointerWorld)world.aim={x:pointerWorld.x-world.blue.x,y:pointerWorld.y-world.blue.y};world.move={x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyW'))-Number(keys.has('KeyS'))};world.advance(delta);for(const e of world.log.filter(e=>e.sequence>logCursor)){if(e.eventKind==='hazard-created')audio.play('release');if(e.eventKind==='damage')audio.play('hit');if(e.eventKind==='hurt'||e.eventKind==='death')audio.play('hurt');}logCursor=world.log.at(-1)?.sequence??logCursor;draw();}requestAnimationFrame(frame);}
void(async()=>{try{await loadNativeRuntime();await Promise.all([...units.map(u=>u.load()),audio.prepare()]);ready=true;el('readiness').textContent='原资源就绪';}catch(e){el('readiness').textContent='资源未就绪';el('outcome').textContent=String(e);console.error(e);}})();requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{audio.dispose();observer.disconnect();units.forEach(u=>u.dispose());});
