import {gameRoute} from './core/game-session';
import {ExplorationHUD} from './exploration-hud';
import {EnemyReferenceAudio} from './enemy-reference-audio';
import {EnemyV2Panel} from './enemy-v2-panel';
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
import {HandDrawer} from './hand-drawer';
import {EnemyAlerts} from './enemy-alerts';
import {queryExplorationExit} from './core/exploration';
import {positionKnown,positionVisible,previewState} from './core/visibility';
import {EconomyPanel} from './economy-ui';
import {salePrice,querySell} from './core/cards';
import {queryClone} from './core/clones';
import {surface,cell,distance,unitAt,canStop,canDeployAt,segmentClear,inWeaponRange} from './core/spatial';
import './style.css';
import {LootFeedback} from './loot-feedback';
import {WorldFeedback} from './world-feedback';
import {BattleAudio} from './audio';
import {createGame,createExplorationEntry,createExplorationScenario,command,step,pathTo,rangeTiles,skillRangeTiles,deployTiles,cloneTiles} from './core/engine';
import {BattleScene} from './view/scene';
import {SpineVisual} from './view/spine';
import {advanceTacticalFocus,focusTimeScale} from './core/tactical-focus';
import {Interaction,simulationDelta} from './interaction';
import {HUD,type UIState} from './ui';
import {BuildPanel} from './build-ui';
import {skillInfo} from './core/skill-catalog';
import {locomotionLocked} from './core/pressure';
import type {Command,Direction,Pos,UIOverlay} from './core/types';
const route=gameRoute(location.search),official=route.sessionMode==='exploration';
const tagSession=(s:import('./core/types').GameState)=>{s.sessionMode=route.sessionMode;return s;};
const app=document.querySelector<HTMLElement>('#app')!;
app.classList.toggle('official-session',official);
app.innerHTML='<div id="scene" aria-label="战场"></div>';
const tacticWheel=new TacticWheel(app);let wheelPress=false,wheelClick=false,effectiveTimeScale=1;
const hud=official?new ExplorationHUD(app):new HUD(app), input=new Interaction();const economyPanel=new EconomyPanel(app,official);let economicConfirm:'safeExit'|'abandon'|'abandonBattle'|null=null;let saleDrag:{id:string;x:number;y:number;active:boolean;pointerId:number}|null=null;let suppressCardClick=false;
const handDrawer=official?undefined:new HandDrawer(app),enemyAlerts=new EnemyAlerts(app);
const buildPanel=official?undefined:new BuildPanel(app);let buildOpen=false,buildUnit='fiorre';
const feedback=new WorldFeedback(app),audio=new BattleAudio(),hunterAudio=new HunterReferenceAudio(),alAudio=new AlReferenceAudio(),enemyAudio=new EnemyReferenceAudio(),loot=new LootFeedback(app);
let skillPreviewId:string|null=null;let skillPreviewSlot=0;
app.insertAdjacentHTML('beforeend','<div id="range-caption" hidden></div>');
let cursor={x:innerWidth/2,y:innerHeight/2};
window.addEventListener('pointerdown',()=>{audio.unlock();hunterAudio.unlock();alAudio.unlock();enemyAudio.unlock();},{passive:true});
window.addEventListener('pointermove',e=>{cursor={x:e.clientX,y:e.clientY};skillPreviewId=(e.target as HTMLElement).closest<HTMLElement>('[data-skill-preview]')?.dataset.skillPreview||null;skillPreviewSlot=Number((e.target as HTMLElement).closest<HTMLElement>('[data-skill-preview]')?.dataset.skillSlot||0);});
const explorationValidation=new URLSearchParams(location.search).get('scenario')==='exploration';
const enemyValidation=new URLSearchParams(location.search).get('en01')==='1';
const namedEnemies=new URLSearchParams(location.search).get('enemies')==='v2';
const requestedEnemyMode=new URLSearchParams(location.search).get('mode')??'zombie';
let enemyMode:EnemyPlaytestMode=Object.hasOwn(ENEMY_GROUPS,requestedEnemyMode)?requestedEnemyMode as EnemyPlaytestMode:'zombie';
let state=tagSession(namedEnemies?createEnemyPlaytest(0,enemyMode):enemyValidation?createEnemyFixture():explorationValidation?createExplorationScenario():official?createExplorationEntry():createGame('standard')),scene:BattleScene;
if(route.developer)app.insertAdjacentHTML('beforeend',`<div id="developer-route">${route.label}</div>`);
if(new URLSearchParams(location.search).get('xx')==='1'){command(state,{type:'selectJourney',journey:'exploration'});command(state,{type:'xxExperiment',enabled:true});}
if(explorationValidation)app.insertAdjacentHTML('beforeend','<div style="position:fixed;top:65px;left:20px;z-index:60;color:#e8cc8a;background:#152128;padding:8px">探索交战验证 · 不含探索进度与结算</div>');
const xxCheckbox=document.querySelector<HTMLInputElement>('#xx-experiment');if(xxCheckbox)xxCheckbox.onchange=e=>send({type:'xxExperiment',enabled:(e.target as HTMLInputElement).checked});
let initialSetup=!explorationValidation&&!enemyValidation&&!namedEnemies;
let explorationExitPending=false;
function exitExploration(){const down=state.units.filter(u=>isPartyBody(state,u)&&u.life==='downed');const check=queryExplorationExit(state,down.map(u=>u.id));if(!check.ok){show(check.reason||'无法离开');return;}cancel(false);if(!down.length){send({type:'exitExploration'});return;}explorationExitPending=true;document.querySelector<HTMLElement>('#exploration-exit-confirm')!.hidden=false;document.querySelector('#exploration-abandon-list')!.innerHTML=down.map(u=>'<label><input type="checkbox" data-abandon-body="'+u.id+'">'+u.name+' · '+(u.role==='fiorre'?'死亡后需篝火刷新':u.role==='hunter'?'进入复生':'永久死亡')+'</label>').join('');}
let retreatId:string|null=null;let abilityAim:'blink'|'collect'|null=null;
let basicRequestId=0;
const capturedPointers=new Set<number>();
const pressed=new Set<string>(),blocked=new Set<string>();let directId:string|null=null;
const movementKeys=['KeyW','KeyA','KeyS','KeyD'];
function vector(){return {x:Number(pressed.has('KeyD')&&!blocked.has('KeyD'))-Number(pressed.has('KeyA')&&!blocked.has('KeyA')),y:Number(pressed.has('KeyS')&&!blocked.has('KeyS'))-Number(pressed.has('KeyW')&&!blocked.has('KeyW'))};}
function clearHeld(){for(const k of pressed)blocked.add(k);if(directId){command(state,{type:'direct',id:directId,direction:null});directId=null;}}
function realActor(){return isStandaloneExploration(state)?controlledBody(state):state.units.find(u=>u.id===(input.selectedId||'hunter'))||null;}
function controlModal(){return help||document.hidden||buildOpen||backpack||!!cardId||!!item||!!cloneSource||!!abilityAim||!!saleDrag||!!economicConfirm||explorationExitPending||!!rosterDrag?.drag||!!pointer?.drag;}
function switchOriginal(id:string|null){
 if(inputAuthority(state,controlModal())==='modal'){show('先完成或取消当前操作');return;}
 if(!id||realActor()?.id===id)return;
 if(!send({type:'controlBody',id}))return;
 pointer=null;hunterBasicPointer=null;
 directId=null;abilityAim=null;input.cancel();input.direct();applyHeld();
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
function displaySelection(){return cloneSource||(usesExplorationControl(state)?state.units.find(u=>u.id===input.selectedId)?.cloneOf?input.selectedId:realActor()?.id:input.selectedId)||null;}
function applyHeld(){const d=vector();if(!d.x&&!d.y){if(directId)command(state,{type:'direct',id:directId,direction:null});directId=null;return;}if(!directInputAllowed())return;const actor=realActor(),id=actor?.id;if(!id||actor?.evasion?.action)return;if(directId&&directId!==id)command(state,{type:'direct',id:directId,direction:null});if(send({type:'direct',id,direction:d})){directId=id;input.direct();}}
function mobility(direction:Pos){const u=realActor();if(!u)return false;if(isAlV2(state,u))return send({type:'alInput',id:u.id,kind:'roll',direction,aim:combatAim(u)!});if(isHunterV2(state,u))return send({type:'hunterInput',id:u.id,kind:'dodge',direction,aim:hover??hunterState(u).aim});if(u.id!=="hunter"&&!isStandaloneExploration(state)){show("瞬影仅猎人可用");return false;}return send({type:u.id==='hunter'?'blink':'evade',id:u.id,direction});}
function useBlink(){if(!directInputAllowed())return;const intended=vector();prepareDirectAction();const u=realActor();if(!u)return;let d=intended;if(!d.x&&!d.y){const onBattle=document.elementFromPoint(cursor.x,cursor.y)?.closest('#scene');const p=onBattle?pick(cursor.x,cursor.y).tile:null;if(!p){show('将鼠标移到战场指定机动方向');return;}d={x:p.x-u.pos.x,y:p.y-u.pos.y};}if(mobility(d)){input.direct();abilityAim=null;}}

function releasePhysicalInputs(){pauseHunter(state);pauseAl(state);command(state,{type:'clearBasicInputs'});for(const u of state.units){if(u.hunterCombat)u.hunterCombat.held=false;if(u.alCombat){u.alCombat.held=false;u.alCombat.shotHeld=false;}}hunterBasicPointer=hunterGuardPointer=hunterActiveKey=alBasicPointer=alShotPointer=xxPointer=null;pressed.clear();blocked.clear();if(directId)command(state,{type:'direct',id:directId,direction:null});directId=null;pointer=null;rosterDrag=null;for(const id of capturedPointers)if(sceneHost.hasPointerCapture(id))sceneHost.releasePointerCapture(id);capturedPointers.clear();}
function recallAction(){const u=state.units.find(u=>u.id===input.selectedId);if(u&&u.id!=='hunter'){if(send(u.life==='downed'?{type:'rescue',id:u.id}:{type:'extract',id:u.id,via:'shadow'}))resumeCancel();}else{clearHeld();abilityAim='collect';input.cancel();show('指定收纳范围内的本体；濒死本体可请求救援');}}
let baseSpeed:1|2=1;
let paused=false,backpack=false,debug=false,help=false,hover:Pos|null=null,cardId:string|null=null,item:'heal'|'weapon'|'light'|null=null;
const namedPanel=namedEnemies?new EnemyV2Panel(app,(mode)=>{if(mode)enemyMode=mode;clearHeld();cancel(false);state=tagSession(createEnemyPlaytest(state.combatIdentity?.generation??1,enemyMode));initialSetup=false;paused=false;}):undefined;
const enemyPanel=enemyValidation?new EnemyFixturePanel(app,kind=>{const current=state.units.find(u=>u.enemyV2)?.enemyV2?.profile.kind??'melee';clearHeld();command(state,{type:'clearBasicInputs'});cancel(false);state=tagSession(createEnemyFixture(kind==='reset'?current:kind,state.combatIdentity?.generation??1));initialSetup=false;paused=false;}):undefined;
let notice='',noticeUntil=0,fps=60,last=performance.now(),lastHud=0,cloneSource:string|null=null,dashTarget:string|null=null;
let pointer:{x:number;y:number;id:string|null;drag:boolean;wasSelected:boolean;switched?:boolean;when:number}|null=null;
let dashDirection:Direction|null=null;
let rosterDrag:{id:string;clone:boolean;x:number;y:number;drag:boolean;pointerId:number}|null=null;
let suppressRosterClick=false;
try{scene=new BattleScene(document.querySelector('#scene')!);}catch(e){hud.error('场景启动失败：'+String(e));throw e;}
let assetsReady=false;
void SpineVisual.preload(['Galore','Livia','Arina','Cynthia','Dustin','Verlaine_bot','Rina_F_Summer','Charlotte']).then(()=>assetsReady=true).catch(e=>hud.error('角色资源加载失败，请刷新重试：'+String(e)));
window.addEventListener('character-load-error',e=>hud.error('角色资源加载失败：'+(e as CustomEvent).detail));
const show=(message:string)=>{notice=message;noticeUntil=performance.now()+4000;};
const send=(c:Command)=>{if(c.type!=='extract')retreatId=null;const r=command(state,c);if(!r.ok){const reason=r.reason||'当前无法执行';if(!(c.type==='direct'&&reason==='架势崩溃，暂时无法移动'&&notice===reason&&performance.now()<noticeUntil))show(reason);}else{if(c.type==='card')hud.cardMotion?.used(c.cardId,scene.project(c.to));notice='';if(['move','face','deploy'].includes(c.type))state.notice='';}return r.ok;};
function cancel(count=true){releasePhysicalInputs();cancelPathAim();explorationExitPending=false;document.querySelector<HTMLElement>('#exploration-exit-confirm')!.hidden=true;command(state,{type:'partySelection',id:null});saleDrag=null;economicConfirm=null;document.querySelector<HTMLElement>('#economy-confirm')!.hidden=true;document.querySelector('#sell-zone')?.classList.remove('selling');const saleZone=document.querySelector('#sell-zone');if(saleZone)saleZone.textContent='变卖 · 拖入手牌';buildOpen=false;clearHeld();abilityAim=null;if(count)audio.cue('cancel');input.cancel();cardId=null;item=null;cloneSource=null;dashTarget=null;backpack=false;help=false;document.querySelector<HTMLElement>('#help')!.hidden=true;document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;document.querySelector<HTMLElement>('#dash-directions')!.hidden=true;pointer=null;hover=null;retreatId=null;if(count)state.stats.cancels=(state.stats.cancels||0)+1;}
function resumeCancel(){cancel();}
function toggleSpeed(){baseSpeed=baseSpeed===1?2:1;}
function select(id:string,force=false){const target=state.units.find(u=>u.id===id);if(usesExplorationControl(state)&&target&&!target.cloneOf)return;if(!command(state,{type:'partySelection',id}).ok)return;clearHeld();abilityAim=null;if(force)input.cancel();retreatId=null;cloneSource=null;dashTarget=null;const u=state.units.find(u=>u.id===id);if(!u)return;cardId=null;item=null;if(u.life==='reserve'||u.life==='withdrawn')input.deploy(id);else {input.select(id);if(isStandaloneExploration(state)&&!u.cloneOf)input.direct();}}
function confirmDash(dir:Direction|null=dashDirection){
 const u=state.units.find(u=>u.id===dashTarget);if(!dir||!u||!cardId)return;
 const to={x:u.pos.x+(dir==='east'?1:dir==='west'?-1:0),y:u.pos.y+(dir==='south'?1:dir==='north'?-1:0)};
 if(send({type:'card',cardId,to,targetId:u.id,direction:dir}))cancel(false);
}
function pickTile(p:Pos,unitId:string|null,quick=false){
 if(state.phase!=='battle')return;
 if(skillAim()){if(!controlModal()&&!paused)send({type:'confirmSkillAim',sessionId:skillAim()!.skill!.sessionId});return;}
 if(pathActor()){if(!controlModal())send({type:'confirmPathAim',to:p});return;}
 if(abilityAim==='blink'){if(paused)return;const u=realActor();if(u&&mobility({x:p.x-u.pos.x,y:p.y-u.pos.y}))resumeCancel();return;}
 if(abilityAim==='collect'){if(unitId&&send({type:'collect',id:unitId}))resumeCancel();else if(!unitId)show('请选择本体目标');return;}
 if(cloneSource){if(send({type:'clone',id:cloneSource,to:p})){cloneSource=null;input.cancel();}return;}
 if(cardId){const c=state.cards.find(c=>c.id===cardId);if(c?.kind==='dash'){
   if(!dashTarget){const target=state.units.find(u=>u.id===unitId&&u.team==='ally'&&u.life==='active'&&!u.cloneOf);if(target){dashTarget=target.id;dashDirection=null;show('移动鼠标选择方向，点击战场确认；右键取消');return;}show('疾行牌需要选择可移动的在场角色');return;}
   confirmDash();return;
  }const target=unitId||undefined;
  if(send({type:'card',cardId,to:p,targetId:target})){cardId=null;input.cancel();}else resumeCancel();return;}
 if(item){if(send({type:'item',item,to:p,targetId:unitId||undefined})){item=null;input.cancel();}else resumeCancel();return;}
 if(state.exploration&&!unitId&&input.stage==='idle'){const event=state.exploration.definition.points.find(a=>distance(a.pos,p)<.6&&positionVisible(state,a.pos));if(event){send({type:'interactExploration',id:event.id});return;}if(distance(p,state.exploration.definition.exit)<.6){exitExploration();return;}}
 const picked=state.units.find(u=>u.id===unitId&&u.team==='ally');
 if(picked&&!quick&&!usesExplorationControl(state)&&(input.stage==='idle'||picked.id!==input.selectedId)){select(picked.id);return;}
 if(usesExplorationControl(state)&&!input.deploying){if(!directInputAllowed()||pointer?.drag)return;prepareDirectAction();const actor=realActor();if(actor&&send({type:'basic',id:actor.id,aim:p,requestId:++basicRequestId}))clearHeld();return;}
 const selected=state.units.find(u=>u.id===input.selectedId);
 if(selected&&input.stage!=='idle'){
  if(!input.deploying&&selected.life!=='active'){show('该角色当前不能移动');return;}
  if(!input.deploying&&(unitId===selected.id||distance(p,selected.pos)<.25)){select(selected.id);return;}
  if(!(input.deploying?canDeployAt(state,p,selected):canStop(state,p,selected))){show('落点受阻：检查地形、站位间距或预留位置');return;}
  clearHeld();const c=input.destination(p,quick);if(c)send(c);
 }else resumeCancel();
}
const sceneHost=document.querySelector<HTMLElement>('#scene')!;
const overScene=(x:number,y:number)=>!!document.elementFromPoint(x,y)?.closest('#scene');
function pick(x:number,y:number){
 const p=scene.pick(x,y);
 if(!p.unitId&&p.tile)p.unitId=unitAt(state,p.tile)?.id||null;
 return p;
}
app.addEventListener('pointerdown',e=>{
 const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-unit],[data-clone]');
 if(!b||b.disabled||e.button!==0||state.phase!=='battle')return;
 const id=b.dataset.clone||b.dataset.unit!,u=state.units.find(u=>u.id===id);
 if(!b.dataset.clone&&!['reserve','withdrawn'].includes(u?.life||''))return;
 rosterDrag={id,clone:!!b.dataset.clone,x:e.clientX,y:e.clientY,drag:false,pointerId:e.pointerId};
 b.setPointerCapture(e.pointerId);
});
window.addEventListener('pointermove',e=>{
 if(!rosterDrag)return;const d=rosterDrag;
 if(!d.drag&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8){
  d.drag=true;const u=state.units.find(u=>u.id===d.id)!;cancel(false);
  if(d.clone&&u.life==='active'&&!u.cloneOf){cloneSource=u.id;}else if(!d.clone&&['reserve','withdrawn'].includes(u.life))select(u.id);
 }
 if(d.drag)hover=pick(e.clientX,e.clientY).tile;
});
window.addEventListener('pointerup',e=>{if(e.button===0&&alBasicPointer){send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});alBasicPointer=null;}if(e.button===2&&alShotPointer){send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alShotPointer=null;}
 if(!rosterDrag){if(e.button===0)setTimeout(()=>suppressRosterClick=false,0);return;}if(e.pointerId!==rosterDrag.pointerId)return;const d=rosterDrag;rosterDrag=null;
 if(!d.drag)return;suppressRosterClick=true;setTimeout(()=>suppressRosterClick=false,0);
 const p=overScene(e.clientX,e.clientY)?pick(e.clientX,e.clientY):null;if(p?.tile&&(cloneSource||input.deploying))pickTile(p.tile,null,true);else resumeCancel();
});
window.addEventListener('pointercancel',()=>{rosterDrag=null;resumeCancel();});
window.addEventListener('blur',()=>{releasePhysicalInputs();{pauseHunter(state);pauseAl(state);}hunterAudio.stop();alAudio.stop();hunterBasicPointer=hunterGuardPointer=hunterActiveKey=null;command(state,{type:'clearBasicInputs'});rosterDrag=null;pointer=null;cancel(false);});
let alBasicPointer:string|null=null,alShotPointer:string|null=null;
let hunterBasicPointer:string|null=null,hunterGuardPointer:string|null=null,hunterActiveKey:string|null=null;
function combatAim(actor=realActor(),x=cursor.x,y=cursor.y):Pos|null {
 if(!actor)return null;const p=scene.combatAimAt(x,y,actor.pos);
 if(p&&distance(p,actor.pos)>1e-4)return p;
 const previous=isHunterV2(state,actor)?hunterState(actor).aim:null;
 if(previous&&distance(previous,actor.pos)>1e-4)return {...previous};
 const f=actor.facing;return {x:actor.pos.x+(f==='west'?-1:f==='east'?1:0),y:actor.pos.y+(f==='north'?-1:f==='south'?1:0)};
}
function normalCombat(){return usesExplorationControl(state)&&directInputAllowed()&&!state.explorationControl?.aim&&!cardId&&!item&&!abilityAim&&!cloneSource;}
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
 if(e.button!==0||state.phase!=='battle'||buildOpen)return;
 const p=pick(e.clientX,e.clientY),u=state.units.find(u=>u.id===p.unitId&&u.team==='ally');
 pointer={x:e.clientX,y:e.clientY,id:u?.id||null,drag:false,wasSelected:!!u&&u.id===input.selectedId,when:performance.now()};
 if(!usesExplorationControl(state)&&!state.explorationControl?.aim&&u&&!cloneSource&&!cardId&&!item&&!abilityAim&&u.life==='active'&&u.id!==input.selectedId){select(u.id);}
 sceneHost.setPointerCapture(e.pointerId);capturedPointers.add(e.pointerId);
});
sceneHost.addEventListener('pointermove',e=>{const point=pick(e.clientX,e.clientY);hover=point.tile;const actor=realActor();if(actor&&isXX(state,actor)&&normalCombat())xxState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(actor&&isAlV2(state,actor)&&normalCombat())alState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(actor&&isHunterV2(state,actor)&&normalCombat())hunterState(actor).aim=combatAim(actor,e.clientX,e.clientY)!;if(hover&&!controlModal())updateSkillAimPointer(state,hover,point.unitId||undefined);if(pointer&&!pathActor()&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.drag=true;});
sceneHost.addEventListener('pointerup',e=>{
 if(e.button===0&&hunterBasicPointer){send({type:'hunterInput',id:hunterBasicPointer,kind:'basic',held:false});hunterBasicPointer=null;if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);return;}
 if(e.button!==0||!pointer)return;const before=pointer;pointer=null;
 if(!overScene(e.clientX,e.clientY)){if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);resumeCancel();return;}
 const p=pick(e.clientX,e.clientY);
 if(before.switched){/* Explicit body click is consumed, including selecting the current body. */}
 else if(skillAim()){if(!controlModal()&&!paused)send({type:'confirmSkillAim',sessionId:skillAim()!.skill!.sessionId});}
 else if(pathActor()){if(hover||p.tile)pickTile(hover||p.tile!,p.unitId);else show('无效选路目标');}
 else if(abilityAim&&p.tile){pickTile(p.tile,p.unitId);}
 else if(dashTarget){confirmDash();}
 else if(before.drag&&before.id&&p.tile&&!cardId&&!item&&!usesExplorationControl(state)){const u=state.units.find(u=>u.id===before.id);if(u?.life==='active'&&!u.cloneOf){select(before.id,true);pickTile(p.tile,null,true);}}
 else if(before.drag){/* world drag never means Basic */}
 else if(normalCombat()&&!explorationInteraction(p)){const actor=realActor();if(actor&&!isHunterV2(state,actor)&&!isAlV2(state,actor)&&!isXX(state,actor)){prepareDirectAction();if(send({type:'basic',id:actor.id,aim:combatAim(actor)!,requestId:++basicRequestId}))clearHeld();}}
 else if(p.tile){if(before.id===input.selectedId&&input.stage==='select'&&!before.wasSelected&&!before.drag&&!cardId&&!item){/* first click selects only */}else pickTile(p.tile,p.unitId);}else resumeCancel();
 if(sceneHost.hasPointerCapture(e.pointerId))sceneHost.releasePointerCapture(e.pointerId);
});
sceneHost.addEventListener('pointercancel',()=>{releaseHunterPointers();pointer=null;});
sceneHost.addEventListener('lostpointercapture',e=>{capturedPointers.delete(e.pointerId);releaseHunterPointers();pointer=null;});
app.addEventListener('contextmenu',e=>{e.preventDefault();if(realActor()&&(isHunterV2(state,realActor()!)||isAlV2(state,realActor()!)||isXX(state,realActor()!))&&!pathActor())return;if(state.explorationControl?.aim&&!controlModal()){cancelPathAim();pointer=null;return;}if(rosterDrag)suppressRosterClick=true;rosterDrag=null;cancel();});
app.addEventListener('click',e=>{
 if(suppressRosterClick){e.preventDefault();return;}
 const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b){if(!(e.target as HTMLElement).closest('#scene,.dialog,.briefing,#build-panel'))resumeCancel();return;}
 if((b as HTMLButtonElement).disabled)return;
 if(official&&(b.dataset.party||b.dataset.clone||b.dataset.card||b.dataset.extract||b.dataset.rescue||b.dataset.destroyClone||b.dataset.node||['collect','draw','backpack','build','rest','continue','start'].includes(b.dataset.action||'')))return;
 if(usesExplorationControl(state)&&b.closest('#world-skill')&&(b.dataset.skill||b.dataset.skillUnit))return;
 if(usesExplorationControl(state)&&b.dataset.unit){select(b.dataset.unit);return;}
 if(b.dataset.action!=='debug')cancelPathAim();
 if(b.dataset.party){if(!paused&&!help&&!buildOpen&&!explorationExitPending){clearHeld();if(send({type:'party',kind:b.dataset.party as 'recall'|'regroup'}))resumeCancel();}return;}
 if(b.dataset.explorationPoint){send({type:'interactExploration',id:b.dataset.explorationPoint});return;}
 if(b.dataset.companion){send({type:'selectExplorationCompanion',id:b.dataset.companion});return;}
 if(b.dataset.journey){send({type:'selectJourney',journey:b.dataset.journey as 'tower'|'exploration',seed:Number((document.querySelector('#exploration-seed') as HTMLInputElement).value)});return;}
 if(b.dataset.buildUnit){buildUnit=b.dataset.buildUnit;return;}
 if(b.dataset.aiTendency){send({type:'configureTendency',id:buildUnit,tendency:b.dataset.aiTendency as any});return;}
 if(b.hasAttribute('data-build-slot')){buildPanel!.selectedSlot=Number(b.dataset.buildSlot);return;}
 if(b.dataset.configSkill){if(isStandaloneExploration(state))send({type:'configureSkillSlot',id:buildUnit,slot:buildPanel!.selectedSlot as 0|1|2,skillId:b.dataset.configSkill==='empty'?null:b.dataset.configSkill as any});else send({type:'configureSkill',id:buildUnit,skillId:b.dataset.configSkill as any});return;}
 if(b.hasAttribute('data-buy-stage')){send({type:'upgradeSkill',id:buildUnit,skillId:buildPanel!.selectedSkillId,kind:'stage',expectedLevel:Number(b.dataset.level)});return;}
 if(b.dataset.buyBranch){send({type:'upgradeSkill',id:buildUnit,skillId:buildPanel!.selectedSkillId,kind:'branch',branch:b.dataset.buyBranch,expectedLevel:Number(b.dataset.level)});return;}
 if(b.dataset.weaponIndex!==undefined){send({type:'weapon',id:buildUnit,index:Number(b.dataset.weaponIndex)});return;}
 if(b.dataset.context){send({type:'setContext',context:b.dataset.context as any});return;}
 if(b.dataset.unlockPreset){send({type:'unlockPreset',preset:b.dataset.unlockPreset as any});return;}
 if(b.dataset.action==='retreat'){if(retreatId===input.selectedId&&retreatId&&send({type:'extract',id:retreatId,via:'gate'}))resumeCancel();return;}
 if(b.dataset.action==='sound'){audio.setMuted(!audio.muted);hunterAudio.setMuted(audio.muted);alAudio.setMuted(audio.muted);enemyAudio.setMuted(audio.muted);b.textContent=audio.muted?'音效：关':'音效：开';return;}
 if(b.dataset.copySelect){select(b.dataset.copySelect,true);return;}
 if(b.dataset.destroyClone){if(send({type:'destroyClone',id:b.dataset.destroyClone}))resumeCancel();return;}
 if(b.dataset.unit){select(b.dataset.unit);return;}
 if(b.dataset.clone){clearHeld();input.cancel();abilityAim=null;cardId=null;item=null;cloneSource=b.dataset.clone;show('选择空地部署影复制体 · 20生命力');return;}
 if(b.dataset.skill||b.dataset.skillUnit){if(usesExplorationControl(state))return;const id=isStandaloneExploration(state)&&b.closest('#world-skill')?realActor()?.id:b.dataset.skill||b.dataset.skillUnit;if(id&&send({type:'skill',id,slot:Number(b.dataset.skillSlot||0) as 0|1|2}))resumeCancel();return;}
 if(b.dataset.dash){confirmDash(b.dataset.dash as Direction);return;}
 if(b.dataset.card){if(suppressCardClick)return;clearHeld();abilityAim=null;retreatId=null;if(state.phase!=='battle')return;const next=cardId===b.dataset.card?null:b.dataset.card;cardId=next;dashTarget=null;cloneSource=null;item=null;const c=state.cards.find(c=>c.id===next);show(c?.kind==='dash'?'选择一名角色，再选疾行方向；右键取消':'选择目标；右键取消');return;}
 if(b.dataset.rescue){if(send({type:'rescue',id:b.dataset.rescue}))resumeCancel();return;}
 if(b.dataset.extract){if(send({type:'extract',id:b.dataset.extract,via:b.dataset.via as 'shadow'|'gate'})){resumeCancel();}return;}
 if(b.dataset.switch){send({type:'switchWeapon',id:b.dataset.switch});return;}
 if(b.dataset.equip){send({type:'equipQuick',item:b.dataset.equip as 'heal'|'weapon'|'light'});return;}
 if(b.dataset.item){item=b.dataset.item as typeof item;cardId=null;backpack=false;input.cancel();show('选择猎人周围的目标');return;}
 if(b.dataset.mode&&(state.phase==='briefing'||state.phase==='account')&&initialSetup){send({type:'selectScenario',mode:b.dataset.mode as 'standard'|'hunter'|'dark'|'workbench'});cancel(false);return;}
 if(b.dataset.node){if(send({type:'enter',node:Number(b.dataset.node)})){cancel(false);paused=false;}return;}
 if(b.dataset.exchange){send({type:'exchange',from:b.dataset.exchange as 'gold'|'vitality',amount:Number((document.querySelector('#exchange-amount') as HTMLInputElement).value)});return;}
 switch(b.dataset.action){
 case 'exit-exploration':exitExploration();break;
 case 'cancel-exploration-exit':cancel(false);break;
 case 'confirm-exploration-exit':{if(!explorationExitPending)break;const all=[...document.querySelectorAll<HTMLInputElement>('[data-abandon-body]')];if(all.some(a=>!a.checked)){show('请逐个确认放弃，或取消返回庭院');break;}if(send({type:'exitExploration',abandonIds:all.map(a=>a.dataset.abandonBody!)}))cancel(false);break;}
 case 'carry':if(state.journey==='exploration'&&!send({type:'selectJourney',journey:'exploration',seed:Number((document.querySelector('#exploration-seed') as HTMLInputElement).value)}))break;if(send({type:'carry',gold:Number((document.querySelector('#carry-gold') as HTMLInputElement).value),vitality:Number((document.querySelector('#carry-vitality') as HTMLInputElement).value)})){cancel(false);if(state.journey==='exploration'){initialSetup=false;paused=false;}}break;
 case 'safe-exit':case 'abandon':case 'abandon-battle':{
  if(!state.economy.active)break;
  if(b.dataset.action==='abandon-battle'&&(state.ruleset==='exploration'||!['briefing','battle'].includes(state.phase)))break;
  cancel(false);economicConfirm=b.dataset.action==='safe-exit'?'safeExit':b.dataset.action==='abandon-battle'?'abandonBattle':'abandon';
  document.querySelector<HTMLElement>('#economy-confirm')!.hidden=false;
  document.querySelector('#economy-confirm-title')!.textContent=economicConfirm==='safeExit'?'安全离开副本':economicConfirm==='abandonBattle'?'放弃本场 · 按节点失败':'放弃本次副本';
  document.querySelector('#economy-confirm-text')!.textContent=economicConfirm==='abandonBattle'?
   `本场按失败结束。剩余重试 ${state.retries} → ${Math.max(0,state.retries-1)}。${state.retries>0?'仍可留在副本，返回地图后重入；随身资源保留，已消费不返还。':'当前已无重试机会，副本将失败，损失全部随身：'+state.economy.carried.gold+'金币 / '+state.fragments+'生命力；未携入库存保留。'}`:
   (economicConfirm==='safeExit'?'入库剩余':'损失全部随身')+'：'+state.economy.carried.gold+'金币 / '+state.fragments+'生命力。已消费的不返还。';break;
 }
 case 'cancel-economic':cancel(false);break;
 case 'confirm-economic':if(economicConfirm&&send({type:economicConfirm}))cancel(false);break;
 case 'build':{const id=b.dataset.buildOpen||input.selectedId||'fiorre';cancel(false);buildUnit=state.units.find(u=>u.id===id&&!u.cloneOf)?.id||'fiorre';buildOpen=true;break;}
 case 'close-build':resumeCancel();break;
 case 'blink':clearHeld();if(!isStandaloneExploration(state)&&input.selectedId&&input.selectedId!=='hunter'){show('瞬影仅猎人可用');break;}cancel(false);abilityAim='blink';show('点击战场指定机动方向 · 右键取消');break;
 case 'collect':recallAction();break;
 case 'start':if(!assetsReady)return;initialSetup=false;send({type:'start'});document.querySelector('#phase-panel')!.replaceChildren();paused=false;cancel(false);break;
 case 'pause':releasePhysicalInputs();if(!paused){pauseHunter(state);pauseAl(state);}cancelPathAim();command(state,{type:'clearBasicInputs'});clearHeld();paused=!paused;break;
 case 'speed':toggleSpeed();break;
 case 'draw':if(send({type:'draw',expectedPrice:Number(b.dataset.price)})){cancel(false);show('已追加一张背包牌');}break;

 case 'backpack':clearHeld();backpack=!backpack;break;
 case 'debug':debug=!debug;break;
 case 'help':releasePhysicalInputs();clearHeld();help=!help;document.querySelector<HTMLElement>('#help')!.hidden=!help;break;
 case 'end-expedition':send({type:'endExpedition'});cancel(false);break;
 case 'continue':send({type:'continue'});cancel(false);break;
 case 'rest':send({type:'rest'});break;
 case 'new':send({type:'newExpedition'});initialSetup=true;cancel(false);paused=false;break;
 case 'export':{clearHeld();const panel=document.querySelector<HTMLElement>('#record-dialog')!;panel.hidden=false;panel.querySelector<HTMLTextAreaElement>('textarea')!.value=JSON.stringify({exploration:standaloneSummary(state),time:state.time,result:state.result,stats:state.stats,log:state.log},null,2);help=true;break;}
 case 'close-record':document.querySelector<HTMLElement>('#record-dialog')!.hidden=true;help=false;break;
 }
});

