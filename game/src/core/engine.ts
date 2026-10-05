import {chooseEnemyCombat,tickEnemyReaction,reactToEnemyHit,cancelEnemyReaction,braceActive} from './enemy-combat';
import {ENEMY_ABILITIES} from './enemy-abilities';
import {equippedSkills,equipProfileSlots,skillInSlot,hasEquippedSkill,foregroundSkill} from './skill-slots';
import {directionalHit} from './directionality';
import {IMPACT,atomicMotion,interruptOrdinaryMotion,startForcedMotion,advanceForcedMotion,impactFeedback} from './impact';
import {startIntent,canStartIntent,tickIntent,validIntent,intentTargets} from './attack-intent';
import {evade,activeAvoidanceWindow,tickEvasion} from './evasion';
import {isStandaloneExploration,isPartyBody,participates,queryCompanion} from './exploration-party';
import {standaloneDefinition} from './standalone-exploration';
import {advanceAutonomy,claimControl,completePlayerMove,initializeAnchor,clearAutonomy,TENDENCIES,activityRadius,recordAutonomyContribution} from './autonomy';
import {PRESSURE,SKILL_PRESSURE,resetPressure,applyPosture,tickPressure,recordHealthLoss,healHealth,reclaimHealth,pruneRecoveryBudgets,clampGray,locomotionLocked} from './pressure';
import {positionVisible,positionKnown,updateVision} from './visibility';
import {requestParty,advanceParty,followParty,setPartySelection} from './party';
import {ensureControlledBody,switchControlledBody} from './direct-control';
import {movementSpeed} from './movement-speed';
import {interactExploration,exitExploration,queryExplorationExit} from './exploration';
import {combatActivity,updatePartyCombat,attackCommit} from './exploration';
import {enterExploration} from './exploration';
import {initEconomy,bindBalance,exchange,commitCarry,settle,rewardKill,payVitality} from './economy';
import {makeCard,drawOne,eventCard,flushCards,sellCard} from './cards';
import {createWaveRuntime,enemyCount,spawnDue,advanceWave} from './waves';
import {queryClone,cloneCandidate,createClone,removeClone,clearClones,leaveExplorationNode} from './clones';
import {actionable,captureRecallProtection,clearMotion,resetPersonal,clearPersonalAction,blink,direct,advanceDirect,advanceRecall,requestRecall,requestRescue,protectLethalRecall,tickPersonalClocks} from './personal';
import {surface,cell,distance,near,terrainFits,occupiedAt,canDeployAt,canStop,segmentClear,inWeaponRange,unitAt,faceToward,radius,SPACE} from './spatial';
import {navigate} from './navigation';
import {updateEngagement,cleanEngagements,encounterParticipant} from './engagement';
import {createMapTiles,createWaves,MAP_WIDTH,MAP_HEIGHT,MAP_GOAL,MAP_SPAWNS,ALLY_START} from './map';
import {getWorkbenchSample} from './workbench-map';
import { DIRS, type GameState, type Command, type CommandResult, type Pos, type Unit, type Direction, type Weapon, type Card, type WaveDefinition, type BatchDefinition, type SpawnEntry } from './types';
import {COMBAT_CONFIG,weightProfile,damageAfterDefense,compatibleWeapon} from './combat-config';
import {resolveSkill} from './skill-catalog';
import {initializeSkills,initializeProfile,currentSkill,skillState,resetNodeSkills,buyUpgrade,configureSkill,configureSkillSlot,setUnlockPreset,resetExpeditionSkills,bindSkillMirrors} from './progression';
import {castSpecial,tickSpecial,tickEchoes,advanceReapLanding,sniper,scytheSweep,type HitOptions} from './skill-execution';
import {reapReturnPath} from './reap-path';
import {canConfigure,requestWeapon,tickLoadout,cancelLoadout,interruptSkill} from './loadout';
export {weightProfile} from './combat-config';
export const cloneCost=COMBAT_CONFIG.cloneCost;
const explicitHits=new WeakMap<GameState,Set<number>>();
const same = near;
const dist = distance;
const copy = (p: Pos) => ({ x: p.x, y: p.y });
const tile = surface;
const active = (u: Unit) => u.life === 'active';
const weapon = (u: Unit):Weapon => u.weapons[u.weaponIndex] || {name:'无武器',range:0,width:0,remote:false,damage:0,durability:0,maxDurability:0,shadow:true};
const warmup=(u:Unit)=>COMBAT_CONFIG.warmup[u.role as keyof typeof COMBAT_CONFIG.warmup]||0;
const initialCooldown=(u:Unit)=>COMBAT_CONFIG.initialSkillCharge&&['hunter','fiorre'].includes(u.role)?u.skillMax:0;
const hunter = (s: GameState) => s.units.find(u => u.id === 'hunter' && active(u));
const walkable = (s: GameState, p: Pos) => !!tile(s, p) && !tile(s, p)!.obstacle && !s.barricades.some(b => same(b, p));
const occupied = occupiedAt;
function note(s: GameState, msg: string) { s.notice = msg; s.log.unshift(msg); s.log = s.log.slice(0, 40); }
function rng(s: GameState) { s.seed = (s.seed * 1664525 + 1013904223) >>> 0; return s.seed / 4294967296; }
function makeUnit(id: string, name: string, role: Unit['role'], pos: Pos, team: Unit['team'] = 'ally'): Unit {
    const remote = ['hunter', 'ranger', 'ranged', 'guard'].includes(role);
    const w: Weapon = { name: role==='guard'?'淬毒飞刀':role==='fiorre'?'短杖':'巡夜长铳', range: role === 'ranger'?7:['hunter','guard'].includes(role)?5:role==='fiorre'?1:role==='ranged'?COMBAT_CONFIG.enemyRangedRange:COMBAT_CONFIG.enemyMeleeRange, width:0, remote:role!=='fiorre'&&remote, damage:COMBAT_CONFIG.allyAttack[role as keyof typeof COMBAT_CONFIG.allyAttack]||18, durability: 60, maxDurability: 60, shadow: false,postureDamage:team==='enemy'?(role==='heavy'?24:role==='ranged'?10:14):15,reclaimRate:PRESSURE.reclaimRate,reclaimBudget:PRESSURE.basicBudget };
    return { posture:role==='heavy'?150:role==='ranged'?60:90,maxPosture:role==='heavy'?150:role==='ranged'?60:90,stagger:0,postureDelay:0,postureRecent:0,grayHp:0,grayDelay:0,id, name, role, team, asset: role === 'hunter' ? 'Galore' : role === 'guard' ? 'Arina' : role === 'ranger' ? 'Cynthia' : 'Livia', color: team === 'enemy' ? '#b65559' : '#74b9c7', pos: copy(pos), drawPos: copy(pos), life: team === 'enemy' || role === 'hunter' ? 'active' : 'reserve', hp: COMBAT_CONFIG.allyHp[role as keyof typeof COMBAT_CONFIG.allyHp]||120, maxHp: COMBAT_CONFIG.allyHp[role as keyof typeof COMBAT_CONFIG.allyHp]||120, facing: team === 'ally' ? 'east' : 'west', defaultFacing: team === 'ally' ? 'east' : 'west', speed: team==='enemy'?COMBAT_CONFIG.enemyTowerSpeed:COMBAT_CONFIG.baseMoveSpeed, block: role === 'guard' ? 3 : 1, damage: w.damage, attackPeriod: role === 'guard' ? 1.4 : 1.1, attackTimer: 0, skillCd: 0, skillMax: 18, skillTime: 0, ready: 0, downTimer: 0, respawnTimer: 0, path: [], destination: null, transition: 0, moveProgress: 0, intent: null, rescueTarget: null, route: [], routeIndex: 0, statuses: [], weapons: [w, { ...w, name: '影武器', damage: Math.round(w.damage * .65), durability: 1, maxDurability: 1, shadow: true }], weaponIndex: 0, stress: 0, stressCd: 0, light: role === 'hunter' ? 4 : 2, hitFlash: 0, attackFlash: 0, reveal: 0 };
}
function configureCombat(u:Unit){
    const arcane=u.role==='fiorre',gun=['hunter','ranger','ranged'].includes(u.role);
    const cls=arcane?'focus':gun?'gun':'blade';
    u.compatibleClasses=[cls];u.capacity=u.role==='ranger'?7:10;
    u.defense={subtype:u.role==='guard'?'impact':u.role==='heavy'?'pierce':arcane?'flame':'slash',flat:u.role==='guard'||u.role==='heavy'?8:3};
    u.dodge=u.role==='ranger'?.12:u.role==='hunter'?.05:0;
    if(u.role==='ines'){u.hp=u.maxHp=800;u.block=3;u.attackPeriod=1.4;u.asset='Rina_F_Summer';u.defense={subtype:'impact',flat:8};u.compatibleClasses=['blade'];for(const w of u.weapons){w.profession='shieldguard';w.remote=false;w.range=1.2;w.damage=w.shadow?23:35;w.class='blade';w.subtype='impact';w.weight=w.shadow?1:4;w.name=w.shadow?'影·回响盾剑':'回响盾剑';}}
    if(u.role==='fiorre')u.asset='Charlotte';
    if(u.role==='ranger')for(const w of u.weapons)w.name=w.shadow?'影·长弓':'巡夜长弓';
    u.mental='steady';u.mentalTime=0;
    u.autoSkill=u.role==='guard';u.sniperMode=false;u.poisonMeter=0;
    for(const w of u.weapons){w.class=cls;w.damageKind=arcane?'arcane':'physical';w.subtype=u.role==='ines'?'impact':arcane?'shadow':gun||u.role==='guard'?'pierce':'slash';w.weight=w.shadow?1:gun?5:4;if(u.team==='ally')w.profession=u.role==='fiorre'?'healer':u.role==='ines'?'shieldguard':u.role as 'hunter'|'guard'|'ranger';}
}
function gainStress(s:GameState,u:Unit,event:'lowHealth'|'allyDown'){
    if(u.team!=='ally'||!active(u)||u.stressCd>0)return;
    const role=u.role as 'hunter'|'fiorre'|'guard'|'ranger';
    u.stress=Math.min(100,u.stress+(COMBAT_CONFIG.mental[event][role]||12));
    u.stressCd=COMBAT_CONFIG.mental.cooldown;
    note(s,u.name+(event==='allyDown'?'目睹同伴倒下':'在重伤中承受压力'));
}
export function resolveHit(s:GameState,target:Unit,w:Weapon,power:number,attacker?:Unit,options:HitOptions={}):boolean{
    if(!active(target)||!participates(s,target))return false;
    if(options.eventId!==undefined){let hits=explicitHits.get(s);if(!hits)explicitHits.set(s,hits=new Set());if(hits.has(options.eventId))return false;hits.add(options.eventId);}
    if(activeAvoidanceWindow(s,target)){s.stats.activeEvades=(s.stats.activeEvades||0)+1;return false;}
    const direction=directionalHit(s,target,options.hitOrigin??(!options.derived&&(!options.originKind||options.originKind==='direct')?attacker?.pos:undefined));
    combatActivity(s,attacker,target,options.at??s.time);
    const dodge=weightProfile(target).dodge;
    if(dodge>0&&rng(s)<dodge){s.stats.dodges=(s.stats.dodges||0)+1;return false}
    const eventId=options.eventId??s.nextId++;
    const pressure=options.postureDamage??w.postureDamage??(options.skillId?SKILL_PRESSURE[options.skillId]:0);
    const brace=direction.direction==='front'&&!direction.neutral&&braceActive(s,target)?.7:1;
    const atomic=atomicMotion(target),postureResult=applyPosture(target,pressure*direction.postureScale*brace),staggered=postureResult.breakReaction;
    if(target.posture<=0)cancelEnemyReaction(target);
    if(staggered&&isStandaloneExploration(s)){
      cancelEnemyReaction(target);interruptOrdinaryMotion(s,target);staggerAction(s,target);if(target.attackIntent)tickIntent(s,target,0);impactFeedback(s,target,'break');
      if(!atomic&&!options.derived&&attacker){const impact=options.impact??(options.kind==='basic'?{distance:IMPACT.basic[attacker.role]}:undefined);if(impact)startForcedMotion(s,target,impact,attacker);}
    }
    if(attacker)recordAutonomyContribution(attacker,target);
    (s.combatEvents??=[]).push({id:eventId,castId:options.castId,sourceId:attacker?.id||'environment',targetId:target.id,skillId:options.skillId,enemyAbilityId:options.enemyAbilityId,derived:!!options.derived,kind:options.kind||'hit',at:options.at??s.time,power,...(isStandaloneExploration(s)?{direction:direction.direction,weakpointId:direction.weakpointId,hitOrigin:direction.origin,targetHeading:direction.heading,directionNeutral:direction.neutral}:{})});if(s.combatEvents.length>1024)s.combatEvents.splice(0,s.combatEvents.length-1024);
    if(attacker?.team==='enemy'&&target.team==='ally'&&!options.derived&&hasEquippedSkill(target,'pain'))skillState(target,'pain').counter=Math.min(8,skillState(target,'pain').counter+1);
    let damage=damageAfterDefense(w,target,power,options.ignore||0)*direction.healthScale*brace;
    const wards=target.statuses.filter(st=>st.kind==='warding'&&st.remaining>0).sort((a,b)=>b.power-a.power);
    if(wards[0]&&attacker?.team==='enemy'&&!options.derived){const ward=wards[0];damage-=Math.min(damage*ward.power,target.maxHp*(ward.power>=.35?.08:.05));target.statuses=target.statuses.filter(st=>st!==ward);}
    const lost=hurt(s,target,damage);
    if(isStandaloneExploration(s)){
      if(attacker?.team==='ally'&&target.team==='enemy'&&!direction.neutral){const key=direction.direction+'Hits';s.stats[key]=(s.stats[key]||0)+1;}
      if(direction.weakpointId){
        const id=s.nextId++;(s.weakpointEvents??=[]).push({id,at:options.at??s.time,targetId:target.id,sourceId:attacker?.id||'environment',weakpointId:direction.weakpointId,direction:direction.direction});if(s.weakpointEvents.length>1024)s.weakpointEvents.shift();
        if(attacker?.team==='ally'&&target.team==='enemy'){s.stats.weakpointHits=(s.stats.weakpointHits||0)+1;s.stats.weakpointDamage=(s.stats.weakpointDamage||0)+lost;}
        s.effects.push({id:s.nextId++,from:{...target.pos},to:{...target.pos},targetId:target.id,kind:'weakpoint',color:'#ffe39b',remaining:.65});
      }
    }
    if(staggered&&active(target)&&!isStandaloneExploration(s))staggerAction(s,target);
    if(!active(target)){target.forcedMotion=undefined;target.wallPin=undefined;cancelEnemyReaction(target);}
    else reactToEnemyHit(s,target,attacker,(lost>0||postureResult.applied>0)&&!options.derived&&(!options.originKind||options.originKind==='direct'),direction.direction==='front'&&!direction.neutral);
    if(attacker&&target.team!==attacker.team)reclaimHealth(s,attacker,lost,options.castId??eventId,options.reclaimBudget??w.reclaimBudget??(options.skillId?PRESSURE.skillBudget:PRESSURE.basicBudget),options.reclaimRate??w.reclaimRate??PRESSURE.reclaimRate);
    if(attacker){(s.encounters??=[]).push({sourceId:attacker.id,targetId:target.id,party:encounterParticipant(s,attacker)||encounterParticipant(s,target)});if(s.encounters.length>64)s.encounters.shift();}
    if(target.life==='dead'&&attacker?.team==='ally'&&attacker.role==='hunter'){
        s.stats.hunterKills=(s.stats.hunterKills||0)+1;
        if(s.stats.hunterKills%COMBAT_CONFIG.exclusive.hunterKills===0)eventCard(s,'exclusive:'+attacker.id,'power','exclusive',attacker.id);
    }
    return true;
}
function staggerAction(s:GameState,u:Unit):void{
 u.attackPending=undefined;cancelLoadout(u);
 const channel=!!(u.recall||u.partyTask||u.rescueTarget);u.recall=undefined;u.partyTask=undefined;u.rescueTarget=null;u.following=false;
 if(channel){u.path=[];u.destination=null;u.intent=null;u.afterCross=undefined;}
 if(u.team==='ally'){
  const id=foregroundSkill(u)||resolveSkill(u).id;
  for(const e of s.skillEffects||[])if(e.sourceId===u.id&&e.kind==='seat')e.detached=true;
  if(!['rain','dance','snipe','poison','hunt','sanctuary'].includes(id))interruptSkill(u);
  if(!u.crossing&&!u.cloneOf&&!canStop(s,u.pos,u))u.skillLanding??={origin:copy(u.pos)};
 }
}
const card=makeCard;
export function createGame(mode = 'standard'): GameState {
    const tiles = createMapTiles();
    const waves=createWaves();
    const s: GameState = { waveState:createWaveRuntime(waves),attempt:0,economy:{} as GameState['economy'],mode, phase: 'account', result: null, tiles, width: MAP_WIDTH, height: MAP_HEIGHT, units: [makeUnit('hunter', '猎人', 'hunter', ALLY_START), makeUnit('fiorre', '菲奥蕾', 'fiorre', { x: 5, y: 3 }), makeUnit('ines', '伊内丝', 'ines', { x: 5, y: 4 }), makeUnit('ranger', '阿尔', 'ranger', { x: 5, y: 5 })], time: 0, crystalHp: COMBAT_CONFIG.crystalHp, crystalMax: COMBAT_CONFIG.crystalHp, goal: copy(MAP_GOAL), gate: copy(MAP_GOAL), spawns: MAP_SPAWNS.map(copy), kills: 0, totalEnemies: enemyCount(waves), spawned: 0, spawnTimer: 18, wave: 0, waves, cards: [], fragments: 0, autoDraw: false, inventory: { heal: 3, weapon: 2, light: 2 }, quickSlots: ['heal', 'weapon', 'light'], barricades: [], lights: [], effects: [], stats: { moves: 0, reroutes: 0, manualTurns: 0, autoTurns: 0, rescues: 0, invalid: 0, cancels: 0, slowTime: 0 }, log: [], notice: '部署伙伴，守住长夜中的水晶。', node: 1, completed: [], retries: 2, canStay: true, seed: 2739, nextId: 1 };
    initEconomy(s);
    for(const u of s.units){u.ready=warmup(u);u.skillCd=initialCooldown(u);configureCombat(u);resetPersonal(u)}
    initializeProfile(s);for(const u of s.units){initializeSkills(u);if(u.role==='fiorre'){u.weaponIndex=4;u.skillId='dance';}resetNodeSkills(u);}
    if(mode==='workbench')applyScenarioMap(s,1);
    return s;
}
function applyScenarioMap(s:GameState,node:number){
 const sample=s.mode==='workbench'&&node===1?getWorkbenchSample():null;
 s.tiles=sample?sample.tiles.map(t=>({...t})):createMapTiles();
 s.width=sample?.width??MAP_WIDTH;s.height=sample?.height??MAP_HEIGHT;
 s.goal=copy(sample?.goal??MAP_GOAL);s.gate=copy(s.goal);
 s.spawns=(sample?.spawns??MAP_SPAWNS).map(copy);
 s.waves=sample?sample.waves:createWaves(node);
 s.waveState=createWaveRuntime(s.waves);s.totalEnemies=enemyCount(s.waves);
 const start=sample?.start??ALLY_START;
 for(const u of s.units.filter(u=>u.team==='ally'&&!u.cloneOf)){
  u.pos=copy(start);u.drawPos=copy(start);u.path=[];u.destination=null;
 }
}
/** Retained off-roster guard definition; no fifth default slot is created. */
export function createLegacyGuard(pos:Pos={x:5,y:4}):Unit{
 const u=makeUnit('guard','守卫','guard',pos);configureCombat(u);resetPersonal(u);initializeSkills(u);resetNodeSkills(u);u.ready=warmup(u);return u;
}
export function pathTo(s:GameState,from:Pos,to:Pos,r=SPACE.radius):Pos[]{return navigate(s,from,to,false,true,r)}
export function enemyPathTo(s:GameState,from:Pos,to:Pos,r=SPACE.radius):Pos[]{return navigate(s,from,to,true,false,r)}
export {canDeployAt,canStop};
export function deployTiles(s:GameState):Pos[]{return s.tiles.filter(t=>canDeployAt(s,t)).map(copy)}
export function cloneTiles(s:GameState,id:string):Pos[]{if(!queryClone(s,id).ok)return [];const candidate=cloneCandidate(s.units.find(u=>u.id===id)!);return s.tiles.filter(t=>canDeployAt(s,t,candidate)).map(copy)}
export function visible(s: GameState, u: Unit): boolean { if(s.exploration)return u.team==='ally'||positionVisible(s,u.pos);return s.mode !== 'dark' && s.node !== 3 || u.team === 'ally' || s.units.some(a => a.team === 'ally' && active(a) && dist(a.pos, u.pos) <= a.light) || s.lights.some(l => dist(l.pos, u.pos) <= l.radius); }
function geometry(s:GameState,u:Unit,p:Pos,d:Direction){
    if(!compatibleWeapon(u,u.weapons[u.weaponIndex]))return false;
    return templateGeometry(s,u,p,d,weapon(u));
}
function templateGeometry(s:GameState,u:Unit,p:Pos,_d:Direction,w:Pick<Weapon,'range'|'width'|'remote'>){return inWeaponRange(s,u,p,w)}
export function rangeTiles(s: GameState, u: Unit, d: Direction = u.facing): Pos[] { return s.tiles.filter(t => geometry(s, u, t, d) && (u.team === 'enemy' || visible(s, { ...u, team: 'enemy', pos: t, reveal: 0 }) || !s.exploration&&s.units.some(e => same(e.pos, t) && (s.reveals?.[e.id + ':' + u.id] || 0) > s.time))).map(copy); }
export function canHit(s: GameState, u: Unit, target: Unit, d: Direction = u.facing) { return participates(s,u)&&participates(s,target)&&!u.crossing && active(target) && u.team !== target.team && !(u.team==='enemy'&&s.ruleset==='exploration'&&target.cloneOf) && (u.team === 'enemy' || visible(s, target) || (!s.exploration&&(s.reveals?.[target.id + ':' + u.id] || 0) > s.time)) && (u.team==='enemy'&&isStandaloneExploration(s)?canStartIntent(s,u,target):geometry(s, u, target.pos, d)); }
export function skillRangeTiles(s:GameState,u:Unit,d:Direction=u.facing,id:import('./types').SkillId=u.skillId!):Pos[]{
    const state=skillState(u,id);const spec=resolveSkill(u,state.time>0?state.snapshot:undefined,id);
    if(spec.id==='poison'){
        const poisoned=s.units.filter(t=>t.team==='enemy'&&active(t)&&(t.poisonMeter||0)>0&&visible(s,t));
        if(poisoned.length)return s.tiles.filter(t=>!t.obstacle&&poisoned.some(center=>Math.hypot(t.x-center.pos.x,t.y-center.pos.y)<=spec.poisonRadius)).map(copy);
        return rangeTiles(s,u,d);
    }
    if(['prayer','ward','pain'].includes(spec.id))return s.tiles.filter(t=>!t.obstacle&&Math.hypot(t.x-u.pos.x,t.y-u.pos.y)<=spec.range).map(copy);
    return s.tiles.filter(t=>templateGeometry(s,u,t,d,{range:spec.range,width:spec.width,remote:true})&&(u.team==='enemy'||visible(s,{...u,team:'enemy',pos:t,reveal:0})||!s.exploration&&s.units.some(e=>same(e.pos,t)&&(s.reveals?.[e.id+':'+u.id]||0)>s.time))).map(copy);
}
function move(s:GameState,u:Unit,to:Pos,_facing?:Direction):CommandResult{
 if(locomotionLocked(u))return {ok:false,reason:'架势崩溃，暂时无法移动'};
 if(!positionKnown(s,to))return {ok:false,reason:'未知区域请直接移动探索'};
 if(!actionable(u)||u.cloneOf||!canStop(s,to,u))return {ok:false,reason:'落点受地形、单位或预留位置阻挡'};
 if(u.crossing){clearPersonalAction(u);u.afterCross=copy(to);u.destination=copy(to);return {ok:true};}
 if((u.skillStates?.reap?.run||u.skillLanding)&&!canStop(s,u.pos,u)){
  const landing=reapReturnPath(s,u,u.pos,u.pos);if(!landing?.length)return {ok:false,reason:'暂时无法脱离重合，请调整后重试'};
  const legal=landing.at(-1)!;if(!pathTo(s,legal,to,radius(u)).length&&!same(legal,to))return {ok:false,reason:'路径受阻，无法抵达'};
  clearPersonalAction(u);cancelLoadout(u);interruptSkill(u);u.skillLanding={origin:copy(u.pos),after:copy(to),path:landing};u.path=[];u.destination=null;u.intent=null;s.stats.moves++;return {ok:true};
 }
 const path=pathTo(s,u.pos,to,radius(u));if(!path.length&&!same(u.pos,to))return {ok:false,reason:'路径受阻，无法抵达'};
 clearPersonalAction(u);cancelLoadout(u);
 if(u.path.length)s.stats.reroutes++;u.path=path;u.destination=copy(to);u.intent='move';u.moveProgress=0;u.moveFrom=undefined;u.attackPending=undefined;u.drawPos=copy(u.pos);
 interruptSkill(u,'movement');s.stats.moves++;return {ok:true};
}
function awayFromCrystal(s:GameState,u:Unit):Direction{
    const dx=u.pos.x-s.goal.x,dy=u.pos.y-s.goal.y;
    return Math.abs(dx)>=Math.abs(dy)?(dx>=0?'east':'west'):(dy>=0?'south':'north');
}
function finish(s: GameState, victory: boolean,reason:GameState['endReason']=victory?'victory':'crystal') {if(s.endedAttempt===s.attempt)return;s.endedAttempt=s.attempt;s.endReason=reason;clearClones(s,'battle');s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[]; s.result = victory ? 'victory' : 'defeat'; s.phase = 'result';for(const e of s.units){e.engagement=undefined;e.pursuitTargetId=undefined;e.enemyMotion=undefined;}s.units=s.units.filter(u=>!u.cloneOf); for (const u of s.units.filter(u => u.team === 'ally')) {clearAutonomy(u);
    if (u.life === 'downed' && u.downTimer > 0) {
        u.life = 'rescued';
        (s.rescueRestrictions??={})[u.id]=s.node;
        u.hp = 1;
    }
    resetPressure(u);clearPersonalAction(u);u.path = [];
    u.destination = null;
    u.intent = null;
    u.statuses = [];
    interruptSkill(u);cancelLoadout(u);
    u.attackPending=undefined;u.moveFrom=undefined;u.crossing=undefined;u.afterCross=undefined;u.transition=0;
} if (victory) {
    if (!s.completed.includes(s.node))
        s.completed.push(s.node);
    note(s, '节点净化完成。未超时的濒死角色已自动救回。');
}
else {
    if (s.retries > 0)
        s.retries--;
    else
        s.canStay = false;
    note(s, (reason==='abandon'?'已放弃本场':'水晶失守')+(s.canStay ? '，退出节点。损耗保留，可重新进入。' : '，已无重置机会，本次远征结束。'));
} if(!victory&&!s.canStay)settle(s,'failure');if(victory&&s.node===3){settle(s,'success');resetExpeditionSkills(s);} s.economy.pending=s.economy.pending.filter(c=>c.group!=='scene');s.cards = s.cards.filter(c => c.group !== 'scene'); s.effects = s.effects.filter(e=>e.kind==='loot'); s.lights = [];s.reveals={}; }
function enter(s: GameState, node: number) {s.selectedBodyId=null;s.exploration=undefined;s.ruleset='tower';s.tiles=createMapTiles();s.width=MAP_WIDTH;s.height=MAP_HEIGHT;s.goal=copy(MAP_GOAL);s.gate=copy(MAP_GOAL);s.spawns=MAP_SPAWNS.map(copy);s.deploymentCells=undefined;clearClones(s,'node');explicitHits.delete(s);s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[]; s.attempt++;s.endedAttempt=undefined;s.endReason=undefined;s.node = node;s.context='tower'; s.phase = 'briefing'; s.result = null; s.crystalHp = s.crystalMax; s.units = s.units.filter(u => u.team === 'ally'&&!u.cloneOf);s.encounters=[];s.reveals={}; for (const u of s.units) {
    clearAutonomy(u);resetNodeSkills(u);cancelLoadout(u);clearPersonalAction(u);
    if (u.life === 'dead')
        continue;
    if(s.rescueRestrictions?.[u.id]!==undefined&&s.rescueRestrictions[u.id]!==node){delete s.rescueRestrictions[u.id];u.hp=1;}
    if(u.life==='rescued')u.hp=1;resetPersonal(u);
    u.life = s.rescueRestrictions?.[u.id]===node?'rescued':u.role === 'hunter' ? 'active' : 'reserve';
    u.pos = copy(ALLY_START);
    u.drawPos = copy(u.pos);
    u.path = [];
    u.destination = null;
    u.intent = null;
    u.ready = warmup(u);
    u.attackTimer = 0;
    u.skillTime = 0;
    u.poisonMeter=0;
    u.attackPending=undefined;u.moveFrom=undefined;u.crossing=undefined;u.afterCross=undefined;u.transition=0;u.moveProgress=0;u.turnCd=0;
    if (u.hp <= 0)
        u.hp = 1;
} s.kills = 0; s.spawned = 0;s.waves=createWaves(node);s.waveState=createWaveRuntime(s.waves);s.totalEnemies=enemyCount(s.waves);s.spawnTimer=18;s.time = 0; s.barricades = [];s.barrierHp={};s.wave=0;s.effects=[]; s.lights = []; s.economy.draws=0;applyScenarioMap(s,node);eventCard(s,'scene:node:'+node,'dash','scene'); note(s, '进入节点 ' + node + '：水晶满血，远征损耗保留；技能从空条重新充能。'); }
export function command(s:GameState,c:Command):CommandResult{
 const actor='id' in c?s.units.find(a=>a.id===c.id&&a.team==='ally'):undefined;const autoPath=actor&&(actor.ai?.moving||actor.following)?actor.path:undefined;
 const dash=c.type==='card'&&s.cards.some(a=>a.id===c.cardId&&a.kind==='dash');const dashTarget=dash&&c.type==='card'?(c.targetId?s.units.find(a=>a.id===c.targetId):unitAt(s,c.to)):undefined;
 const pendingBefore=actor?.attackPending;const result=applyCommand(s,c);ensureControlledBody(s);if(!result.ok)return result;
 if(pendingBefore&&!actor?.attackPending&&['move','direct','blink'].includes(c.type))s.stats.windupsCancelledByMove=(s.stats.windupsCancelledByMove||0)+1;
 const u=actor;
 if(u&&autoPath===u.path&&c.type==='skill'&&!u.crossing){u.path=[];u.destination=null;u.intent=null;u.following=false;}
 if(dash){const target=dashTarget;if(target&&!target.cloneOf){claimControl(s,target,'action');initializeAnchor(s,target);}}
 if(u&&!u.cloneOf){
  if(c.type==='deploy')initializeAnchor(s,u);
  if(c.type==='move'||c.type==='direct'||['skill','blink','evade','weapon','switchWeapon','extract','collect'].includes(c.type)){
   claimControl(s,u,c.type==='move'?'move':c.type==='direct'?'direct':'action');
   if(c.type==='move')completePlayerMove(s,u);
   if(c.type==='skill'&&u.id==='hunter'&&!['prayer','ward','pain','sanctuary','poison','snipe','dance'].includes(resolveSkill(u).id))attackCommit(s,u);
   if(c.type==='blink'&&(!s.exploration||s.context==='explorationBattle'))initializeAnchor(s,u);
  }
 }
 if(c.type==='rescue'||c.type==='collect'&&u?.life==='downed'){const h=s.units.find(a=>a.id==='hunter');if(h)claimControl(s,h,'action');}
 return result;
}
function applyCommand(s: GameState, c: Command): CommandResult {
    const fail = (reason: string) => { s.stats.invalid++; note(s, reason); return { ok: false, reason }; };
    const ok = (msg?: string) => { if (msg)
        note(s, msg); return { ok: true }; };
    if(c.type==='selectScenario'){
      if(s.phase!=='briefing'||s.time!==0||s.wave!==0)return fail('仅战前准备可选择验证地图');
      s.mode=c.mode;applyScenarioMap(s,s.node);return ok(c.mode==='workbench'?'已载入地图工坊：遗迹双路验证':'已切换原有场景');
    }
    if(c.type==='configureTendency'){const u=s.units.find(a=>a.id===c.id&&a.team==='ally'&&!a.cloneOf);if(!u||!canConfigure(s)||!Object.hasOwn(TENDENCIES,c.tendency))return fail('仅整备阶段可配置本体行为倾向');u.aiTendency=c.tendency;return ok('首要倾向：'+TENDENCIES[c.tendency]);}
    if(c.type==='controlBody')return switchControlledBody(s,c.id);
    if(c.type==='partySelection'){if(c.id!==null&&!s.units.some(u=>u.id===c.id&&u.team==='ally'&&participates(s,u)))return fail('角色未在本次队伍中');setPartySelection(s,c.id);return ok();}
    if(c.type==='party'){const r=requestParty(s,c.kind);return r.ok?ok():fail(r.reason!);}
    if(c.type==='interactExploration'){const r=interactExploration(s,c.id);return r.ok?ok():fail(r.reason!);}
    if(c.type==='exitExploration'){const r=exitExploration(s,c.abandonIds,u=>{if(u.role==='hunter'){u.life='respawning';u.respawnTimer=16;}else if(u.role==='fiorre'){u.life='rescued';(s.rescueRestrictions??={})[u.id]=s.node;}else u.life='dead';u.hp=0;u.downTimer=0;});return r.ok?ok():fail(r.reason!);}
    if(c.type==='exchange')return exchange(s,c.from,c.amount);
    if(c.type==='selectExplorationCompanion'){if(s.phase!=='account'||s.economy.active||s.journey!=='exploration')return fail('仅暗牢出发前可选择伙伴');const q=queryCompanion(s,c.id);if(!q.ok)return q;s.explorationCompanionId=c.id;return ok();}
    if(c.type==='selectJourney'){if(s.phase!=='account'||s.economy.active)return fail('仅能在出发前选择模式');if(!['tower','exploration'].includes(c.journey)||c.seed!==undefined&&(!Number.isSafeInteger(c.seed)||c.seed<0))return fail('模式或种子无效');s.journey=c.journey;for(const u of s.units)if(u.team==='ally'){if(c.journey==='exploration')equipProfileSlots(s,u);else u.skillSlots=undefined;}s.explorationSeed=c.seed??18;return ok();}
    if(c.type==='carry'){if(s.journey==='exploration'){const q=queryCompanion(s);if(!q.ok)return q;}const r=commitCarry(s,c.gold,c.vitality);if(r.ok){if(s.journey==='exploration')enterExploration(s,(id,name,role,pos,team)=>{const u=makeUnit(id,name,role,pos,team);configureCombat(u);return u;},standaloneDefinition(s.explorationSeed??18));else enter(s,1);}return r;}
    if(c.type==='draw')return drawOne(s,c.expectedPrice);
    if(c.type==='sellCard')return sellCard(s,c.cardId);
    if(c.type==='autoDraw')return fail('自动抽牌已停用');
    if(c.type==='abandonBattle'){
        if(!s.economy.active||s.ruleset==='exploration'||!['briefing','battle'].includes(s.phase)||s.endedAttempt===s.attempt)return fail('当前没有可放弃的塔防战斗');
        finish(s,false,'abandon');return {ok:true};
    }
    if(c.type==='safeExit'){if(s.phase!=='nodes'||!s.completed.includes(1))return fail('需节点1通关后在测试撤离节点离开');const r=settle(s,'success');if(!r.ok)return r;clearClones(s,'expedition');resetExpeditionSkills(s);s.phase='ended';s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.lights=[];return ok('安全离开：剩余资源按原类型入库');}
    if(c.type==='abandon'){const r=settle(s,'failure');if(!r.ok)return r;clearClones(s,'expedition');for(const u of s.units){clearPersonalAction(u);clearMotion(u);cancelLoadout(u);interruptSkill(u);}resetExpeditionSkills(s);s.phase='ended';s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.lights=[];return ok('已放弃：全部随身资源损失');}
    if(c.type==='enterExplorationNode'){if(s.exploration)return fail('正式探索请从副本地图进入');if(s.ruleset!=='exploration'||!s.economy.active)return fail('仅探索验证节点');s.economy.nodeOpen=true;s.economy.visit++;s.economy.draws=0;return ok();}
    if (c.type === 'start') {
        if (s.phase !== 'briefing')
            return fail('当前不能开始');
        s.phase = 'battle';
        return ok('战斗开始。敌群即将抵达。');
    }
    if (c.type === 'continue') {
        if (s.phase !== 'result')
            return fail('战斗尚未结束');
        s.phase = s.economy.active&&s.canStay ? 'nodes' : 'ended';
        if(s.phase==='ended')resetExpeditionSkills(s);
        return ok();
    }
    if (c.type === 'enter') {
        if (s.phase !== 'nodes' || !s.canStay || ![1, 3, 4].includes(c.node) || c.node === 4 && !s.completed.includes(1) || c.node === 3 && !s.completed.includes(2))
            return fail('该节点尚未开放');
        if(c.node===4)enterExploration(s,(id,name,role,pos,team)=>{const u=makeUnit(id,name,role,pos,team);configureCombat(u);return u;});else enter(s, c.node);
        return ok();
    }
    if (c.type === 'rest') {
        if (s.phase !== 'nodes' || !s.completed.includes(1) || s.completed.includes(2))
            return fail('休息节点尚不可用');
        for (const u of s.units) {
            if (u.team === 'ally' && u.life !== 'dead') {
                healHealth(u,Math.round(u.maxHp*.5));
                u.stress = Math.max(0, u.stress - 40);
                u.skillCd = 0;
            }
        }
        const f=s.units.find(u=>u.id==='fiorre'&&!u.cloneOf);if(f&&f.life==='rescued'){f.life='reserve';f.shadowResident=false;f.hp=Math.max(1,f.hp);if(s.rescueRestrictions)delete s.rescueRestrictions[f.id];}
        s.completed.push(2);
        s.node = 2;
        return ok('休息完成：恢复半数最大生命，精神压力下降。');
    }
    if (c.type === 'equipQuick') {
        s.quickSlots = [...s.quickSlots.filter(v => v !== c.item), c.item].slice(-3);
        return ok();
    }
    if(c.type==='unlockPreset'){setUnlockPreset(s,c.preset);return ok('开发验证：解锁上限已切换');}
    if(c.type==='setContext'){s.context=c.context;return ok('开发验证：配置权限上下文已切换');}
    if(c.type==='leaveExplorationNode'){if(s.exploration)return fail('正式探索请通过出口离开');if(s.ruleset!=='exploration')return fail('当前不是探索节点');leaveExplorationNode(s);s.economy.nodeOpen=false;s.economy.pending=s.economy.pending.filter(c=>c.group!=='scene');s.cards=s.cards.filter(c=>c.group!=='scene');return ok('开发验证：探索节点影体和效果已清理');}
    if(c.type==='newExpedition'){if(s.economy.active)return fail('先确认放弃或安全结算当前副本');clearClones(s,'expedition');
        const originals=s.units.filter(u=>u.team==='ally'&&!u.cloneOf),profile=s.profile,economy=s.economy,fresh=createGame(s.mode);
        Object.assign(s,fresh);s.explorationCompanionId=undefined;s.exploration=undefined;s.explorationMemories=undefined;s.rescueRestrictions=undefined;s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.lights=[];s.units=originals;s.profile=profile;s.economy=economy;bindBalance(s);s.ruleset='tower';s.reveals={};s.deploymentCells=undefined;resetExpeditionSkills(s);s.phase='account';return ok('新副本：培养已清空，默认偏好、解锁上限及长期损耗保留');
    }
    if(c.type==='endExpedition'){if(s.economy.active)settle(s,'failure');clearClones(s,'expedition');for(const u of s.units){clearPersonalAction(u);clearMotion(u);cancelLoadout(u);interruptSkill(u);}resetExpeditionSkills(s);s.phase='ended';s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.lights=[];return ok('开发验证：副本培养已清空；长期损耗与解锁保留');}
    if(c.type==='configureSkillSlot'||c.type==='configureSkill'||c.type==='upgradeSkill'){
        const u=s.units.find(a=>a.id===c.id&&a.team==='ally');if(!u)return fail('角色不存在');
        const r=c.type==='configureSkillSlot'?configureSkillSlot(s,u,c.slot,c.skillId):c.type==='configureSkill'?configureSkill(s,u,c.skillId):buyUpgrade(s,u,c.kind,c.branch,c.expectedLevel,c.skillId);
        return r.ok?ok(c.type==='configureSkill'?'默认技能已配置':'技能培养已完成'):fail(r.reason!);
    }
    if (s.phase !== 'battle' && s.phase !== 'briefing'&&c.type!=='weapon'&&c.type!=='switchWeapon')
        return fail('当前不在战场');
    if (c.type === 'card' || c.type === 'item') {
        if(!positionKnown(s,c.to))return fail('未知区域不能精确使用卡牌或道具');
        const selected = c.type === 'card' ? s.cards.find(a => a.id === c.cardId) : null;
        if (c.type === 'card' && !selected)
            return fail('卡牌已不存在');
        if (!tile(s, c.to))
            return fail('请选择有效格');
        const h = hunter(s);
        if (c.type === 'item' && (!h || dist(h.pos, c.to) > 3 || s.inventory[c.item] <= 0))
            return fail('道具需在猎人周围 3 格使用且库存充足');
        const kind = c.type === 'item' ? c.item : selected!.kind;
        const target = s.units.find(u => u.id === c.targetId) || unitAt(s,c.to);
        if(c.type==='card'&&target&&target.statuses.some(st=>st.source==='card:'+kind&&st.remaining>0))return fail('同一卡牌效果仍在持续，不能叠加；卡牌未消耗');
        if(c.type==='item'&&target&&(!h||dist(h.pos,target.pos)>3))return fail('目标超出猎人道具范围');
        if (kind === 'barricade') {
            c.to=cell(c.to);
            if (!walkable(s, c.to) || s.units.some(u => ['active','downed'].includes(u.life) && dist(u.pos,c.to)<.9) || same(c.to, s.goal) || s.spawns.some(p => same(p, c.to)))
                return fail('此处无法放置路障');
            s.barricades.push(copy(c.to));
            if (s.exploration? [s.exploration.definition.exit,...s.exploration.definition.points.map(p=>p.pos)].some(p=>!same(p,s.exploration!.definition.entry)&&!navigate(s,s.exploration!.definition.entry,p,false,false).length):[...s.spawns, ...s.units.filter(u => u.team === 'enemy' && active(u)).map(u => u.pos)].some(p => !same(p, s.goal) && !enemyPathTo(s, p, s.goal).length)) {
                s.barricades.pop();
                return fail('路障不能封死敌人通路');
            }
            (s.barrierHp??={})[c.to.x+','+c.to.y]=COMBAT_CONFIG.barrierHp;
        }
        else if (kind === 'light') {
            s.lights.push({ pos: copy(c.to), radius: 4, remaining: 35 });
        }
        else {
            if (!target || target.team !== 'ally' || !active(target))
                return fail('需要一个在场友方目标');
            if(c.type==='card'&&target.cloneOf&&selected!.ownerId&&selected!.ownerId!==target.id)return fail('该卡牌属于另一名复制体');
            if (kind === 'heal') {
                if (target.hp >= target.maxHp)
                    return fail('目标生命已满');
                healHealth(target,45);
            }
            else if (kind === 'weapon') {
                if(!compatibleWeapon(target,target.weapons[0]))return fail('角色职业不兼容该武器');
                target.weapons[0].durability = target.weapons[0].maxDurability;
                // Repair restores equipment, never bypasses a profession change channel.
            }
            else if (kind === 'cooldown')
                target.skillCd = 0;
            else if (kind === 'power')
                target.statuses.push({ kind: 'attack', remaining: 10,duration:10,source:'card:power',name:'锋芒', power: .5 });
            else if (kind === 'dash') {
                if(target.evasion?.action)return fail('闪避动作中');
                if(target.cloneOf)return fail('复制体不可使用位移卡');
                const d=c.type==='card'?c.direction:undefined;
                if(!d)return fail('请选择疾行方向');
                const to={x:target.pos.x+(d==='east'?1:d==='west'?-1:0),y:target.pos.y+(d==='south'?1:d==='north'?-1:0)};
                if(target.crossing||!canStop(s,to,target)||!segmentClear(s,target.pos,to,false,true,radius(target)))return fail('疾行需要一个可用的相邻格');
                const path=pathTo(s,target.pos,to,radius(target));if(!path.length)return fail('疾行方向被阻挡');
                clearPersonalAction(target);target.path=[];target.destination=null;target.intent=null;target.attackPending=undefined;target.moveProgress=0;target.moveFrom=undefined;target.drawPos=copy(to);target.pos=copy(to);
                cancelLoadout(target);interruptSkill(target);
                target.statuses.push({ kind: 'guard', remaining: .35,duration:.35,source:'card:dash',name:'疾行闪避', power: 1 });
            }
        }
        if (c.type === 'card')
            {s.cards = s.cards.filter(a => a.id !== c.cardId);flushCards(s);}
        else
            s.inventory[c.item]--;
        s.stats[c.type==='card'?'cards':'items']=(s.stats[c.type==='card'?'cards':'items']||0)+1;
        return ok('已使用 ' + (selected?.name || c.type === 'item' && c.item));
    }
    const u = 'id' in c ? s.units.find(a => a.id === c.id && a.team === 'ally') : null;
    if(u&&!participates(s,u))return fail('角色未在本次队伍中');
    if (!u)
        return fail('角色不存在');
    if(u.evasion?.action&&['move','direct','skill','weapon','switchWeapon','extract','collect','rescue'].includes(c.type)){if(c.type==='direct'&&!c.direction)return ok();return fail('闪避动作中');}
    if(c.type==='evade'){const r=evade(s,u,c.direction);return r.ok?ok():fail(r.reason!);}
    if(c.type==='destroyClone'){return removeClone(s,u.id,'destroy')?ok('影复制体已销毁'):fail('只能销毁影复制体');}
    if(c.type==='clone'){
        const check=queryClone(s,u.id,c.to);if(!check.ok)return fail(check.reason!);
        const serial=s.nextId++,id='clone-'+u.id+'-'+serial;
        const clone=createClone(u,id,serial,c.to);payVitality(s,cloneCost,'clone');s.units.push(clone);return ok(u.name+' 的影复制体已布置（20生命力）');
    }
    if (c.type === 'deploy') {
        if (!['reserve', 'withdrawn'].includes(u.life) || u.ready > 0 || !canDeployAt(s,c.to,u)||!positionKnown(s,c.to))
            return fail('角色尚未就绪或部署格无效');
        u.shadowResident=false;u.protectedRecall=false;clearPersonalAction(u);u.life = 'active';
        u.pos = copy(c.to);
        u.drawPos = copy(c.to);
        u.facing = awayFromCrystal(s,u);
        u.defaultFacing = u.facing;
        u.ready = 0;
        s.effects.push({id:s.nextId++,from:copy(u.pos),to:copy(u.pos),kind:'deploy',color:'#74b9c7',remaining:.4});
        return ok(u.name + ' 已部署');
    }
    if(c.type==='rescue'){const r=requestRescue(s,u);return r.ok?ok('猎人正在救援 '+u.name):fail(r.reason!);}
    if(c.type==='collect'){const r=u.life==='downed'?requestRescue(s,u):requestRecall(s,u,true);return r.ok?ok('已指定收纳 '+u.name):fail(r.reason!);}
    if(c.type==='direct'){const r=direct(s,u,c.direction);if(r.ok&&c.direction){u.partyTask=undefined;u.following=false;}return r.ok?ok():fail(r.reason!);}
    if(c.type==='blink'){const r=blink(s,u,c.direction);return r.ok?ok():fail(r.reason!);}
    if (c.type === 'switchWeapon'||c.type==='weapon') {
        const r=requestWeapon(s,u,c.type==='weapon'?c.index:u.weaponIndex%2===0?u.weaponIndex+1:u.weaponIndex-1);
        if(r.ok){u.partyTask=undefined;u.following=false;}return r.ok?ok(u.loadout?'正在原地换装':'装备已配置'):fail(r.reason!);
    }
    if (!actionable(u))
        return fail('角色当前不在场或处于硬直/眩晕');
    if (c.type === 'move') {
        if(u.cloneOf)return fail('复制体不可移动');
        const r = move(s, u, c.to, c.facing);
        return r.ok ? ok() : fail(r.reason!);
    }
    if (c.type === 'face') {
        return fail('当前版本自动朝向，无需手动定向');
    }
    if (c.type === 'skill') {
        if(u.skillLanding)return fail('技能中断后正在落位');
        if(u.crossing)return fail('跨层期间不能施放技能');
        if(u.loadout)return fail('换装期间不能施放技能');
        const id=skillInSlot(u,c.slot??0);if(!id)return fail('技能槽为空');
        const spec=resolveSkill(u,undefined,id),runtime=skillState(u,id);
        if(!['toggle','chargedMode'].includes(spec.kind)&&foregroundSkill(u))return fail('正在执行另一个技能');
        if(spec.id==='rain'||spec.id==='reap')return fail('此技能自动发动，无需手动施放');
        if(spec.id==='dance'){if(!runtime.enabled)return fail('镰舞自动充能中');runtime.enabled=false;runtime.cd=runtime.max;return ok('镰舞退出，重新充能');}
        if(spec.kind==='count'){if(!castSpecial(s,u,id))return fail('没有痛印可释放');if(u.partyTask||u.recall){clearMotion(u);u.partyTask=undefined;u.recall=undefined;}u.following=false;return ok(u.name+' 释放折痛回响');}
        if(spec.kind==='toggle'){if(u.recall||u.partyTask)clearMotion(u);u.recall=undefined;u.partyTask=undefined;u.following=false;runtime.enabled=!runtime.enabled;u.attackPending=undefined;bindSkillMirrors(u);return ok(u.name+' '+spec.name+(runtime.enabled?'已开启':'已关闭'));}
        if (runtime.cd > 0 || u.ready > 0 || runtime.time > 0)
            return fail('技能尚未就绪');
        clearPersonalAction(u);u.path = [];
        u.destination = null;
        u.intent = null;
        u.drawPos=copy(u.pos);u.moveProgress=0;u.moveFrom=undefined;u.attackPending=undefined;
        if(spec.id==='sanctuary'){castSpecial(s,u,id);return ok(u.name+' 展开静钟庇护');}
        runtime.pressureCastId=s.nextId++;runtime.snapshot=structuredClone(spec);runtime.time=spec.duration;
        runtime.pulse=spec.pulseAt;
        runtime.cd = 0;
        s.stats.skills=(s.stats.skills||0)+1;
        return ok(u.name + ' 施放技能');
    }
    if (c.type === 'extract') {
        if(u.cloneOf){removeClone(s,u.id,'destroy');return ok('影复制体已销毁（不进入影庭）');}
        if(c.via==='gate')return fail('当前通过影庭回收；水晶安全点尚未开放');
        const r=requestRecall(s,u);return r.ok?ok('已请求影庭回收'):fail(r.reason!);
    }
    return fail('未知操作');
}
const hValid = (s: GameState) => !!hunter(s);
function hurt(s: GameState, u: Unit, n: number):number { if(!active(u)||n<=0||u.statuses.some(st=>st.kind==='guard'&&st.remaining>0))return 0;
n*=['guard','ines'].includes(u.role)?1-COMBAT_CONFIG.guardReduction:1;
n*=1-Math.min(.9,Math.max(0,...u.statuses.filter(st=>st.kind==='defense'&&st.remaining>0).map(st=>st.power)));
for(const shield of u.statuses.filter(st=>st.kind==='shield'&&st.remaining>0)){const absorbed=Math.min(n,Math.max(0,shield.power));shield.power-=absorbed;n-=absorbed;if(n<=0)break;}
u.statuses=u.statuses.filter(st=>st.kind!=='shield'||st.power>0);
const lost=Math.min(u.hp,n);u.hp = Math.max(0, u.hp - n);recordHealthLoss(u,lost);u.hitFlash = .2;
if(isStandaloneExploration(s)&&isPartyBody(s,u)){const m=s.exploration!.metrics??={damageTaken:0,casualties:0};m.damageTaken+=lost;}
if(u.hp<=u.maxHp*.5&&u.team==='ally')gainStress(s,u,'lowHealth');
if (u.hp > 0)return lost;
resetPressure(u);
if(u.team==='ally'&&!u.cloneOf&&protectLethalRecall(s,u))return lost;
clearPersonalAction(u);
interruptSkill(u);cancelLoadout(u);u.skillLanding=undefined;if(u.team==='ally'&&hasEquippedSkill(u,'dance')){skillState(u,'dance').enabled=false;skillState(u,'dance').cd=skillState(u,'dance').max;}
u.crossing=undefined;u.afterCross=undefined;u.transition=0;u.moveProgress=0;u.drawPos=copy(u.pos);
if(u.cloneOf){removeClone(s,u.id,'death');return lost;}
if(isStandaloneExploration(s)&&isPartyBody(s,u)){const m=s.exploration!.metrics??={damageTaken:0,casualties:0};m.casualties++;m.firstCasualtySeconds??=s.time;}
if(u.team==='ally')for(const a of s.units.filter(a=>a.id!==u.id&&dist(a.pos,u.pos)<=COMBAT_CONFIG.mental.nearbyRadius))gainStress(s,a,'allyDown');
u.path = []; u.destination = null; u.intent = null;u.attackPending=undefined;u.moveFrom=undefined;u.crossing=undefined;u.afterCross=undefined;u.transition=0; if (u.team === 'enemy') {
    u.life = 'dead';
    s.kills++;
    if(rewardKill(s,u))s.effects.push({id:s.nextId++,kind:'loot',from:copy(u.pos),to:copy(u.pos),remaining:1.2,amount:4,color:'#dfb766',sourceId:u.id,asset:u.asset});
    return lost;
} if (u.role === 'hunter') {
    u.life = 'respawning';
    u.respawnTimer = 16;
    note(s, '猎人倒下，16 秒后重生');
}
else if (u.role === 'fiorre') {
    (s.rescueRestrictions??={})[u.id]=s.node;u.life = 'rescued';
    note(s, '菲奥蕾本场禁用');
}
else {
    u.life = 'downed';
    u.downTimer = 45;
    note(s, u.name + ' 濒死：45 秒救援窗口');
} return lost;}
function spawn(s:GameState,wave:WaveDefinition,batch:BatchDefinition,entry:SpawnEntry){
 const role=entry.role,p=batch.route[0],u=makeUnit('enemy-'+s.nextId++,role==='heavy'?'重甲亡徒':role==='ranged'?'铳手':'亡徒',role,p,'enemy');
 u.asset=entry.asset;
 const baseHp=role==='heavy'?210:role==='ranged'?95:120,baseDamage=role==='heavy'?16:role==='ranged'?11:9;
 u.hp=u.maxHp=Math.round(baseHp*entry.hpScale);u.damage=Math.round(baseDamage*entry.damageScale);weapon(u).damage=u.damage;u.speed=COMBAT_CONFIG.enemyTowerSpeed;u.light=0;
 u.route=batch.route.slice(1).map(copy);u.path=u.route.map(copy);u.destination=copy(s.goal);u.intent='move';configureCombat(u);
 u.rewardKey=s.economy.serial+':node:'+s.node+':wave:'+wave.id+':batch:'+batch.id+':entry:'+entry.id;
 s.units.push(u);s.spawned++;
}
function settleIntent(_s:GameState,u:Unit){if(u.intent==='move'&&!u.path.length&&!u.direct){u.intent=null;u.destination=null;}}

