import './style.css';
import {LootFeedback} from './loot-feedback';
import {WorldFeedback} from './world-feedback';
import {BattleAudio} from './audio';
import {createGame,command,step,pathTo,rangeTiles,skillRangeTiles,deployTiles,cloneTiles} from './core/engine';
import {BattleScene} from './view/scene';
import {SpineVisual} from './view/spine';
import {Interaction,simulationDelta} from './interaction';
import {HUD,type UIState} from './ui';
import type {Command,Direction,Pos,UIOverlay} from './core/types';
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML='<div id="scene" aria-label="战场"></div>';
const hud=new HUD(app), input=new Interaction();
const feedback=new WorldFeedback(app),audio=new BattleAudio(),loot=new LootFeedback(app);
let skillPreviewId:string|null=null;
app.insertAdjacentHTML('beforeend','<div id="range-caption" hidden></div>');
let cursor={x:innerWidth/2,y:innerHeight/2};
window.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
window.addEventListener('pointermove',e=>{cursor={x:e.clientX,y:e.clientY};skillPreviewId=(e.target as HTMLElement).closest<HTMLElement>('#unit-detail [data-skill-preview]')?.dataset.skillPreview||null;});
let state=createGame('standard'),scene:BattleScene;
let initialSetup=true;
let retreatId:string|null=null;
let paused=false,speed=1,backpack=false,debug=false,help=false,hover:Pos|null=null,cardId:string|null=null,item:'heal'|'weapon'|'light'|null=null;
let notice='',noticeUntil=0,fps=60,last=performance.now(),lastHud=0,cloneSource:string|null=null,dashTarget:string|null=null;
let pointer:{x:number;y:number;id:string|null;drag:boolean;wasSelected:boolean;when:number}|null=null;
let dashDirection:Direction|null=null;
let rosterDrag:{id:string;x:number;y:number;drag:boolean;pointerId:number}|null=null;
let suppressRosterClick=false;
try{scene=new BattleScene(document.querySelector('#scene')!);}catch(e){hud.error('场景启动失败：'+String(e));throw e;}
let assetsReady=false;
void SpineVisual.preload(['Galore','Livia','Arina','Cynthia','Dustin','Verlaine_bot']).then(()=>assetsReady=true).catch(e=>hud.error('角色资源加载失败，请刷新重试：'+String(e)));
window.addEventListener('character-load-error',e=>hud.error('角色资源加载失败：'+(e as CustomEvent).detail));
const show=(message:string)=>{notice=message;noticeUntil=performance.now()+4000;};
const send=(c:Command)=>{if(c.type!=='extract')retreatId=null;const r=command(state,c);if(!r.ok)show(r.reason||'当前无法执行');else{if(c.type==='card')hud.cardMotion.used(c.cardId,scene.project(c.to));notice='';if(['move','face','deploy'].includes(c.type))state.notice='';}return r.ok;};
function cancel(count=true){if(count)audio.cue('cancel');input.cancel();cardId=null;item=null;cloneSource=null;dashTarget=null;backpack=false;help=false;document.querySelector<HTMLElement>('#help')!.hidden=true;document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;document.querySelector<HTMLElement>('#dash-directions')!.hidden=true;pointer=null;hover=null;retreatId=null;if(count)state.stats.cancels=(state.stats.cancels||0)+1;}
function resumeCancel(){cancel();speed=1;paused=false;}
function select(id:string){retreatId=null;cloneSource=null;dashTarget=null;const u=state.units.find(u=>u.id===id);if(!u)return;cardId=null;item=null;if(u.life==='reserve'||u.life==='withdrawn')input.deploy(id);else input.select(id);}
function confirmDash(dir:Direction|null=dashDirection){
 const u=state.units.find(u=>u.id===dashTarget);if(!dir||!u||!cardId)return;
 const to={x:u.pos.x+(dir==='east'?1:dir==='west'?-1:0),y:u.pos.y+(dir==='south'?1:dir==='north'?-1:0)};
 if(send({type:'card',cardId,to,targetId:u.id,direction:dir}))cancel(false);
}
function pickTile(p:Pos,unitId:string|null,quick=false){
 if(state.phase!=='battle')return;
 if(cloneSource){if(send({type:'clone',id:cloneSource,to:p})){cloneSource=null;input.cancel();}return;}
 if(cardId){const c=state.cards.find(c=>c.id===cardId);if(c?.kind==='dash'){
   if(!dashTarget){const target=state.units.find(u=>u.id===unitId&&u.team==='ally'&&u.life==='active'&&!u.cloneOf);if(target){dashTarget=target.id;dashDirection=null;show('移动鼠标选择方向，点击战场确认；右键取消');return;}show('疾行牌需要选择可移动的在场角色');return;}
   confirmDash();return;
  }const target=unitId||undefined;
  if(send({type:'card',cardId,to:p,targetId:target})){cardId=null;input.cancel();}else resumeCancel();return;}
 if(item){if(send({type:'item',item,to:p,targetId:unitId||undefined})){item=null;input.cancel();}else resumeCancel();return;}
 const picked=state.units.find(u=>u.id===unitId&&u.team==='ally');
 if(picked&&!quick&&(input.stage==='idle'||picked.id!==input.selectedId)){select(picked.id);return;}
 const selected=state.units.find(u=>u.id===input.selectedId);
 if(selected&&input.stage!=='idle'){
  if(!input.deploying&&selected.life!=='active'){show('该角色当前不能移动');return;}
  if(!input.deploying&&p.x===selected.pos.x&&p.y===selected.pos.y){resumeCancel();return;}
  if(!input.deploying&&p.x===state.goal.x&&p.y===state.goal.y){retreatId=selected.id;return;}
  const occupied=state.units.some(u=>u.id!==selected.id&&u.team==='ally'&&['active','downed'].includes(u.life)&&u.pos.x===p.x&&u.pos.y===p.y);
  const tile=state.tiles.find(t=>t.x===p.x&&t.y===p.y);
  if(!tile||tile.obstacle||occupied){resumeCancel();return;}
  const c=input.destination(p,quick);if(c){send(c);speed=1;}
 }else resumeCancel();
}
const sceneHost=document.querySelector<HTMLElement>('#scene')!;
function pick(x:number,y:number){
 const p=scene.pick(x,y);
 if(!p.unitId&&p.tile)p.unitId=state.units.find(u=>u.team==='ally'&&['active','downed'].includes(u.life)&&u.pos.x===p.tile!.x&&u.pos.y===p.tile!.y)?.id||null;
 return p;
}
app.addEventListener('pointerdown',e=>{
 const b=(e.target as HTMLElement).closest<HTMLElement>('[data-unit]');
 if(!b||e.button!==0||state.phase!=='battle')return;
 rosterDrag={id:b.dataset.unit!,x:e.clientX,y:e.clientY,drag:false,pointerId:e.pointerId};
 b.setPointerCapture(e.pointerId);
});
window.addEventListener('pointermove',e=>{
 if(!rosterDrag)return;const d=rosterDrag;
 if(!d.drag&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8){
  d.drag=true;const u=state.units.find(u=>u.id===d.id)!;cancel(false);
  if(u.life==='active'&&!u.cloneOf){cloneSource=u.id;}else if(['reserve','withdrawn'].includes(u.life))select(u.id);
 }
 if(d.drag)hover=pick(e.clientX,e.clientY).tile;
});
window.addEventListener('pointerup',e=>{
 if(!rosterDrag){if(e.button===0)setTimeout(()=>suppressRosterClick=false,0);return;}if(e.pointerId!==rosterDrag.pointerId)return;const d=rosterDrag;rosterDrag=null;
 if(!d.drag)return;suppressRosterClick=true;setTimeout(()=>suppressRosterClick=false,0);
 const p=pick(e.clientX,e.clientY);if(p.tile&&(cloneSource||input.deploying))pickTile(p.tile,null,true);else resumeCancel();
});
window.addEventListener('pointercancel',()=>{rosterDrag=null;resumeCancel();});
window.addEventListener('blur',()=>{rosterDrag=null;pointer=null;cancel(false);});
sceneHost.addEventListener('pointerdown',e=>{
 if(e.button!==0||state.phase!=='battle')return;
 const p=pick(e.clientX,e.clientY),u=state.units.find(u=>u.id===p.unitId&&u.team==='ally');
 pointer={x:e.clientX,y:e.clientY,id:u?.id||null,drag:false,wasSelected:!!u&&u.id===input.selectedId,when:performance.now()};
 if(u&&!cardId&&!item&&u.life==='active'&&u.id!==input.selectedId){select(u.id);}
 sceneHost.setPointerCapture(e.pointerId);
});
sceneHost.addEventListener('pointermove',e=>{hover=pick(e.clientX,e.clientY).tile;if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.drag=true;});
sceneHost.addEventListener('pointerup',e=>{
 if(e.button!==0||!pointer)return;const before=pointer;pointer=null;
 const p=pick(e.clientX,e.clientY);
 if(dashTarget){confirmDash();}
 else if(before.drag&&before.id&&p.tile&&!cardId&&!item){const u=state.units.find(u=>u.id===before.id);if(u?.life==='active'&&!u.cloneOf){select(before.id);pickTile(p.tile,null,true);}}
 else if(p.tile){if(before.id===input.selectedId&&input.stage==='select'&&!before.wasSelected&&!before.drag&&!cardId&&!item){/* first click selects only */}else pickTile(p.tile,p.unitId);}else resumeCancel();
 if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);
});
sceneHost.addEventListener('pointercancel',()=>{pointer=null;});
app.addEventListener('contextmenu',e=>{e.preventDefault();if(rosterDrag)suppressRosterClick=true;rosterDrag=null;cancel();speed=1;paused=false;});
app.addEventListener('click',e=>{
 if(suppressRosterClick){e.preventDefault();return;}
 const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b){if(!(e.target as HTMLElement).closest('#scene,.dialog,.briefing'))resumeCancel();return;}
 if(b.dataset.action==='retreat'){if(retreatId===input.selectedId&&retreatId&&send({type:'extract',id:retreatId,via:'gate'}))resumeCancel();return;}
 if(b.dataset.action==='sound'){audio.setMuted(!audio.muted);b.textContent=audio.muted?'音效：关':'音效：开';return;}
 if(b.dataset.unit){const u=state.units.find(u=>u.id===b.dataset.unit);if(state.phase==='battle'&&u?.team==='ally'&&u.life==='active'&&!u.cloneOf){input.cancel();cloneSource=cloneSource===u.id?null:u.id;dashTarget=null;cardId=null;item=null;if(cloneSource)show('选择相邻空格部署影复制体 · '+state.fragments+' 碎片');}else select(b.dataset.unit);return;}
 if(b.dataset.skill){if(send({type:'skill',id:b.dataset.skill}))cancel(false);return;}
 if(b.dataset.dash){confirmDash(b.dataset.dash as Direction);return;}
 if(b.dataset.card){retreatId=null;if(state.phase!=='battle')return;const next=cardId===b.dataset.card?null:b.dataset.card;cardId=next;dashTarget=null;cloneSource=null;item=null;const c=state.cards.find(c=>c.id===next);show(c?.kind==='dash'?'选择一名角色，再选疾行方向；右键取消':'选择目标；右键取消');return;}
 if(b.dataset.rescue){if(send({type:'rescue',id:b.dataset.rescue}))input.cancel();return;}
 if(b.dataset.extract){if(send({type:'extract',id:b.dataset.extract,via:b.dataset.via as 'shadow'|'gate'})){input.cancel();}return;}
 if(b.dataset.switch){send({type:'switchWeapon',id:b.dataset.switch});return;}
 if(b.dataset.equip){send({type:'equipQuick',item:b.dataset.equip as 'heal'|'weapon'|'light'});return;}
 if(b.dataset.item){item=b.dataset.item as typeof item;cardId=null;backpack=false;input.cancel();show('选择猎人周围的目标');return;}
 if(b.dataset.mode&&state.phase==='briefing'&&initialSetup){state=createGame(b.dataset.mode);cancel(false);return;}
 if(b.dataset.node){if(send({type:'enter',node:Number(b.dataset.node)})){cancel(false);paused=false;}return;}
 switch(b.dataset.action){
 case 'start':if(!assetsReady)return;initialSetup=false;send({type:'start'});paused=false;cancel(false);break;
 case 'pause':paused=!paused;break;
 case 'speed':speed=speed===1?2:1;cancel(false);break;
 case 'draw':if(send({type:'draw'})){cancel(false);show('已主动抽取 4 张背包牌 · 临场与专属牌保留');}break;
 case 'autoDraw':send({type:'autoDraw'});break;
 case 'backpack':backpack=!backpack;break;
 case 'debug':debug=!debug;break;
 case 'help':help=!help;document.querySelector<HTMLElement>('#help')!.hidden=!help;break;
 case 'continue':send({type:'continue'});cancel(false);break;
 case 'rest':send({type:'rest'});break;
 case 'new':initialSetup=true;state=createGame();cancel(false);paused=false;break;
 case 'export':{const panel=document.querySelector<HTMLElement>('#record-dialog')!;panel.hidden=false;panel.querySelector<HTMLTextAreaElement>('textarea')!.value=JSON.stringify({time:state.time,result:state.result,stats:state.stats,log:state.log},null,2);help=true;break;}
 case 'close-record':document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;help=false;break;
 }
});
app.addEventListener('dragstart',e=>{if((e.target as HTMLElement).closest('[data-unit]')){e.preventDefault();return;}const t=(e.target as HTMLElement).closest<HTMLElement>('[data-bag-item]');if(t)(e as DragEvent).dataTransfer?.setData('text/plain',t.dataset.bagItem!);});
app.addEventListener('dragover',e=>{if((e.target as HTMLElement).closest('#quick-drop'))e.preventDefault();});
app.addEventListener('drop',e=>{if(!(e.target as HTMLElement).closest('#quick-drop'))return;e.preventDefault();const k=(e as DragEvent).dataTransfer?.getData('text/plain');if(k==='heal'||k==='weapon'||k==='light')send({type:'equipQuick',item:k});});
window.addEventListener('keydown',e=>{
 if((e.target as HTMLElement).matches('input,textarea,select'))return;
 if(e.key==='Escape'){resumeCancel();help=false;document.querySelector<HTMLElement>('#help')!.hidden=true;return;}
 if(e.code==='Space'){e.preventDefault();if(state.phase==='battle')paused=!paused;return;}
 if(state.phase!=='battle')return;
 if(/^[1-4]$/.test(e.key)){const u=state.units.filter(u=>u.team==='ally'&&!u.cloneOf)[Number(e.key)-1];if(u&&send({type:'skill',id:u.id}))cancel(false);}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
window.addEventListener('error',e=>hud.error('运行错误：'+e.message));window.addEventListener('unhandledrejection',e=>hud.error('资源或运行错误：'+String(e.reason)));
function frame(now:number){
 const real=(now-last)/1000;last=now;fps=fps*.95+(1/Math.max(real,.001))*.05;
 if(cardId&&!state.cards.some(c=>c.id===cardId)){cardId=null;input.cancel();speed=1;}
 const slow=input.slow||backpack||!!cardId||!!cloneSource;const dt=simulationDelta(real,paused||help,document.hidden,slow,speed);
 if(state.phase==='battle'){if(slow&&!document.hidden)state.stats.slowTime+=Math.min(real,.1);if(paused&&!document.hidden)state.stats.pausedTime=(state.stats.pausedTime||0)+Math.min(real,.1);step(state,dt);}
 const u=state.units.find(u=>u.id===(cloneSource||input.selectedId));let path:Pos[]=[],range:Pos[]=[];
 if(u){const origin=input.deploying?hover:null;const preview=origin?{...u,pos:origin}:u;const tiles=(['north','east','south','west'] as Direction[]).flatMap(d=>rangeTiles(state,preview,d));range=[...new Map(tiles.map(p=>[p.x+','+p.y,p])).values()];if(hover&&!input.deploying&&!cloneSource&&u.life==='active'&&!u.cloneOf)path=pathTo(state,u.pos,hover);}
 if(u&&path.length)path=[{...u.pos},...path];
 const skillPreview=!!u&&skillPreviewId===u.id;
 if(skillPreview){const tiles=(['north','east','south','west'] as Direction[]).flatMap(d=>skillRangeTiles(state,u!,d));range=[...new Map(tiles.map(p=>[p.x+','+p.y,p])).values()];}
 const caption=document.querySelector<HTMLElement>('#range-caption')!;caption.hidden=!u;caption.classList.toggle('skill-preview',skillPreview);caption.textContent=skillPreview?'技能范围 · '+(({hunter:'猎杀时刻',fiorre:'生命祷告 · 周围队友',guard:'毒刃连锁 · 自动触发',ranger:'狙击姿态'} as Record<string,string>)[u!.role]||'技能'):'普攻范围 · 四向';
 const dash=state.cards.find(c=>c.id===cardId&&c.kind==='dash'),source=state.units.find(u=>u.id===cloneSource);const dashPanel=document.querySelector<HTMLElement>('#dash-directions')!;
 if(dash&&dashTarget){
  const target=state.units.find(u=>u.id===dashTarget);
  if(!target||target.life!=='active'||target.cloneOf){dashTarget=null;dashPanel.hidden=true;}
  else{
   if(dashPanel.dataset.target!==target.id){dashPanel.dataset.target=target.id;dashPanel.innerHTML=(['north','east','south','west'] as Direction[]).map(d=>'<button data-dash="'+d+'" aria-label="疾行方向 '+d+'">'+({north:'↑',east:'→',south:'↓',west:'←'} as const)[d]+'</button>').join('');}
   dashPanel.hidden=false;const here=scene.project(target.drawPos||target.pos);dashPanel.style.left=here.x+'px';dashPanel.style.top=(here.y-32)+'px';
   const dx=cursor.x-here.x,dy=cursor.y-(here.y-32);
   const aimed:Direction=Math.abs(dx)>=Math.abs(dy)?(dx<0?'west':'east'):(dy<0?'north':'south');
   const offset={north:{x:0,y:-1},east:{x:1,y:0},south:{x:0,y:1},west:{x:-1,y:0}};
   dashDirection=null;
   for(const b of dashPanel.querySelectorAll<HTMLButtonElement>('[data-dash]')){
    const d=b.dataset.dash as Direction,to={x:target.pos.x+offset[d].x,y:target.pos.y+offset[d].y};
    const t=state.tiles.find(t=>t.x===to.x&&t.y===to.y);
    const legal=!!t&&!t.obstacle&&!state.units.some(a=>a.id!==target.id&&['active','downed'].includes(a.life)&&a.pos.x===to.x&&a.pos.y===to.y)&&pathTo(state,target.pos,to).length>0;
    b.disabled=!legal;b.classList.toggle('aimed',d===aimed);
    if(d===aimed&&legal&&Math.hypot(dx,dy)>18)dashDirection=d;
   }
   path=dashDirection?[{...target.pos},{x:target.pos.x+offset[dashDirection].x,y:target.pos.y+offset[dashDirection].y}]:[];
  }
 }
 else{dashPanel.hidden=true;dashPanel.dataset.target='';}
 const overlay:UIOverlay={rangeKind:skillPreview?'skill':'attack',selectedId:cloneSource||input.selectedId,hover,path,range,deployTiles:source?cloneTiles(state,source.id):input.deploying?deployTiles(state):[],targeting:!!cardId||!!item};
 scene.update(state,overlay,dt);audio.update(state);loot.update(state,p=>scene.project(p));
 if(now-lastHud>16){lastHud=now;const v:UIState={initialSetup,selectedId:input.selectedId,paused,speed,slow,stage:input.stage,backpack,debug,cardId,item,notice:now<noticeUntil?notice:'',fps,assets:(scene as any).assetStatus||'场景已加载'};hud.render(state,v);}
 const startButton=document.querySelector<HTMLButtonElement>('[data-action="start"]');if(startButton){startButton.disabled=!assetsReady;startButton.textContent=assetsReady?'进入战斗 →':'正在准备角色…';}
 feedback.update(state,input,path,p=>scene.project(p),cardId,cursor,hover,retreatId,dashTarget);
 requestAnimationFrame(frame);
}
(window as any).prototype={get state(){return state;},project:(p:Pos)=>scene.project(p),get interaction(){return input;}};
requestAnimationFrame(frame);












