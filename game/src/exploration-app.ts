import {gameRoute} from './core/game-session';
import './geometry-hud.css';
import {ExplorationHUD} from './exploration-hud';
import {EnemyReferenceAudio} from './enemy-reference-audio';
import {EnemyV2Panel} from './enemy-v2-panel';
import {EnemyDanger} from './enemy-danger';
import {createEnemyPlaytest,ENEMY_GROUPS,type EnemyPlaytestMode} from './core/enemy-playtest';
import {isXX,xxState} from './core/xx-combat';
import {createEnemyFixture} from './core/en01-fixture';
import {EnemyFixturePanel} from './en01-panel';
import {isAlV2,alState} from './core/al-state';
import {pauseAl} from './core/al-combat';
import {AlReferenceAudio} from './al-reference-audio';
import {HunterReferenceAudio} from './hunter-reference-audio';
import {isHunterV2,hunterState,pauseHunter,hunterTimeScale} from './core/hunter-combat';
import {TacticWheel} from './tactic-wheel';
import {querySkillAimPreview,skillInput,updateSkillAimPointer} from './core/skill-intent';
import {skillInSlot} from './core/skill-slots';
import {SKILL_CATALOG} from './core/skill-catalog';
import {standaloneSummary} from './core/standalone-summary';
import {controlledBody} from './core/direct-control';
import {aimActor,bodyActionReady,inputAuthority,usesExplorationControl} from './core/exploration-control';
import {PathAimPreviewCache} from './core/path-aim';
import {isPartyBody,isStandaloneExploration} from './core/exploration-party';
import {EnemyAlerts} from './enemy-alerts';
import {queryExplorationExit} from './core/exploration';
import {positionVisible} from './core/visibility';
import {EconomyPanel} from './economy-ui';
import {distance,unitAt} from './core/spatial';
import type {UIState} from './hud-state';
import {LootFeedback} from './loot-feedback';
import {WorldFeedback} from './world-feedback';
import {BattleAudio} from './audio';
import {createExplorationEntry,command,step,skillRangeTiles} from './core/engine';
import {BattleScene} from './view/scene';
import {SpineVisual} from './view/spine';
import {advanceTacticalFocus,focusTimeScale} from './core/tactical-focus';
import {Interaction,simulationDelta} from './interaction';
import {locomotionLocked} from './core/pressure';
import type {Command,Pos,UIOverlay} from './core/types';
const route=gameRoute(location.search),official=route.sessionMode==='exploration';
const tagSession=(s:import('./core/types').GameState)=>{s.sessionMode=route.sessionMode;return s;};
const app=document.querySelector<HTMLElement>('#app')!;
app.classList.toggle('official-session',official);
app.innerHTML='<div id="scene" aria-label="战场"></div>';
const tacticWheel=new TacticWheel(app);let wheelPress=false,wheelClick=false,effectiveTimeScale=1;
const hud=new ExplorationHUD(app),input=new Interaction(),economyPanel=new EconomyPanel(app),enemyAlerts=new EnemyAlerts(app);
let economicConfirm:'abandon'|'restartWorld'|null=null,restartWorldId:string|null=null;
const feedback=new WorldFeedback(app),audio=new BattleAudio(),hunterAudio=new HunterReferenceAudio(),alAudio=new AlReferenceAudio(),enemyAudio=new EnemyReferenceAudio(),loot=new LootFeedback(app);
let skillPreviewId:string|null=null;let skillPreviewSlot=0;
app.insertAdjacentHTML('beforeend','<div id="range-caption" hidden></div>');
let cursor={x:innerWidth/2,y:innerHeight/2};
window.addEventListener('pointerdown',()=>{audio.unlock();hunterAudio.unlock();alAudio.unlock();enemyAudio.unlock();},{passive:true});
window.addEventListener('pointermove',e=>{cursor={x:e.clientX,y:e.clientY};skillPreviewId=(e.target as HTMLElement).closest<HTMLElement>('[data-skill-preview]')?.dataset.skillPreview||null;skillPreviewSlot=Number((e.target as HTMLElement).closest<HTMLElement>('[data-skill-preview]')?.dataset.skillSlot||0);});
const enemyValidation=new URLSearchParams(location.search).get('en01')==='1';
const namedEnemies=new URLSearchParams(location.search).get('enemies')==='v2';
const requestedEnemyMode=new URLSearchParams(location.search).get('mode')??'zombie';
let enemyMode:EnemyPlaytestMode=Object.hasOwn(ENEMY_GROUPS,requestedEnemyMode)?requestedEnemyMode as EnemyPlaytestMode:'zombie';
let state=tagSession(namedEnemies?createEnemyPlaytest(0,enemyMode):enemyValidation?createEnemyFixture():createExplorationEntry()),scene:BattleScene;
if(route.developer)app.insertAdjacentHTML('beforeend',`<div id="developer-route">${route.label}</div>`);
if(new URLSearchParams(location.search).get('xx')==='1'){command(state,{type:'selectJourney',journey:'exploration'});command(state,{type:'xxExperiment',enabled:true});}
let explorationExitPending=false;
function exitExploration(){const down=state.units.filter(u=>isPartyBody(state,u)&&u.life==='downed');const check=queryExplorationExit(state,down.map(u=>u.id));if(!check.ok){show(check.reason||'无法离开');return;}cancel(false);if(!down.length){send({type:'exitExploration'});return;}explorationExitPending=true;document.querySelector<HTMLElement>('#exploration-exit-confirm')!.hidden=false;document.querySelector('#exploration-abandon-list')!.innerHTML=down.map(u=>'<label><input type="checkbox" data-abandon-body="'+u.id+'">'+u.name+' · '+(u.role==='fiorre'?'死亡后需篝火刷新':u.role==='hunter'?'进入复生':'永久死亡')+'</label>').join('');}
let basicRequestId=0;
const capturedPointers=new Set<number>();
const pressed=new Set<string>(),blocked=new Set<string>();let directId:string|null=null;
const movementKeys=['KeyW','KeyA','KeyS','KeyD'];
function vector(){return {x:Number(pressed.has('KeyD')&&!blocked.has('KeyD'))-Number(pressed.has('KeyA')&&!blocked.has('KeyA')),y:Number(pressed.has('KeyS')&&!blocked.has('KeyS'))-Number(pressed.has('KeyW')&&!blocked.has('KeyW'))};}
function clearHeld(){for(const k of pressed)blocked.add(k);if(directId){command(state,{type:'direct',id:directId,direction:null});directId=null;}}
function realActor(){return isStandaloneExploration(state)?controlledBody(state):state.units.find(u=>u.id===(input.selectedId||'hunter'))||null;}
function controlModal(){return help||document.hidden||!!economicConfirm||explorationExitPending||!!pointer?.drag;}
function switchOriginal(id:string|null){
 if(inputAuthority(state,controlModal())==='modal'){show('先完成或取消当前操作');return;}
 if(!id||realActor()?.id===id)return;
 if(!send({type:'controlBody',id}))return;
 pointer=null;hunterBasicPointer=null;
 directId=null;input.cancel();input.direct();applyHeld();
}
function directInputAllowed(){const authority=inputAuthority(state,controlModal());return state.phase==='battle'&&!paused&&authority!=='modal';}
function prepareDirectAction(key?:string){if(!usesExplorationControl(state)||!state.explorationControl?.aim)return;send({type:'cancelExplorationAim'});clearHeld();if(key)blocked.delete(key);input.direct();}
const pathPreviewCache=new PathAimPreviewCache();
function pathActor(){return state.explorationControl?.aim?.kind==='path'?aimActor(state):null;}
function cancelPathAim(){if(state.explorationControl?.aim)send({type:'cancelExplorationAim'});}
function skillAim(){return state.explorationControl?.aim?.kind==='skill'?state.explorationControl.aim:null;}
function togglePathAim(){
 if(!usesExplorationControl(state)||controlModal())return;
 if(pathActor()){cancelPathAim();return;}
 const actor=realActor();if(!actor)return;
 if(send({type:'beginExplorationAim',id:actor.id,kind:'path',source:'direct'})){clearHeld();input.cancel();show('选路中 · 左键确认 · 右键 / F 取消');}
}
function displaySelection(){return realActor()?.id??null;}
function applyHeld(){const d=vector();if(!d.x&&!d.y){if(directId)command(state,{type:'direct',id:directId,direction:null});directId=null;return;}if(!directInputAllowed())return;const actor=realActor(),id=actor?.id;if(!id||actor?.evasion?.action)return;if(directId&&directId!==id)command(state,{type:'direct',id:directId,direction:null});if(send({type:'direct',id,direction:d})){directId=id;input.direct();}}
function mobility(direction:Pos){const u=realActor();if(!u)return false;if(isAlV2(state,u))return send({type:'alInput',id:u.id,kind:'roll',direction,aim:combatAim(u)!});if(isHunterV2(state,u))return send({type:'hunterInput',id:u.id,kind:'dodge',direction,aim:hover??hunterState(u).aim});if(u.id!=="hunter"&&!isStandaloneExploration(state)){show("瞬影仅猎人可用");return false;}return send({type:u.id==='hunter'?'blink':'evade',id:u.id,direction});}
function useBlink(){if(!directInputAllowed())return;const intended=vector();prepareDirectAction();const u=realActor();if(!u)return;let d=intended;if(!d.x&&!d.y){const onBattle=document.elementFromPoint(cursor.x,cursor.y)?.closest('#scene');const p=onBattle?pick(cursor.x,cursor.y).tile:null;if(!p){show('将鼠标移到战场指定机动方向');return;}d={x:p.x-u.pos.x,y:p.y-u.pos.y};}if(mobility(d)){input.direct();}}