function stopMovement(s:GameState,u:Unit){if(u.recall){u.recall.repath=0;u.recall.elapsed=0;}u.path=[];u.destination=null;u.intent=null;u.crossing=undefined;u.transition=0;u.moveProgress=0;u.afterCross=undefined;u.drawPos=copy(u.pos);completePlayerMove(s,u);note(s,'落点或路径受阻，已停止');}
function advanceMovement(s:GameState,u:Unit,dt:number){
 if(u.crossing){const c=u.crossing;c.elapsed+=dt;u.moveProgress=c.elapsed/SPACE.crossSeconds;u.transition=SPACE.crossSeconds;
  if(!c.switched&&c.elapsed>=SPACE.crossSeconds/2){
   if(!terrainFits(s,c.to,radius(u))||occupied(s,c.to,u.id,radius(u))||!segmentClear(s,c.from,c.to,false,true,radius(u))){stopMovement(s,u);return;}
   u.pos=copy(c.to);u.drawPos=copy(c.to);c.switched=true;
  }
  if(c.elapsed>=SPACE.crossSeconds){u.crossing=undefined;u.transition=0;u.moveProgress=0;if(u.path[0]&&same(u.pos,u.path[0]))u.path.shift();if(u.direct){u.path=[];u.destination=null;u.intent=null;}if(u.afterCross){const to=u.afterCross;u.afterCross=undefined;u.path=pathTo(s,u.pos,to,radius(u));if(!u.path.length&&!same(u.pos,to)){stopMovement(s,u);return;}}settleIntent(s,u);}return;
 }
 if(locomotionLocked(u)){u.path=[];u.destination=null;u.intent=null;return;}
 const next=u.path[0];if(!next)return;
 if(u.team==='ally'&&u.destination&&!canStop(s,u.destination,u)){stopMovement(s,u);return;}
 if(!segmentClear(s,u.pos,next,u.team==='enemy',u.team==='ally',radius(u))){
  const to=u.team==='enemy'?(u.enemyMotion==='return'?u.returnPoint||next:s.units.find(t=>t.id===u.pursuitTargetId)?.pos||next):u.destination||next;u.path=u.team==='enemy'?enemyPathTo(s,u.pos,to,radius(u)):pathTo(s,u.pos,to,radius(u));
  if(u.ai?.moving&&u.ai.anchor&&u.path.some(p=>distance(p,u.ai!.anchor!)>activityRadius(s)+1e-7||surface(s,p)?.layer!==surface(s,u.ai!.anchor!)?.layer))u.path=[];
  if(!u.path.length)stopMovement(s,u);return;
 }
 faceToward(u,next);u.attackPending=undefined;
 if(surface(s,u.pos)?.layer!==surface(s,next)?.layer){
  const a=cell(u.pos),b=cell(next),axis=a.x!==b.x?'x':'y',sign=Math.sign(next[axis]-u.pos[axis]);
  const boundary=a[axis]+sign*.5,entry={...u.pos,[axis]:boundary-sign*radius(u)},exit={...u.pos,[axis]:boundary+sign*radius(u)};
  if(!same(u.pos,entry)){u.path.unshift(entry);return;}
  cancelLoadout(u);interruptSkill(u);u.crossing={from:copy(u.pos),to:exit,elapsed:0,switched:false};u.transition=SPACE.crossSeconds;return;
 }
 const slow=Math.min(.9,Math.max(0,...u.statuses.filter(st=>st.kind==='slow'&&st.remaining>0).map(st=>st.power)));
 const len=dist(u.pos,next),travel=dt*movementSpeed(s,u);
 const p=len<=travel?copy(next):{x:u.pos.x+(next.x-u.pos.x)*travel/len,y:u.pos.y+(next.y-u.pos.y)*travel/len};
 if(!segmentClear(s,u.pos,p,u.team==='enemy',u.team==='ally',radius(u))){stopMovement(s,u);return;}
 if(u.team==='ally'&&!same(u.pos,p))cancelLoadout(u);if(u.ai?.moving&&!same(u.pos,p)){const d=dist(u.pos,p);u.ai.lastAutoMoveDirection={x:(p.x-u.pos.x)/d,y:(p.y-u.pos.y)/d};u.ai.lastAutoMoveAt=s.time;}u.pos=p;u.drawPos=copy(p);
 if(same(p,next)){u.path.shift();if(u.team==='enemy'&&same(p,u.route[u.routeIndex]||s.goal))u.routeIndex++;if(u.team==='enemy'&&s.ruleset!=='exploration'&&same(p,s.goal)){s.crystalHp-=u.role==='heavy'?2:1;u.life='departed';}settleIntent(s,u);}
 completePlayerMove(s,u);
}