app.addEventListener('pointerdown',e=>{const c=(e.target as HTMLElement).closest<HTMLElement>('[data-card]');if(!c||e.button!==0||paused||help||buildOpen||economicConfirm||!querySell(state,c.dataset.card!).ok)return;saleDrag={id:c.dataset.card!,x:e.clientX,y:e.clientY,active:false,pointerId:e.pointerId};c.setPointerCapture(e.pointerId);});
window.addEventListener('pointermove',e=>{const d=saleDrag;if(!d)return;if(!state.cards.some(c=>c.id===d.id)){saleDrag=null;return;}if(!d.active&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8){clearHeld();input.cancel();cardId=null;item=null;cloneSource=null;abilityAim=null;d.active=true;}if(!d.active)return;const z=document.querySelector<HTMLElement>('#sell-zone')!,r=z.getBoundingClientRect(),inside=e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom,c=state.cards.find(c=>c.id===d.id)!;z.classList.toggle('selling',inside);z.textContent=inside?'松手变卖 · +'+salePrice(c)+'生命力':'变卖 · 拖入手牌';});
window.addEventListener('pointerup',e=>{if(e.button===0&&alBasicPointer){send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});alBasicPointer=null;}if(e.button===2&&alShotPointer){send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alShotPointer=null;}const d=saleDrag;if(!d||e.pointerId!==d.pointerId)return;saleDrag=null;if(!d.active)return;suppressCardClick=true;setTimeout(()=>suppressCardClick=false,0);const z=document.querySelector<HTMLElement>('#sell-zone')!,r=z.getBoundingClientRect();if(e.button===0&&e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom&&querySell(state,d.id).ok){hud.cardMotion?.used(d.id,{x:r.x+r.width/2,y:r.y+r.height/2});send({type:'sellCard',cardId:d.id});}z.classList.remove('selling');z.textContent='变卖 · 拖入手牌';input.cancel();});
app.addEventListener('dragstart',e=>{if((e.target as HTMLElement).closest('[data-unit]')){e.preventDefault();return;}const t=(e.target as HTMLElement).closest<HTMLElement>('[data-bag-item]');if(t)(e as DragEvent).dataTransfer?.setData('text/plain',t.dataset.bagItem!);});
app.addEventListener('dragover',e=>{if((e.target as HTMLElement).closest('#quick-drop'))e.preventDefault();});
app.addEventListener('drop',e=>{if(!(e.target as HTMLElement).closest('#quick-drop'))return;e.preventDefault();const k=(e as DragEvent).dataTransfer?.getData('text/plain');if(k==='heal'||k==='weapon'||k==='light')send({type:'equipQuick',item:k});});
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
 if(ui&&!ui.matches('[data-unit],[data-clone]')){tacticWheel.cancel();return;}
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
 if(official&&['KeyQ','KeyH','KeyB','Tab','KeyC','KeyV'].includes(e.code)){e.preventDefault();return;}
 if(e.repeat)return;
 if(e.code==='KeyF'&&usesExplorationControl(state)){e.preventDefault();togglePathAim();return;}
 if(usesExplorationControl(state)&&e.code==='KeyZ'){e.preventDefault();if(paused||controlModal()){show('先完成或取消当前操作');return;}switchOriginal(realActor()?.id==='hunter'?state.explorationCompanionId??null:'hunter');return;}
 if(usesExplorationControl(state)&&(e.code==='KeyC'||/^[1-4]$/.test(e.key)))return;
 if(explorationExitPending||economicConfirm||saleDrag){if(e.key==='Escape')cancel(false);return;}
 if(e.code==='Tab'&&state.phase==='battle'&&!help&&!buildOpen){e.preventDefault();cancelPathAim();handDrawer?.toggle();return;}
 if(movementKeys.includes(e.code)){e.preventDefault();pressed.add(e.code);if(!directInputAllowed()){blocked.add(e.code);return;}prepareDirectAction(e.code);applyHeld();return;}
 if(e.key==='Escape'){const a=realActor();if(a&&isAlV2(state,a)&&a.alCombat?.special?.kind==='rocket'){send({type:'alInput',id:a.id,kind:'cancel'});return;}if(a&&isHunterV2(state,a)&&a.hunterCombat?.special?.kind==='prepare'){send({type:'hunterInput',id:a.id,kind:'cancel'});hunterActiveKey=null;return;}if(usesExplorationControl(state)&&!controlModal()&&state.explorationControl?.aim){send({type:'cancelExplorationAim'});return;}resumeCancel();return;}
 if(e.code==='Space'){e.preventDefault();releasePhysicalInputs();if(skillAim())cancelPathAim();command(state,{type:'clearBasicInputs'});clearHeld();if(state.phase==='battle'){if(!paused){pauseHunter(state);pauseAl(state);}paused=!paused;}return;}
 if(state.phase!=='battle'||paused||help||document.hidden||buildOpen)return;
 const xx=realActor();if(xx&&isXX(state,xx)&&['ShiftLeft','ShiftRight','KeyE','KeyR','KeyT'].includes(e.code)){e.preventDefault();show('xx 本模型尚未适配该动作');return;}
 const al=realActor();if(al&&isAlV2(state,al)&&!controlModal()&&!state.explorationControl?.aim){if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();send({type:'alInput',id:al.id,kind:'roll',aim:combatAim(al)!,direction:vector()});return;}if(e.code==='KeyE'){e.preventDefault();send({type:'alInput',id:al.id,kind:'rocket',aim:combatAim(al)!});return;}if(e.code==='KeyR'||e.code==='KeyT'){show('待新技能');return;}}
 const hunter=realActor();if(hunter&&isHunterV2(state,hunter)&&!controlModal()&&!state.explorationControl?.aim){
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();send({type:'hunterInput',id:hunter.id,kind:'dodge',aim:combatAim(hunter)!,direction:vector()});return;}
  if(e.code==='KeyE'){e.preventDefault();hunterActiveKey=hunter.id;send({type:'hunterInput',id:hunter.id,kind:'active',held:true,aim:combatAim(hunter)!});return;}
  if(e.code==='KeyR'||e.code==='KeyT'){show('空技能槽');return;}
 }
 if(/^[1-4]$/.test(e.key)){const u=state.units.filter(u=>isPartyBody(state,u))[Number(e.key)-1];if(u)select(u.id);return;}
 if(e.code==='KeyE'||isStandaloneExploration(state)&&['KeyR','KeyT'].includes(e.code)){if(!directInputAllowed())return;prepareDirectAction();const u=realActor();const slot=(e.code==='KeyR'?1:e.code==='KeyT'?2:0) as 0|1|2;if(u&&send(skillInSlot(u,slot)&&skillInput(skillInSlot(u,slot)!).direct==='aimConfirm'?{type:'beginSkillAim',id:u.id,slot,source:'direct'}:{type:'skill',id:u.id,slot})){if(SKILL_CATALOG[skillInSlot(u,slot)!]?.kind==='timed')clearHeld();input.direct();}return;}
 if(e.code==='KeyH'||e.code==='KeyB'){if(backpack||cardId||item||cloneSource||abilityAim)return;cancelPathAim();clearHeld();if(send({type:'party',kind:e.code==='KeyH'?'recall':'regroup'}))resumeCancel();return;}
 if(e.code==='KeyQ'){if(!backpack&&!cardId&&!item&&!cloneSource){cancelPathAim();recallAction();}return;}
 if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();useBlink();}
});
window.addEventListener('pointerup',e=>{if(e.button===0&&alBasicPointer){send({type:'alInput',id:alBasicPointer,kind:'basic',held:false});alBasicPointer=null;}if(e.button===2&&alShotPointer){send({type:'alInput',id:alShotPointer,kind:'shot',held:false});alShotPointer=null;}if(e.button===2&&hunterGuardPointer){send({type:'hunterInput',id:hunterGuardPointer,kind:'guard',held:false});hunterGuardPointer=null;}if(e.button===0&&hunterBasicPointer){send({type:'hunterInput',id:hunterBasicPointer,kind:'basic',held:false});hunterBasicPointer=null;}});
window.addEventListener('keyup',e=>{if(e.code==='KeyE'&&hunterActiveKey){send({type:'hunterInput',id:hunterActiveKey,kind:'active',held:false});hunterActiveKey=null;}if(e.code==='AltLeft'){if(!(e.target as HTMLElement).matches('input,textarea,select'))e.preventDefault();return;}if(movementKeys.includes(e.code)){pressed.delete(e.code);blocked.delete(e.code);applyHeld();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePhysicalInputs();command(state,{type:'clearBasicInputs'});if(document.hidden){cancelPathAim();if(saleDrag)cancel(false);}clearHeld();last=performance.now();});
window.addEventListener('error',e=>hud.error('运行错误：'+e.message));window.addEventListener('unhandledrejection',e=>hud.error('资源或运行错误：'+String(e.reason)));
function frame(now:number){
 app.classList.toggle("entry-open",official&&state.phase==='account');
 if(tacticWheel.session&&(!tacticWheel.valid(state)||paused||controlModal()||state.explorationControl?.aim))tacticWheel.cancel();
 const real=(now-last)/1000;last=now;fps=fps*.95+(1/Math.max(real,.001))*.05;
 if(saleDrag&&!state.cards.some(c=>c.id===saleDrag!.id)){saleDrag=null;const z=document.querySelector('#sell-zone');z?.classList.remove('selling');if(z)z.textContent='变卖 · 拖入手牌';}
 if(cardId&&!state.cards.some(c=>c.id===cardId)){cardId=null;input.cancel();}
 if(directId&&!state.units.some(u=>u.id===directId&&u.life==='active'))clearHeld();
 if(cloneSource&&!queryClone(state,cloneSource).ok){cloneSource=null;rosterDrag=null;input.cancel();show('召影条件已变化，已取消瞄准');}
 if(input.stage==='select'&&input.selectedId&&!state.units.some(u=>u.id===input.selectedId&&['active','downed'].includes(u.life)))input.cancel();
 const slow=!!saleDrag?.active||buildOpen||(!usesExplorationControl(state)&&input.slow)||backpack||!!cardId||!!cloneSource||!!abilityAim;advanceTacticalFocus(state,real,paused||help||document.hidden||explorationExitPending||!!economicConfirm);const timeScale=Math.min(slow?.1:baseSpeed,state.tacticalFocus?focusTimeScale(state):baseSpeed,tacticWheel.session?tacticWheel.scale:baseSpeed);effectiveTimeScale=paused||help||document.hidden||explorationExitPending||economicConfirm?0:timeScale;let dt=simulationDelta(real,paused||help||explorationExitPending||!!economicConfirm,document.hidden,timeScale);
 const namedReady=!namedEnemies||state.units.filter(u=>u.enemyVisualProfileId||u.basicProfileId==='hunter-v2'||u.basicProfileId==='al-basic-v1').every(u=>scene.unitVisuals.get(u.id)?.reference?.ready);if(!namedReady){dt=0;effectiveTimeScale=0;}
 effectiveTimeScale*=hunterTimeScale(state);
 if(state.phase==='battle'){if((slow||tacticWheel.session)&&!document.hidden)state.stats.slowTime+=Math.min(real,.1);if(paused&&!document.hidden)state.stats.pausedTime=(state.stats.pausedTime||0)+Math.min(real,.1);const before=state.time;step(state,dt,Math.min(real,.1));dt=state.time-before;}
 if(directId&&!state.units.find(u=>u.id===directId)?.direct)directId=null;
 if(!directId&&Math.hypot(vector().x,vector().y)>0){const u=realActor();if(u&&u.life==='active'&&!u.cloneOf&&u.stagger<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!locomotionLocked(u))applyHeld();}
 const u=aimActor(state)||state.units.find(u=>u.id===(skillPreviewId||displaySelection()));let path:Pos[]=[],range:Pos[]=[];const previewScene=previewState(state);
 if(u&&!abilityAim&&!u.direct&&!usesExplorationControl(state)){if(hover&&positionKnown(state,hover)&&!input.deploying&&!cloneSource&&u.life==='active'&&!u.cloneOf)path=pathTo(previewScene,u.pos,hover,u.bodyRadius);}
 if(u&&path.length)path=[{...u.pos},...path];
 const skillPreview=!!u&&(!!skillAim()||skillPreviewId===u.id);
 if(skillPreview){const id=skillAim()?.skill?.skillId||skillInSlot(u!,skillPreviewSlot);range=id?skillRangeTiles(state,u!,u!.facing,id):[];}
 const caption=document.querySelector<HTMLElement>('#range-caption')!;caption.hidden=!u||(official&&!skillPreview);caption.classList.toggle('skill-preview',skillPreview);caption.textContent=skillAim()?((querySkillAimPreview(state).description||'技能准备')+' · '+(querySkillAimPreview(state).ok?'左键确认 · 右键取消':querySkillAimPreview(state).reason)):skillPreview?'技能范围 · '+(SKILL_CATALOG[skillInSlot(u!,skillPreviewSlot)!]?.name||'空槽'):'普攻范围 · 圆形 / 阴影处不可命中';
 const aimed=pathActor(),preview=aimed&&hover?pathPreviewCache.query(state,aimed,hover):null;
 if(aimed){path=preview?.valid?[{...aimed.pos},...preview.path]:[];caption.hidden=false;caption.textContent='选路 · '+aimed.name+' · '+(preview?.valid?(bodyActionReady(aimed)?'左键确认 · 右键取消':'角色当前动作尚未结束'):preview?.reason||'指向可抵达的位置');}
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
    const t=surface(state,to);
    const legal=canStop(state,to,target)&&segmentClear(state,target.pos,to,false,true,target.bodyRadius);
    b.disabled=!legal;b.classList.toggle('aimed',d===aimed);
    if(d===aimed&&legal&&Math.hypot(dx,dy)>18)dashDirection=d;
   }
   path=dashDirection?[{...target.pos},{x:target.pos.x+offset[dashDirection].x,y:target.pos.y+offset[dashDirection].y}]:[];
  }
 }
 else{dashPanel.hidden=true;dashPanel.dataset.target='';}
 const previewUnit=u?(input.deploying&&hover?{...u,pos:hover}:u):undefined;
 const overlay:UIOverlay={debugAutonomy:debug,attackPreview:!official&&previewUnit&&!skillPreview?{center:previewUnit.pos,radius:previewUnit.weapons[previewUnit.weaponIndex].range,remote:previewUnit.weapons[previewUnit.weaponIndex].remote}:undefined,hoverValid:aimed?preview?.valid:hover&&previewUnit?(cloneSource?queryClone(state,cloneSource,hover).ok:input.deploying?canDeployAt(state,hover,previewUnit):canStop(previewScene,hover,previewUnit)):undefined,rangeKind:skillPreview?'skill':'attack',selectedId:displaySelection(),hover,path,range,deployTiles:source?cloneTiles(state,source.id):input.deploying?deployTiles(state):[],targeting:!!cardId||!!item};
 if(!usesExplorationControl(state)||state.units.some(a=>a.id===input.selectedId&&!!a.cloneOf))command(state,{type:'partySelection',id:input.selectedId});
 scene.update(state,overlay,dt,Math.min(real,.1));audio.update(state);hunterAudio.update(state,effectiveTimeScale);alAudio.update(state,effectiveTimeScale);enemyAudio.update(state,effectiveTimeScale);loot.update(state,p=>scene.project(p));
 if(now-lastHud>16){lastHud=now;const v:UIState={initialSetup,selectedId:displaySelection(),paused,speed:baseSpeed,slow,stage:input.stage,backpack,debug,cardId,item,notice:now<noticeUntil?notice:'',fps,assets:(scene as any).assetStatus||'场景已加载'};hud.render(state,v);for(const actor of state.units.filter(u=>isHunterV2(state,u)||isAlV2(state,u))){const portrait=(scene as any).unitVisuals.get(actor.id)?.reference?.portrait;for(const img of app.querySelectorAll<HTMLImageElement>(`[data-unit="${actor.id}"] img, [data-body="${actor.id}"] img`+(displaySelection()===actor.id?', .detail-portrait':''))){img.style.visibility=portrait?'visible':'hidden';const source=actor.basicProfileId!;if(portrait&&img.dataset.source!==source){img.src=portrait;img.dataset.source=source;}}}economyPanel.render(state);buildPanel?.render(state,buildOpen,buildUnit);}
 const startButton=document.querySelector<HTMLButtonElement>('[data-action="start"]');if(startButton){startButton.disabled=!assetsReady;startButton.textContent=assetsReady?'进入战斗 →':'正在准备角色…';}
 feedback.update(state,input,path,p=>scene.project(p),cardId,cursor,hover,retreatId,dashTarget);
 handDrawer?.update(state.phase==='battle',!!cardId||!!saleDrag);enemyAlerts.update(state,p=>scene.project(p));
 tacticWheel.render(state,p=>scene.project(p));
 namedPanel?.update(state,(p,alt)=>scene.project(p,alt),id=>{const a=scene.unitVisuals.get(id);return a?.loadFailed?'加载失败':a?.reference?.ready?'原模型 Ready':'加载中';});
 enemyPanel?.update(state,p=>scene.project(p));
 hud.updatePersonal(state,input.selectedId,abilityAim,slow,p=>scene.project(p));
 requestAnimationFrame(frame);
}
(window as any).prototype={get wheel(){return tacticWheel.session;},get wheelScale(){return tacticWheel.scale;},get effectiveTimeScale(){return effectiveTimeScale;},get audio(){return audio;},get pathAimTarget(){return pathActor()&&hover?{...hover}:null;},get state(){return state;},project:(p:Pos)=>scene.project(p),get interaction(){return input;},get scene(){return scene;}};
requestAnimationFrame(frame);