function releasePhysicalInputs(){pauseHunter(state);pauseAl(state);command(state,{type:'clearBasicInputs'});for(const u of state.units){if(u.hunterCombat)u.hunterCombat.held=false;if(u.alCombat){u.alCombat.held=false;u.alCombat.shotHeld=false;}}hunterBasicPointer=hunterGuardPointer=hunterActiveKey=alBasicPointer=alShotPointer=xxPointer=null;pressed.clear();blocked.clear();if(directId)command(state,{type:'direct',id:directId,direction:null});directId=null;pointer=null;for(const id of capturedPointers)if(sceneHost.hasPointerCapture(id))sceneHost.releasePointerCapture(id);capturedPointers.clear();}
let baseSpeed:1|2=1;
let paused=false,debug=false,help=false,hover:Pos|null=null;
const namedPanel=namedEnemies?new EnemyV2Panel(app,(mode)=>{if(mode)enemyMode=mode;clearHeld();cancel(false);state=tagSession(createEnemyPlaytest(state.combatIdentity?.generation??1,enemyMode));paused=false;}):undefined;
const ordinaryDanger=official&&!namedEnemies&&!enemyValidation?new EnemyDanger(app):undefined;
const enemyPanel=enemyValidation?new EnemyFixturePanel(app,kind=>{const current=state.units.find(u=>u.enemyV2)?.enemyV2?.profile.kind??'melee';clearHeld();command(state,{type:'clearBasicInputs'});cancel(false);state=tagSession(createEnemyFixture(kind==='reset'?current:kind,state.combatIdentity?.generation??1));paused=false;}):undefined;
let notice='',noticeUntil=0,last=performance.now(),lastHud=0;
let pointer:{x:number;y:number;drag:boolean}|null=null;
try{scene=new BattleScene(document.querySelector('#scene')!);}catch(e){hud.error('场景启动失败：'+String(e));throw e;}
void SpineVisual.preload(enemyValidation?['Livia','Arina','Rina_F_Summer','Charlotte','Dustin']:['Livia','Arina','Rina_F_Summer','Charlotte']).catch(e=>hud.error('角色资源加载失败，请刷新重试：'+String(e)));
window.addEventListener('character-load-error',e=>hud.error('角色资源加载失败：'+(e as CustomEvent).detail));
const show=(message:string)=>{notice=message;noticeUntil=performance.now()+4000;};
const send=(c:Command)=>{const r=command(state,c);if(!r.ok){const reason=r.reason||'当前无法执行';if(!(c.type==='direct'&&reason==='架势崩溃，暂时无法移动'&&notice===reason&&performance.now()<noticeUntil))show(reason);}else{notice='';if(['move','face'].includes(c.type))state.notice='';}return r.ok;};
function cancel(count=true){releasePhysicalInputs();cancelPathAim();explorationExitPending=false;document.querySelector<HTMLElement>('#exploration-exit-confirm')!.hidden=true;economicConfirm=null;restartWorldId=null;document.querySelector<HTMLElement>('#economy-confirm')!.hidden=true;clearHeld();if(count)audio.cue('cancel');input.cancel();help=false;document.querySelector<HTMLElement>('#help')!.hidden=true;document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;pointer=null;hover=null;if(count)state.stats.cancels=(state.stats.cancels||0)+1;}
function resumeCancel(){cancel();}
function toggleSpeed(){baseSpeed=baseSpeed===1?2:1;}
function pickTile(p:Pos,unitId:string|null){
 if(state.phase!=='battle')return;
 if(skillAim()){if(!controlModal()&&!paused)send({type:'confirmSkillAim',sessionId:skillAim()!.skill!.sessionId});return;}
 if(pathActor()){if(!controlModal())send({type:'confirmPathAim',to:p});return;}
 if(state.exploration&&!unitId){const event=state.exploration.definition.points.find(a=>distance(a.pos,p)<.6&&positionVisible(state,a.pos));if(event){send({type:'interactExploration',id:event.id});return;}if(distance(p,state.exploration.definition.exit)<.6){exitExploration();return;}}
}
const sceneHost=document.querySelector<HTMLElement>('#scene')!;
const overScene=(x:number,y:number)=>!!document.elementFromPoint(x,y)?.closest('#scene');
function pick(x:number,y:number){
 const p=scene.pick(x,y);
 if(!p.unitId&&p.tile)p.unitId=unitAt(state,p.tile)?.id||null;
 return p;
}
window.addEventListener('pointercancel',()=>resumeCancel());
window.addEventListener('blur',()=>{releasePhysicalInputs();hunterAudio.stop();alAudio.stop();cancel(false);});
let alBasicPointer:string|null=null,alShotPointer:string|null=null;
let hunterBasicPointer:string|null=null,hunterGuardPointer:string|null=null,hunterActiveKey:string|null=null;
function combatAim(actor=realActor(),x=cursor.x,y=cursor.y):Pos|null {
 if(!actor)return null;const p=scene.combatAimAt(x,y,actor.pos);
 if(p&&distance(p,actor.pos)>1e-4)return p;
 const previous=isHunterV2(state,actor)?hunterState(actor).aim:null;
 if(previous&&distance(previous,actor.pos)>1e-4)return {...previous};
 const f=actor.facing;return {x:actor.pos.x+(f==='west'?-1:f==='east'?1:0),y:actor.pos.y+(f==='north'?-1:f==='south'?1:0)};
}
function normalCombat(){return usesExplorationControl(state)&&directInputAllowed()&&!state.explorationControl?.aim;}
function explorationInteraction(point:ReturnType<typeof pick>){return !!(point.tile&&!point.unitId&&state.exploration&&(state.exploration.definition.points.some(a=>distance(a.pos,point.tile!)<.6&&positionVisible(state,a.pos))||distance(point.tile,state.exploration.definition.exit)<.6));}
let xxPointer:string|null=null;
window.addEventListener('pointerup',e=>{if(e.button===0&&xxPointer){send({type:'xxInput',id:xxPointer,held:false});xxPointer=null;}});
function releaseHunterPointers(){if(xxPointer){send({type:'xxInput',id:xxPointer,held:false});xxPointer=null;}if(alBasicPointer)send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});if(alShotPointer)send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alBasicPointer=alShotPointer=null;if(hunterBasicPointer)send({type:'hunterInput',id:hunterBasicPointer,kind:'basic',held:false});if(hunterGuardPointer)send({type:'hunterInput',id:hunterGuardPointer,kind:'guard',held:false});hunterBasicPointer=hunterGuardPointer=null;}
sceneHost.addEventListener('pointerdown',e=>{
 const actor=realActor(),point=pick(e.clientX,e.clientY);
 if(actor&&isXX(state,actor)&&normalCombat()){if(e.button===2){e.preventDefault();show('xx 本模型尚未适配格挡');return;}if(e.button===0&&!explorationInteraction(point)){xxPointer=actor.id;send({type:'xxInput',id:actor.id,held:true,aim:combatAim(actor,e.clientX,e.clientY)!});sceneHost.setPointerCapture(e.pointerId);capturedPointers.add(e.pointerId);return;}}
 if(actor&&isAlV2(state,actor)&&normalCombat()){const aim=combatAim(actor,e.clientX,e.clientY)!;if(e.button===2){e.preventDefault();alShotPointer=actor.id;send({type:'alInput',id:actor.id,kind:'shot',aim});return;}if(e.button===0&&!explorationInteraction(point)){alBasicPointer=actor.id;send({type:'alInput',id:actor.id,kind:'basic',aim});sceneHost.setPointerCapture(e.pointerId);capturedPointers.add(e.pointerId);return;}}
 if(actor&&isHunterV2(state,actor)&&normalCombat()){
  const aim=combatAim(actor,e.clientX,e.clientY)!;
  if(e.button===2){e.preventDefault();hunterGuardPointer=actor.id;send({type:'hunterInput',id:actor.id,kind:'guard',held:true,aim});return;}
  if(e.button===0&&!explorationInteraction(point)){hunterBasicPointer=actor.id;send({type:'hunterInput',id:actor.id,kind:'basic',held:true,aim});sceneHost.setPointerCapture(e.pointerId);capturedPointers.add(e.pointerId);return;}
 }
 if(e.button!==0||state.phase!=='battle')return;
 pointer={x:e.clientX,y:e.clientY,drag:false};
 sceneHost.setPointerCapture(e.pointerId);capturedPointers.add(e.pointerId);
});
sceneHost.addEventListener('pointermove',e=>{const point=pick(e.clientX,e.clientY);hover=point.tile;const actor=realActor();if(actor&&isXX(state,actor)&&normalCombat())xxState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(actor&&isAlV2(state,actor)&&normalCombat())alState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(actor&&isHunterV2(state,actor)&&normalCombat())hunterState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(hover&&!controlModal())updateSkillAimPointer(state,hover,point.unitId||undefined);if(pointer&&!pathActor()&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.drag=true;});
sceneHost.addEventListener('pointerup',e=>{
 if(e.button===0&&hunterBasicPointer){send({type:'hunterInput',id:hunterBasicPointer,kind:'basic',held:false});hunterBasicPointer=null;if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);return;}
 if(e.button!==0||!pointer)return;const before=pointer;pointer=null;
 if(!overScene(e.clientX,e.clientY)){if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);resumeCancel();return;}
 const p=pick(e.clientX,e.clientY);
 if(skillAim()){if(!controlModal()&&!paused)send({type:'confirmSkillAim',sessionId:skillAim()!.skill!.sessionId});}
 else if(pathActor()){if(hover||p.tile)pickTile(hover||p.tile!,p.unitId);else show('无效选路目标');}
 else if(before.drag){/* world drag never means Basic */}
 else if(normalCombat()&&!explorationInteraction(p)){const actor=realActor();if(actor&&!isHunterV2(state,actor)&&!isAlV2(state,actor)&&!isXX(state,actor)){prepareDirectAction();if(send({type:'basic',id:actor.id,aim:combatAim(actor)!,requestId:++basicRequestId}))clearHeld();}}
 else if(p.tile)pickTile(p.tile,p.unitId);else resumeCancel();
 if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);
});
sceneHost.addEventListener('pointercancel',()=>{releaseHunterPointers();pointer=null;});
sceneHost.addEventListener('lostpointercapture',e=>{capturedPointers.delete(e.pointerId);releaseHunterPointers();pointer=null;});
app.addEventListener('contextmenu',e=>{e.preventDefault();if(realActor()&&(isHunterV2(state,realActor()!)||isAlV2(state,realActor()!)||isXX(state,realActor()!))&&!pathActor())return;if(state.explorationControl?.aim&&!controlModal()){cancelPathAim();pointer=null;return;}cancel();});
app.addEventListener('click',e=>{
 const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b){if(!(e.target as HTMLElement).closest('#scene,.dialog'))resumeCancel();return;}
 if((b as HTMLButtonElement).disabled)return;
 if(b.dataset.explorationPoint){send({type:'interactExploration',id:b.dataset.explorationPoint});return;}
 if(b.dataset.companion){send({type:'selectExplorationCompanion',id:b.dataset.companion});return;}
 if(b.dataset.journey){send({type:'selectJourney',journey:'exploration',seed:Number((document.querySelector('#exploration-seed') as HTMLInputElement).value)});return;}
 if(b.dataset.action==='sound'){audio.setMuted(!audio.muted);hunterAudio.setMuted(audio.muted);alAudio.setMuted(audio.muted);enemyAudio.setMuted(audio.muted);b.textContent=audio.muted?'音效：关':'音效：开';return;}
 if(b.dataset.exchange){send({type:'exchange',from:b.dataset.exchange as 'gold'|'vitality',amount:Number((document.querySelector('#exchange-amount') as HTMLInputElement).value)});return;}
 switch(b.dataset.action){
 case 'continue-world':{const w=state.world;if(!w)break;cancel(false);if(send({type:'continueWorld',worldId:w.id,visit:w.visit.generation})){paused=false;}break;}
 case 'restart-world':{if(!state.world)break;cancel(false);restartWorldId=state.world.id;economicConfirm='restartWorld';document.querySelector<HTMLElement>('#economy-confirm')!.hidden=false;document.querySelector('#economy-confirm-title')!.textContent='开始全新测试会话？';document.querySelector('#economy-confirm-text')!.textContent='将放弃当前世界、随身资源和进度，重置角色伤势、装备、敌人及篝火。未携入库存保留。这不是继续，也不会保存旧世界。';break;}
 case 'exit-exploration':exitExploration();break;
 case 'cancel-exploration-exit':cancel(false);break;
 case 'confirm-exploration-exit':{if(!explorationExitPending)break;const all=[...document.querySelectorAll<HTMLInputElement>('[data-abandon-body]')];if(all.some(a=>!a.checked)){show('请逐个确认放弃，或取消返回庭院');break;}if(send({type:'exitExploration',abandonIds:all.map(a=>a.dataset.abandonBody!)}))cancel(false);break;}
 case 'carry':if(state.journey==='exploration'&&!send({type:'selectJourney',journey:'exploration',seed:Number((document.querySelector('#exploration-seed') as HTMLInputElement).value)}))break;if(send({type:'carry',gold:Number((document.querySelector('#carry-gold') as HTMLInputElement).value),vitality:Number((document.querySelector('#carry-vitality') as HTMLInputElement).value)})){cancel(false);if(state.journey==='exploration'){paused=false;}}break;
 case 'cancel-economic':cancel(false);break;
 case 'confirm-economic':if(economicConfirm==='restartWorld'){if(restartWorldId&&send({type:'restartWorld',worldId:restartWorldId})){cancel(false);paused=false;}}else if(economicConfirm&&send({type:economicConfirm}))cancel(false);break;
 case 'pause':releasePhysicalInputs();if(!paused){pauseHunter(state);pauseAl(state);}cancelPathAim();command(state,{type:'clearBasicInputs'});clearHeld();paused=!paused;break;
 case 'speed':toggleSpeed();break;
 case 'debug':debug=!debug;break;
 case 'help':releasePhysicalInputs();clearHeld();help=!help;document.querySelector<HTMLElement>('#help')!.hidden=!help;break;
 case 'new':send({type:'newExpedition'});cancel(false);paused=false;break;
 case 'export':{clearHeld();const panel=document.querySelector<HTMLElement>('#record-dialog')!;panel.hidden=false;panel.querySelector<HTMLTextAreaElement>('textarea')!.value=JSON.stringify({exploration:standaloneSummary(state),time:state.time,result:state.result,world:state.world,stats:state.stats,log:state.log},null,2);help=true;break;}
 case 'close-record':document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;help=false;break;
 }
});