function tick(s: GameState, dt: number) {
    ensureControlledBody(s);
    s.time += dt;for(const u of s.units){if(!participates(s,u))continue;tickPressure(u,dt);if(locomotionLocked(u)&&!u.crossing){u.path=[];u.destination=null;u.intent=null;u.direct=undefined;u.following=false;if(u.ai?.moving){u.ai.moving=false;u.ai.task=undefined;u.ai.targetId=undefined;}}}updateVision(s);tickEchoes(s,{hit:resolveHit});cleanEngagements(s);tickPersonalClocks(s,dt);
    if(s.ruleset!=='exploration')spawnDue(s,(wave,batch,entry)=>spawn(s,wave,batch,entry));
    s.effects = s.effects.filter(e => (e.remaining -= dt) > 0);
    s.lights = s.lights.filter(l => (l.remaining -= dt) > 0);
    for(const u of s.units){if(participates(s,u))tickEvasion(s,u,dt);if(u.attackIntent&&!validIntent(s,u))tickIntent(s,u,0);}
    for(const u of s.units)advanceForcedMotion(s,u,dt);
    advanceAutonomy(s,dt);followParty(s,dt);advanceParty(s,0);advanceRecall(s,0);
    for(const u of s.units){if(u.team!=='ally'||!participates(s,u)||!actionable(u))continue;
      if(u.evasion?.action||u.evasion?.finishedAt===s.time)continue;
      if(advanceReapLanding(s,u,dt))continue;
      if(u.direct&&!u.crossing&&!u.path.length)advanceDirect(s,u,dt);
      if(u.crossing||u.path.length)advanceMovement(s,u,dt);
    }
    advanceRecall(s,dt);advanceParty(s,dt);captureRecallProtection(s);cleanEngagements(s);
    for (const u of s.units) {
        if(!participates(s,u))continue;
        u.turnCd=Math.max(0,(u.turnCd||0)-dt);
        if(u.team==='ally')advanceSkillClock(s,u,dt,false);else u.skillCd=Math.max(0,u.skillCd-dt);
        u.ready = Math.max(0, u.ready - dt);
        u.hitFlash = Math.max(0, u.hitFlash - dt);
        u.attackFlash = Math.max(0, u.attackFlash - dt);
        u.reveal = Math.max(0, u.reveal - dt);
        if(u.life==='downed')continue;
        if (u.life === 'respawning') {
            u.respawnTimer -= dt;
            if (u.respawnTimer <= 0) {
                const f=s.units.find(a=>a.role==='fiorre'&&active(a));
                const available=s.tiles.filter(t=>(s.exploration?canStop(s,t,u):walkable(s,t))&&!occupied(s,t,u.id)&&!s.units.some(a=>a.id!==u.id&&active(a)&&same(a.pos,t)));
                const around=f?available.filter(t=>dist(t,f.pos)<=3).sort((a,b)=>dist(a,f.pos)-dist(b,f.pos)):[];
                const checkpoint=s.exploration?.checkpoint;const fallback=checkpoint||s.exploration?.definition.entry||{x:2,y:4};const spawnPoint=(!checkpoint?around[0]:undefined)||available.filter(t=>!s.exploration||t.layer===0).sort((a,b)=>dist(a,fallback)-dist(b,fallback))[0];
                if(!spawnPoint){u.respawnTimer=.25;continue}
                u.life = 'active';
                u.hp = Math.round(u.maxHp * .6);
                u.pos = copy(spawnPoint);
                u.drawPos = copy(u.pos);
            }
            continue;
        }
        if (!active(u))
            continue;
        if(u.team==='ally'&&!s.exploration&&!u.path.length&&!u.crossing&&!u.direct){u.defaultFacing=awayFromCrystal(s,u);if(!u.attackPending){u.facing=u.defaultFacing;u.heading=Math.atan2(u.pos.y-s.goal.y,u.pos.x-s.goal.x);}}
        const movingRecovery=isStandaloneExploration(s)&&!!(u.direct||u.path.length||u.crossing||u.evasion?.action||u.evasion?.finishedAt===s.time||s.context==='explorationIdle')&&!u.skillLanding&&!u.loadout&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&u.stagger<=0&&!u.statuses.some(st=>st.kind==='stun');
        if(movingRecovery)u.attackTimer=Math.max(0,u.attackTimer-dt);
        u.stressCd=Math.max(0,u.stressCd-dt);
        u.mentalTime=Math.max(0,(u.mentalTime||0)-dt);
        if(!u.mentalTime)u.mental='steady';
        for (const st of u.statuses) {
            st.remaining -= dt;
            if (st.kind === 'poison'){if(st.power>0)combatActivity(s,st.origin,u);hurt(s, u, st.power * dt);}
            if(st.kind==='regen')healHealth(u,st.power*dt);
        }
        u.statuses = u.statuses.filter(st => st.remaining > 0);
        if (!active(u))
            continue;
        if(u.team==='enemy'&&tickEnemyReaction(s,u)){u.attackTimer=Math.max(0,u.attackTimer-dt);continue;}
        if(u.enemyCombat?.finishedAt===s.time)continue;
        if(u.team==='enemy'&&u.attackIntent){
            updateEngagement(s,u);u.attackTimer=Math.max(0,u.attackTimer-dt);const intent=tickIntent(s,u,dt);
            if(intent){const liveWeapon=u.weapons[u.weaponIndex];if(liveWeapon&&!liveWeapon.shadow)liveWeapon.durability=Math.max(0,liveWeapon.durability-1);const castId=s.nextId++;const candidates=s.units.filter(t=>isPartyBody(s,t)&&t.life==='active'&&!t.shadowResident&&t.ready<=0),inside=intentTargets(s,intent);s.stats.telegraphPositionAvoids=(s.stats.telegraphPositionAvoids||0)+candidates.length-inside.length;u.attackFlash=.25;const key=intent.kind==='ability'?'enemyAbilitiesReleased':'basicAttacksReleased';s.stats[key]=(s.stats[key]||0)+1;for(const t of inside){if(resolveHit(s,t,intent.weapon,intent.damage,u,{kind:intent.kind==='ability'?'ability':'basic',enemyAbilityId:intent.enemyAbilityId,impact:intent.enemyAbilityId&&ENEMY_ABILITIES[intent.enemyAbilityId].impact?{distance:ENEMY_ABILITIES[intent.enemyAbilityId].impact,wallPin:false}:undefined,postureDamage:intent.postureDamage,castId}))s.stats.telegraphHits=(s.stats.telegraphHits||0)+1;}}
            continue;
        }
        if(u.forcedMotion||u.stagger>0){u.attackPending=undefined;if(u.team==='ally'){tickEquippedSpecial(s,u,dt,false);advanceSkillClock(s,u,dt,true,true);}continue;}
        if(u.evasion?.action||u.evasion?.finishedAt===s.time)continue;
        if(u.skillLanding)continue;
        if(u.loadout){tickLoadout(s,u,dt);continue;}
        if(u.statuses.some(st=>st.kind==='stun')){u.attackPending=undefined;if(u.team==='ally'){if(foregroundSkill(u)==='rain')tickEquippedSpecial(s,u,dt);else if(foregroundSkill(u))interruptSkill(u);}continue;}
        if(u.team==='ally'&&u.stress>=100){
            u.mental=u.role==='fiorre'||rng(s)<COMBAT_CONFIG.mental.inspiredChance?'inspired':'distressed';
            u.mentalTime=COMBAT_CONFIG.mental.duration;u.stress=40;
            note(s,u.name+(u.mental==='inspired'?'进入振奋状态':'进入承压状态，仍可正常指挥'));
        }
        if(u.partyTask||u.recall)continue;
        if(s.exploration&&s.context==='explorationIdle'&&u.team==='ally'&&!u.cloneOf&&u.id!=='hunter'){
          advanceSkillClock(s,u,dt,true);for(const id of equippedSkills(u))if(skillState(u,id).run)tickSpecial(s,u,dt,{hit:resolveHit},id);
          continue;
        }
        if(u.team==='ally'&&tickEquippedSpecial(s,u,dt))continue;
        if(advanceSkillClock(s,u,dt,true))continue;
        if (u.ready > 0)
            continue;
        if(u.recall||u.rescueTarget||u.partyTask)continue;
        if(u.team==='enemy'&&u.enemyMotion!=='return'&&u.path.length&&s.barricades.some(b=>same(b,u.path[0]))&&dist(u.pos,u.path[0])<=1){
            const barrier=u.path[0],key=barrier.x+','+barrier.y;
            if(!movingRecovery)u.attackTimer=Math.max(0,u.attackTimer-dt);
            u.attackPending=undefined;
            if(u.attackTimer<=0){
                const hp=(s.barrierHp?.[key]??COMBAT_CONFIG.barrierHp)-weapon(u).damage;
                (s.barrierHp??={})[key]=hp;u.attackTimer=u.attackPeriod;u.attackFlash=.2;
                s.effects.push({id:s.nextId++,from:copy(u.pos),to:copy(barrier),color:'#c66b58',remaining:.2,kind:'shot',sourceId:u.id,asset:u.asset,action:'attack'});
                if(hp<=0){s.barricades=s.barricades.filter(b=>!same(b,barrier));delete s.barrierHp[key];note(s,'路障已被敌人摧毁')}
            }
            continue;
        }
        if(u.team==='enemy'){
            updateEngagement(s,u);
            const target=s.units.find(a=>a.id===u.pursuitTargetId&&active(a));
            if(u.enemyCombat){u.attackTimer=Math.max(0,u.attackTimer-dt);if(chooseEnemyCombat(s,u,target))continue;}
            if(u.enemyMotion==='return'){
                const to=u.returnPoint||u.route[u.routeIndex]||s.goal;
                if(same(u.pos,to)){u.enemyMotion='route';u.returnPoint=undefined;u.path=[];}
                else if(!u.path.length)u.path=enemyPathTo(s,u.pos,to,radius(u));
            }else if(target){
                if(canHit(s,u,target)){u.path=[];u.destination=null;}
                else if((u.navWait??0)<=0){u.path=enemyPathTo(s,u.pos,s.exploration?u.enemySense?.lastSeen||target.pos:target.pos,radius(u));u.navWait=.3;}
            }else if(s.ruleset!=='exploration'&&!u.path.length){
                const next=u.route[u.routeIndex]||s.goal;
                if(same(u.pos,next)){u.routeIndex++;u.path=[];}else u.path=enemyPathTo(s,u.pos,next,radius(u));
                u.intent='move';u.destination=copy(s.goal);
            }
            u.navWait=Math.max(0,(u.navWait??0)-dt);
        }
        settleIntent(s,u);
        if(!active(u))continue;
        const enemies=s.units.filter(t=>t.team!==u.team&&active(t));
        if(u.crossing||u.path.length||u.direct){if(u.team==='enemy')advanceMovement(s,u,dt);continue;}
        if(u.team==='enemy'&&(u.enemyMotion==='return'||!u.pursuitTargetId))continue;

        if(!movingRecovery&&!u.enemyCombat)u.attackTimer=Math.max(0,u.attackTimer-dt);
        if(u.attackPending){
            u.attackPending.remaining-=dt;
            if(u.attackPending.remaining<=0){
                const pending=u.attackPending;u.attackPending=undefined;
                const target=s.units.find(t=>t.id===pending.targetId);
                const front=target&&(pending.facing==='east'?target.pos.x-u.pos.x:pending.facing==='west'?u.pos.x-target.pos.x:pending.facing==='south'?target.pos.y-u.pos.y:u.pos.y-target.pos.y)>=-1e-7;
                if(target&&(!isStandaloneExploration(s)||u.facing===pending.facing&&front)&&canHit(s,u,target,pending.facing)){
                    const targets=[target];
                    releaseAttack(s,u,targets);
                }
            }
            continue;
        }
        const targets=enemies.filter(t=>canHit(s,u,t)&&(u.team==='ally'||t.id===u.pursuitTargetId)).sort((a,b)=>Number(b.engagement?.targetId===u.id)-Number(a.engagement?.targetId===u.id)||Number(u.ai?.task?.kind==='attack'&&b.id===u.ai.task.targetId)-Number(u.ai?.task?.kind==='attack'&&a.id===u.ai.task.targetId)||dist(a.pos,u.pos)-dist(b.pos,u.pos)||a.id.localeCompare(b.id));
        if(!targets.length)continue;
        const dx=targets[0].pos.x-u.pos.x,dy=targets[0].pos.y-u.pos.y;const attackFacing:Direction=Math.abs(dx)>=Math.abs(dy)?dx<0?'west':'east':dy<0?'north':'south';
        if (u.attackTimer <= 0) {
            if(u.team==='enemy'&&isStandaloneExploration(s)){startIntent(s,u,targets[0]);continue;}
            faceToward(u,targets[0].pos);
            u.attackPending={targetId:targets[0].id,remaining:.25,facing:attackFacing};attackCommit(s,u,targets[0]);
            const spec=u.team==='ally'&&hasEquippedSkill(u,'snipe')?resolveSkill(u,undefined,'snipe'):null;
            u.attackTimer=(weapon(u).attackPeriod??u.attackPeriod)*(spec?.id==='snipe'&&skillState(u,'snipe').enabled?spec.attackPeriodMultiplier:1)/weightProfile(u).attack;
        }
    }
    for(const u of s.units)if(participates(s,u)&&u.life==='downed'){u.downTimer-=dt;if(u.downTimer<=0){u.life='dead';clearPersonalAction(u);note(s,u.name+' 救援超时，已死亡');}}
    cleanEngagements(s);updatePartyCombat(s);updateVision(s);
    if(s.exploration?.definition.victoryCondition==='exit'&&queryExplorationExit(s).ok){exitExploration(s,[],()=>{});return;}
    if (s.ruleset!=='exploration' && s.crystalHp <= 0)
        finish(s, false);
    else if (s.ruleset!=='exploration' && advanceWave(s))
        finish(s, true);
    s.units=s.units.filter(u=>!(u.cloneOf&&u.life==='dead'));
    for(const u of s.units)clampGray(u);pruneRecoveryBudgets(s);flushCards(s);
}
/** Advance only the foreground run, while background modes remain independent. */
function tickEquippedSpecial(s:GameState,u:Unit,dt:number,allowStart=true):boolean{
 let busy=false;for(const id of equippedSkills(u)){const st=skillState(u,id);if(!allowStart&&!st.run)continue;const owner=foregroundSkill(u);if(busy&&!st.run&&id!=='dance')continue;if(owner&&owner!==id&&id!=='dance')continue;busy=tickSpecial(s,u,dt,{hit:resolveHit},id)||busy;}return busy;
}
function advanceSkillClock(s:GameState,u:Unit,dt:number,execute:boolean,suppressed=false):boolean{
 if(u.team==='enemy')return advanceEnemySkillClock(s,u,dt,execute,suppressed);
 let busy=false;for(const id of equippedSkills(u))busy=advanceOneSkillClock(s,u,id,dt,execute,suppressed)||busy;return busy;
}
function advanceOneSkillClock(s:GameState,u:Unit,id:import('./types').SkillId,dt:number,execute:boolean,suppressed=false):boolean{
 const runtime=skillState(u,id);
    if(u.shadowResident&&(u.role!=='fiorre'||u.cloneOf))return false;
    if(!execute){
        if(runtime.time<=0){const prior=runtime.cd;runtime.cd=Math.max(0,runtime.cd-dt);if(prior>0&&runtime.cd===0)runtime.readyAt=s.time-dt+prior;return false;}
        if(active(u)&&!u.shadowResident)return false;
    }else if(!active(u)||u.shadowResident||runtime.time<=0)return false;
    if(execute&&['sanctuary','rain'].includes(id))return false;
    const spec=runtime.snapshot||resolveSkill(u,undefined,id),used=Math.min(dt,runtime.time);
    runtime.time=Math.max(0,runtime.time-used);runtime.pulse=(runtime.pulse??spec.pulseAt)-used;
    if(execute&&runtime.pulse<=1e-8){if(!suppressed)castSkillPulse(s,u,id);runtime.pulse=spec.pulsePeriod>0?runtime.pulse+spec.pulsePeriod:Number.POSITIVE_INFINITY;}
    if(runtime.time<=1e-8){runtime.time=0;runtime.cd=Math.max(0,runtime.max-(dt-used));runtime.snapshot=undefined;}
    return true;
}
function advanceEnemySkillClock(s:GameState,u:Unit,dt:number,execute:boolean,suppressed=false):boolean{
    if(u.shadowResident&&(u.role!=='fiorre'||u.cloneOf))return false;
    if(!execute){
        if(u.skillTime<=0){const prior=u.skillCd;u.skillCd=Math.max(0,u.skillCd-dt);if(prior>0&&u.skillCd===0)currentSkill(u).readyAt=s.time-dt+prior;return false;}
        if(active(u)&&!u.shadowResident)return false;
    }else if(!active(u)||u.shadowResident||u.skillTime<=0)return false;
    if(execute&&['sanctuary','rain'].includes(resolveSkill(u).id))return false;
    const runtime=currentSkill(u),spec=runtime.snapshot||resolveSkill(u),used=Math.min(dt,u.skillTime);
    u.skillTime=Math.max(0,u.skillTime-used);u.skillPulse=(u.skillPulse??spec.pulseAt)-used;
    if(execute&&u.skillPulse<=1e-8){if(!suppressed)castSkillPulse(s,u);u.skillPulse=spec.pulsePeriod>0?u.skillPulse+spec.pulsePeriod:Number.POSITIVE_INFINITY;}
    if(u.skillTime<=1e-8){u.skillTime=0;u.skillCd=Math.max(0,u.skillMax-(dt-used));runtime.snapshot=undefined;}
    return true;
}
function addStatus(u:Unit,kind:'shield'|'defense'|'regen'|'stun'|'slow',power:number,duration:number,source:string,name:string){
    if(power<=0&&kind!=='stun'||duration<=0)return;
    const old=u.statuses.find(st=>st.kind===kind&&st.source===source);
    if(old){old.power=power;old.remaining=duration;old.duration=duration;old.name=name;}
    else u.statuses.push({kind,power,remaining:duration,duration,source,name});
}
function castSkillPulse(s:GameState,u:Unit,id?:import('./types').SkillId){
    const runtime=id?skillState(u,id):currentSkill(u),spec=runtime.snapshot||resolveSkill(u,undefined,id);
    if(!['prayer','ward'].includes(spec.id))combatActivity(s,u);
    const fx={sourceId:u.id,asset:u.asset,action:'skill' as const};
    if(spec.id==='prayer'||spec.id==='ward'){
        for(const a of s.units.filter(a=>a.team===u.team&&active(a)&&dist(a.pos,u.pos)<=spec.range)){
            healHealth(a,spec.heal);
            if(spec.shieldBase||spec.missingHpScale)addStatus(a,'shield',spec.shieldBase+(a.maxHp-a.hp)*spec.missingHpScale,spec.shieldDuration,'skill:'+u.id+':'+spec.id,'伤势护盾');
            addStatus(a,'defense',spec.defense,spec.defenseDuration,'skill:'+u.id+':'+spec.id,'安息庇护');
            addStatus(a,'regen',spec.regen,spec.regenDuration,'skill:'+u.id+':'+spec.id,'余音恢复');
            s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(a.pos),color:'#74b9c7',remaining:.6,kind:'heal'});
        }
        return;
    }
    if(spec.id==='bell'){
        const w:Weapon={...weapon(u),damageKind:'arcane',subtype:'frost'};
        for(const t of s.units.filter(t=>t.team!==u.team&&active(t)&&templateGeometry(s,u,t.pos,u.facing,{range:spec.range,width:0,remote:true}))){
            const hit=resolveHit(s,t,w,spec.power,u,{skillId:spec.id,castId:runtime.pressureCastId,postureDamage:spec.postureDamage,reclaimRate:spec.reclaimRate,reclaimBudget:spec.reclaimBudget});
            if(hit&&active(t)){addStatus(t,'slow',spec.slow,spec.slowDuration,'skill:'+u.id+':bell','暮钟迟滞');addStatus(t,'stun',0,spec.stun,'skill:'+u.id+':bell','裂响眩晕');}
            s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(t.pos),color:'#9bace3',remaining:.5,kind:'shot'});
        }
        if(spec.allyHeal)for(const a of s.units.filter(t=>t.team===u.team&&active(t)&&dist(u.pos,t.pos)<=spec.range))healHealth(a,spec.allyHeal);
        s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(u.pos),color:'#9bace3',remaining:.45,kind:'burst'});return;
    }
    const choices=DIRS.map(d=>({d,targets:s.units.filter(t=>t.team!==u.team&&active(t)&&templateGeometry(s,u,t.pos,d,{range:spec.range,width:spec.width,remote:true}))}));
    const defaultChoice=choices.find(c=>c.d===u.defaultFacing&&c.targets.length);
    const chosen=defaultChoice||choices.filter(c=>c.targets.length).sort((a,b)=>Math.min(...a.targets.map(t=>dist(t.pos,u.pos)))-Math.min(...b.targets.map(t=>dist(t.pos,u.pos))))[0];
    if(!chosen)return;
    u.facing=chosen.d;u.attackFlash=.25;
    const w:Weapon={name:'独立技能',range:0,width:0,remote:true,damage:0,durability:0,maxDurability:0,shadow:true,damageKind:'physical',subtype:'pierce'};
    for(const t of chosen.targets){const hit=resolveHit(s,t,w,spec.power,u,{skillId:spec.id,castId:runtime.pressureCastId,postureDamage:spec.postureDamage,reclaimRate:spec.reclaimRate,reclaimBudget:spec.reclaimBudget});if(hit&&active(t))addStatus(t,'stun',0,spec.stun,u.id,'短暂眩晕');}
    s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(chosen.targets[0].pos),color:'#d7be81',remaining:.3,kind:'shot'});
}
function releaseAttack(s:GameState,u:Unit,targets:Unit[]){
    s.stats.basicAttacksReleased=(s.stats.basicAttacksReleased||0)+1;
    const w=weapon(u);combatActivity(s,u,targets[0]);u.attackFlash=.25;
    if(u.team==='ally'&&hasEquippedSkill(u,'reap'))skillState(u,'reap').counter=Math.min(5,skillState(u,'reap').counter+1);
    if(!w.shadow)w.durability=Math.max(0,w.durability-1);
    const mental=u.mental==='inspired'?COMBAT_CONFIG.mental.inspiredDamage:u.mental==='distressed'?COMBAT_CONFIG.mental.distressedDamage:1;
    const modifier=u.team==='ally'?(['snipe','dance','poison'] as const).find(id=>hasEquippedSkill(u,id)&&skillState(u,id).enabled):undefined;
    const spec=modifier?resolveSkill(u,undefined,modifier):null,enabled=!!modifier;
    const damage=w.damage*(spec?.id==='snipe'&&enabled?spec.attackMultiplier:1)*mental*(1+u.statuses.filter(st=>st.kind==='attack').reduce((n,st)=>n+st.power,0));
    const castId=s.nextId++;
    for(const t of targets){
        if(!(u.team==='ally'&&(scytheSweep(s,u,t,{hit:resolveHit})||sniper(s,u,t,damage,{hit:resolveHit}))))resolveHit(s,t,w,damage,u,{kind:'basic',castId});
        if(spec?.id==='poison'&&enabled&&t.team==='enemy'&&active(t)){
            t.poisonMeter=(t.poisonMeter||0)+spec.poisonPerHit;
            if(t.poisonMeter>=spec.poisonThreshold){
                t.poisonMeter=0;
                for(const victim of s.units.filter(a=>a.team==='enemy'&&active(a)&&Math.hypot(a.pos.x-t.pos.x,a.pos.y-t.pos.y)<=spec.poisonRadius))resolveHit(s,victim,{...w,damageKind:'arcane',subtype:'flame'},spec.poisonDamage,u,{skillId:'poison',castId,postureDamage:spec.postureDamage});
                s.effects.push({id:s.nextId++,from:copy(t.pos),to:copy(t.pos),color:'#a9dc76',remaining:.55,kind:'burst',sourceId:u.id,asset:u.asset,action:'skill'});
            }
        }
        if(u.team==='enemy'){u.reveal=2;(s.reveals??={})[u.id+':'+t.id]=s.time+2}
    }
    s.effects.push({id:s.nextId++,from:copy(u.pos),to:copy(targets[0].pos),color:u.team==='ally'?'#c7e9e8':'#cc7075',remaining:.22,kind:'shot',sourceId:u.id,asset:u.asset,action:'attack'});
    if(w.durability<=0&&!w.shadow){const index=u.weapons.findIndex(a=>a.shadow&&a.profession===w.profession&&compatibleWeapon(u,a));if(index>=0){u.weaponIndex=index;bindSkillMirrors(u);note(s,u.name+' 武器损坏，切换同职业影武器');}}
}
export function step(s: GameState, dt: number) { if (s.phase !== 'battle' || !Number.isFinite(dt) || dt <= 0)
    return; let remaining = Math.min(dt, 60); while (remaining > 0 && s.phase === 'battle') {
    const d = Math.min(.05, remaining);
    tick(s, d);ensureControlledBody(s);
    remaining -= d;
} }










/** Developer encounter fixture: real strategies, deliberately no exploration lifecycle manager. */
export function createExplorationScenario():GameState{
 const s=createGame();command(s,{type:'carry',gold:0,vitality:0});s.ruleset='exploration';s.waveState=null;s.waves=[];s.totalEnemies=999;s.phase='briefing';
 const h=s.units[0];h.pos={x:3.1,y:4};h.drawPos=copy(h.pos);h.block=0;h.hp=h.maxHp=1500;
 for(const u of s.units)u.ready=0;
 const copyUnit:Unit={...structuredClone(s.units[2]),id:'validation-copy',cloneOf:'guard',life:'active',pos:{x:5,y:5},drawPos:{x:5,y:5},ready:0};s.units.push(copyUnit);
 const e=makeUnit('validation-enemy','交战验证敌人','melee',{x:6,y:4},'enemy');configureCombat(e);e.asset='Dustin';e.hp=e.maxHp=1500;e.weapons[0].range=1;e.weapons[0].remote=false;s.units.push(e);
 s.notice='探索交战验证：敌人忽略复制体，容量不足仍追击本体。';return s;
}