// Capture the transient wheel before normal input routing, without taking movement authority.
window.addEventListener('keydown',e=>{
 if(e.code==='KeyG'){
  if(!isStandaloneExploration(state))return;
  if((e.target as HTMLElement).matches('input,textarea,select'))return;
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
  if(paused||controlModal()||state.explorationControl?.aim||pointer||!usesExplorationControl(state)){tacticWheel.held=true;return;}
  const hit=overScene(cursor.x,cursor.y)?pick(cursor.x,cursor.y):null;
  if(!tacticWheel.open(state,cursor,{x:innerWidth,y:innerHeight},hit?.unitId||undefined))show('没有可接受战术的离手本体');return;
 }
 if(!tacticWheel.session)return;
 if(e.key==='Escape'){tacticWheel.cancel();e.preventDefault();e.stopImmediatePropagation();return;}
 if(!movementKeys.includes(e.code)&&!e.repeat)tacticWheel.cancel();
},true);
window.addEventListener('keyup',e=>{if(e.code!=='KeyG')return;e.preventDefault();e.stopImmediatePropagation();const request=tacticWheel.release();if(request)send({type:'partyTactic',...request});},true);
window.addEventListener('pointermove',e=>tacticWheel.move({x:e.clientX,y:e.clientY}),true);
window.addEventListener('pointerdown',e=>{
 if(!tacticWheel.session)return;
 if(e.button===2){tacticWheel.cancel();e.preventDefault();e.stopImmediatePropagation();return;}
 if(e.button!==0)return;
 const ui=(e.target as HTMLElement).closest('button,[data-action]');
 if(ui&&!ui.matches('[data-unit]')){tacticWheel.cancel();return;}
 wheelPress=true;wheelClick=true;pointer=null;e.preventDefault();e.stopImmediatePropagation();
},true);
window.addEventListener('pointerup',e=>{if(e.button===0&&alBasicPointer){send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});alBasicPointer=null;}if(e.button===2&&alShotPointer){send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alShotPointer=null;}if(e.button===0&&(wheelPress||tacticWheel.session)){wheelPress=false;wheelClick=true;pointer=null;e.preventDefault();e.stopImmediatePropagation();setTimeout(()=>wheelClick=false,0);}},true);
window.addEventListener('click',e=>{if(wheelClick){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('contextmenu',e=>{if(isStandaloneExploration(state)&&(tacticWheel.session||tacticWheel.held)){tacticWheel.cancel();e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('blur',()=>{tacticWheel.cancel();tacticWheel.held=false;wheelPress=false;wheelClick=false;},true);
window.addEventListener('pointercancel',()=>tacticWheel.cancel(),true);
window.addEventListener('resize',()=>tacticWheel.cancel());
document.addEventListener('visibilitychange',()=>{if(document.hidden){{pauseHunter(state);pauseAl(state);}tacticWheel.cancel();tacticWheel.held=false;}});
window.addEventListener('keydown',e=>{
 if((e.target as HTMLElement).matches('input,textarea,select'))return;
 if(e.code==='AltLeft'){e.preventDefault();if(!e.repeat&&!document.hidden)toggleSpeed();return;}
 if(['KeyQ','KeyH','KeyB','Tab','KeyC','KeyV'].includes(e.code)||/^[1-4]$/.test(e.key)){e.preventDefault();return;}
 if(e.repeat)return;
 if(e.code==='KeyF'&&usesExplorationControl(state)){e.preventDefault();togglePathAim();return;}
 if(usesExplorationControl(state)&&e.code==='KeyZ'){e.preventDefault();if(paused||controlModal()){show('先完成或取消当前操作');return;}switchOriginal(realActor()?.id==='hunter'?state.explorationCompanionId??null:'hunter');return;}
 if(explorationExitPending||economicConfirm){if(e.key==='Escape')cancel(false);return;}
 if(movementKeys.includes(e.code)){e.preventDefault();pressed.add(e.code);if(!directInputAllowed()){blocked.add(e.code);return;}prepareDirectAction(e.code);applyHeld();return;}
 if(e.key==='Escape'){const a=realActor();if(a&&isAlV2(state,a)&&a.alCombat?.special?.kind==='rocket'){send({type:'alInput',id:a.id,kind:'cancel'});return;}if(a&&isHunterV2(state,a)&&a.hunterCombat?.special?.kind==='prepare'){send({type:'hunterInput',id:a.id,kind:'cancel'});hunterActiveKey=null;return;}if(usesExplorationControl(state)&&!controlModal()&&state.explorationControl?.aim){send({type:'cancelExplorationAim'});return;}resumeCancel();return;}
 if(e.code==='Space'){e.preventDefault();releasePhysicalInputs();if(skillAim())cancelPathAim();command(state,{type:'clearBasicInputs'});clearHeld();if(state.phase==='battle'){if(!paused){pauseHunter(state);pauseAl(state);}paused=!paused;}return;}
 if(state.phase!=='battle'||paused||help||document.hidden)return;
 const xx=realActor();if(xx&&isXX(state,xx)&&['ShiftLeft','ShiftRight','KeyE','KeyR','KeyT'].includes(e.code)){e.preventDefault();show('xx 本模型尚未适配该动作');return;}
 const al=realActor();if(al&&isAlV2(state,al)&&!controlModal()&&!state.explorationControl?.aim){if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();send({type:'alInput',id:al.id,kind:'roll',aim:combatAim(al)!,direction:vector()});return;}if(e.code==='KeyE'){e.preventDefault();send({type:'alInput',id:al.id,kind:'rocket',aim:combatAim(al)!});return;}if(e.code==='KeyR'||e.code==='KeyT'){show('待新技能');return;}}
 const hunter=realActor();if(hunter&&isHunterV2(state,hunter)&&!controlModal()&&!state.explorationControl?.aim){
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();send({type:'hunterInput',id:hunter.id,kind:'dodge',aim:combatAim(hunter)!,direction:vector()});return;}
  if(e.code==='KeyE'){e.preventDefault();hunterActiveKey=hunter.id;send({type:'hunterInput',id:hunter.id,kind:'active',held:true,aim:combatAim(hunter)!});return;}
  if(e.code==='KeyR'||e.code==='KeyT'){show('空技能槽');return;}
 }
 if(e.code==='KeyE'||isStandaloneExploration(state)&&['KeyR','KeyT'].includes(e.code)){if(!directInputAllowed())return;prepareDirectAction();const u=realActor();const slot=(e.code==='KeyR'?1:e.code==='KeyT'?2:0) as 0|1|2;if(u&&send(skillInSlot(u,slot)&&skillInput(skillInSlot(u,slot)!).direct==='aimConfirm'?{type:'beginSkillAim',id:u.id,slot,source:'direct'}:{type:'skill',id:u.id,slot})){if(SKILL_CATALOG[skillInSlot(u,slot)!]?.kind==='timed')clearHeld();input.direct();}return;}
 if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();useBlink();}
});
window.addEventListener('pointerup',e=>{if(e.button===0&&alBasicPointer){send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});alBasicPointer=null;}if(e.button===2&&alShotPointer){send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alShotPointer=null;}if(e.button===2&&hunterGuardPointer){send({type:'hunterInput',id:hunterGuardPointer,kind:'guard',held:false});hunterGuardPointer=null;}if(e.button===0&&hunterBasicPointer){send({type:'hunterInput',id:hunterBasicPointer,kind:'basic',held:false});hunterBasicPointer=null;}});
window.addEventListener('keyup',e=>{if(e.code==='KeyE'&&hunterActiveKey){send({type:'hunterInput',id:hunterActiveKey,kind:'active',held:false});hunterActiveKey=null;}if(e.code==='AltLeft'){if(!(e.target as HTMLElement).matches('input,textarea,select'))e.preventDefault();return;}if(movementKeys.includes(e.code)){pressed.delete(e.code);blocked.delete(e.code);applyHeld();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePhysicalInputs();command(state,{type:'clearBasicInputs'});if(document.hidden){cancelPathAim();}clearHeld();last=performance.now();});
window.addEventListener('error',e=>hud.error('运行错误：'+e.message));window.addEventListener('unhandledrejection',e=>hud.error('资源或运行错误：'+String(e.reason)));
function frame(now:number){
 app.classList.toggle("entry-open",official&&state.phase==='account');
 if(tacticWheel.session&&(!tacticWheel.valid(state)||paused||controlModal()||state.explorationControl?.aim))tacticWheel.cancel();
 const real=(now-last)/1000;last=now;
 if(directId&&!state.units.some(u=>u.id===directId&&u.life==='active'))clearHeld();
 if(input.stage==='select'&&input.selectedId&&!state.units.some(u=>u.id===input.selectedId&&['active','downed'].includes(u.life)))input.cancel();
 const slow=false;advanceTacticalFocus(state,real,paused||help||document.hidden||explorationExitPending||!!economicConfirm);const timeScale=Math.min(slow?.1:baseSpeed,state.tacticalFocus?focusTimeScale(state):baseSpeed,tacticWheel.session?tacticWheel.scale:baseSpeed);effectiveTimeScale=paused||help||document.hidden||explorationExitPending||economicConfirm?0:timeScale;let dt=simulationDelta(real,paused||help||explorationExitPending||!!economicConfirm,document.hidden,timeScale);
 const namedReady=state.units.filter(u=>u.enemyVisualProfileId?state.phase==='battle'&&positionVisible(state,u.pos):['hunter-v2','al-basic-v1'].includes(u.basicProfileId??'')&&['active','downed'].includes(u.life)).every(u=>scene.unitVisuals.get(u.id)?.reference?.ready);if(!namedReady){dt=0;effectiveTimeScale=0;}
 effectiveTimeScale*=hunterTimeScale(state);
 if(state.phase==='battle'){if((slow||tacticWheel.session)&&!document.hidden)state.stats.slowTime+=Math.min(real,.1);if(paused&&!document.hidden)state.stats.pausedTime=(state.stats.pausedTime||0)+Math.min(real,.1);const before=state.time;step(state,dt,Math.min(real,.1));dt=state.time-before;}
 if(directId&&!state.units.find(u=>u.id===directId)?.direct)directId=null;
 if(!directId&&Math.hypot(vector().x,vector().y)>0){const u=realActor();if(u&&u.life==='active'&&!u.cloneOf&&u.stagger<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!locomotionLocked(u))applyHeld();}
 const u=aimActor(state)||state.units.find(u=>u.id===(skillPreviewId||displaySelection()));let path:Pos[]=[],range:Pos[]=[];
 const skillPreview=!!u&&(!!skillAim()||skillPreviewId===u.id);
 if(skillPreview){const id=skillAim()?.skill?.skillId||skillInSlot(u!,skillPreviewSlot);range=id?skillRangeTiles(state,u!,u!.facing,id):[];}
 const caption=document.querySelector<HTMLElement>('#range-caption')!;caption.hidden=!u||(official&&!skillPreview);caption.classList.toggle('skill-preview',skillPreview);caption.textContent=skillAim()?((querySkillAimPreview(state).description||'技能准备')+' · '+(querySkillAimPreview(state).ok?'左键确认 · 右键取消':querySkillAimPreview(state).reason)):skillPreview?'技能范围 · '+(SKILL_CATALOG[skillInSlot(u!,skillPreviewSlot)!]?.name||'空槽'):'普攻范围 · 圆形 / 阴影处不可命中';
 const aimed=pathActor(),preview=aimed&&hover?pathPreviewCache.query(state,aimed,hover):null;
 if(aimed){path=preview?.valid?[{...aimed.pos},...preview.path]:[];caption.hidden=false;caption.textContent='选路 · '+aimed.name+' · '+(preview?.valid?(bodyActionReady(aimed)?'左键确认 · 右键取消':'角色当前动作尚未结束'):preview?.reason||'指向可抵达的位置');}
 const overlay:UIOverlay={debugAutonomy:debug,selectedId:displaySelection(),hover,path,range,rangeKind:skillPreview?'skill':'attack',hoverValid:aimed?preview?.valid:undefined,deployTiles:[],targeting:false};
 scene.update(state,overlay,dt,Math.min(real,.1));audio.update(state);hunterAudio.update(state,effectiveTimeScale);alAudio.update(state,effectiveTimeScale);enemyAudio.update(state,effectiveTimeScale);loot.update(state,p=>scene.project(p));
 if(now-lastHud>16){lastHud=now;const v:UIState={paused,speed:baseSpeed,slow,notice:now<noticeUntil?notice:''};hud.render(state,v);for(const actor of state.units.filter(u=>isHunterV2(state,u)||isAlV2(state,u))){const portrait=(scene as any).unitVisuals.get(actor.id)?.reference?.portrait;for(const img of app.querySelectorAll<HTMLImageElement>(`[data-body="${actor.id}"] img`)){img.style.visibility=portrait?'visible':'hidden';const source=actor.basicProfileId!;if(portrait&&img.dataset.source!==source){img.src=portrait;img.dataset.source=source;}}}economyPanel.render(state);}
 feedback.update(state,path,p=>scene.project(p));
 enemyAlerts.update(state,p=>scene.project(p));
 tacticWheel.render(state,p=>scene.project(p));
 namedPanel?.update(state,(p,alt)=>scene.project(p,alt),id=>{const a=scene.unitVisuals.get(id);return a?.loadFailed?'加载失败':a?.reference?.ready?'原模型 Ready':'加载中';});
 ordinaryDanger?.update(state,(p,alt)=>scene.project(p,alt));
 enemyPanel?.update(state,p=>scene.project(p));
 requestAnimationFrame(frame);
}
(window as any).prototype={get wheel(){return tacticWheel.session;},get wheelScale(){return tacticWheel.scale;},get effectiveTimeScale(){return effectiveTimeScale;},get audio(){return audio;},get pathAimTarget(){return pathActor()&&hover?{...hover}:null;},get state(){return state;},project:(p:Pos)=>scene.project(p),get interaction(){return input;},get scene(){return scene;}};
requestAnimationFrame(frame);
