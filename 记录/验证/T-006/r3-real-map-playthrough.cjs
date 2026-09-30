const fs=require('fs');
const crypto=require('crypto');
const {chromium}=require('../../../game/node_modules/@playwright/test');
(async()=>{
 const sourceFiles=['types.ts','engine.ts','personal.ts','skill-catalog.ts','progression.ts','loadout.ts'];
 const fingerprint=()=>Object.fromEntries(sourceFiles.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync('game/src/core/'+name)).digest('hex')]));
 const sourceBefore=fingerprint(),startedAt=new Date().toISOString();
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage();
 await page.route('http://127.0.0.1:5173/r3-core-validation',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Real map command validation</title>'}));
 await page.goto('http://127.0.0.1:5173/r3-core-validation');
 const evidence=await page.evaluate(async()=>{
  const {createGame,command,step}=await import('/src/core/engine.ts');
  const {currentSkill}=await import('/src/core/progression.ts');
  const {skillInfo,resolveSkill}=await import('/src/core/skill-catalog.ts');
  const s=createGame(),trace=[],snapshots=[];
  const perform=c=>{const beforeBalance=s.fragments,r=command(s,c);trace.push({time:+s.time.toFixed(3),command:c,ok:r.ok,reason:r.reason||'',phase:s.phase,beforeBalance,balance:s.fragments});return r.ok;};
  const snap=label=>snapshots.push({label,time:+s.time.toFixed(3),phase:s.phase,result:s.result,crystal:s.crystalHp,balance:s.fragments,kills:s.kills,spawned:s.spawned,wave:s.wave,units:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,role:u.role,life:u.life,hp:+u.hp.toFixed(2),ready:+u.ready.toFixed(2),weaponIndex:u.weaponIndex,weaponDurability:u.weapons.map(w=>w.durability),skill:skillInfo(u).id,cd:+u.skillCd.toFixed(2),stage:currentSkill(u).stage,branches:{...currentSkill(u).branches},shadow:!!u.shadowResident}))});
  snap('default 40 fragments, unmodified map and all 45 enemies');
  perform({type:'upgradeSkill',id:'fiorre',kind:'stage',expectedLevel:0});
  perform({type:'start'});
  perform({type:'move',id:'hunter',to:{x:4.7,y:8}});
  for(let i=0;i<10&&s.phase==='battle';i++)step(s,1);
  for(const [id,to] of [['guard',{x:6.6,y:8}],['fiorre',{x:5.7,y:8}],['ranger',{x:8,y:9}]])perform({type:'deploy',id,to,facing:'east'});
  perform({type:'skill',id:'ranger'});
  let copied=false,recall=false,reDeployed=false,switched=false,castBell=false,switchedBack=false,boughtBell=false,boughtReach=false,boughtShelter=false;
  const finishFlags=()=>({copied,recall,reDeployed,switched,castBell,switchedBack,boughtBell,boughtReach,boughtShelter});
  while(s.phase==='battle'&&s.time<340){
   const t=s.time,foes=s.units.filter(u=>u.team==='enemy'&&u.life==='active'),f=s.units.find(u=>u.id==='fiorre'),g=s.units.find(u=>u.id==='guard'),r=s.units.find(u=>u.id==='ranger');
   if(!recall&&t>=25){recall=perform({type:'extract',id:'ranger',via:'shadow'});}
   if(recall&&!reDeployed&&r.life==='withdrawn'&&r.ready<=0){reDeployed=perform({type:'deploy',id:'ranger',to:{x:8,y:9},facing:'east'});if(reDeployed)snap('healthy recall and warmup redeployment complete');}
   if(!copied&&g.life==='active'&&s.fragments>=20&&t>=45){copied=perform({type:'clone',id:'guard',to:{x:7.8,y:8}});if(copied)snap('paid 20 for the first independent guard copy');}
   if(!switched&&t>=75&&f.life==='active'&&!f.loadout){switched=perform({type:'weapon',id:'fiorre',index:2});}
   if(switched&&f.weaponIndex===2&&!boughtBell&&s.fragments>=24){boughtBell=perform({type:'upgradeSkill',id:'fiorre',kind:'stage',expectedLevel:0});}
   if(switched&&f.weaponIndex===2&&!castBell&&f.skillCd<=0&&!f.loadout&&foes.some(e=>Math.hypot(e.pos.x-f.pos.x,e.pos.y-f.pos.y)<=resolveSkill(f).range)){castBell=perform({type:'skill',id:'fiorre'});if(castBell)snap('cultivated Frost Bell cast in real enemy wave');}
   if(switched&&castBell&&!switchedBack&&f.skillTime<=0&&!f.loadout){switchedBack=perform({type:'weapon',id:'fiorre',index:0});}
   if(switchedBack&&f.weaponIndex<2&&!boughtReach&&s.fragments>=12){boughtReach=perform({type:'upgradeSkill',id:'fiorre',kind:'branch',branch:'reach',expectedLevel:0});}
   if(switchedBack&&f.weaponIndex<2&&!boughtShelter&&s.fragments>=12){boughtShelter=perform({type:'upgradeSkill',id:'fiorre',kind:'branch',branch:'shelter',expectedLevel:0});}
   for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'&&!u.loadout&&!u.recall&&!u.crossing)){
    const d=skillInfo(u),spec=resolveSkill(u);
    if(d.id==='snipe'&&!currentSkill(u).enabled&&u.ready<=0){perform({type:'skill',id:u.id});continue;}
    if(d.id==='hunt'&&u.skillCd<=0&&u.skillTime<=0&&foes.some(e=>Math.hypot(e.pos.x-u.pos.x,e.pos.y-u.pos.y)<=spec.range)){perform({type:'skill',id:u.id});}
    if(d.id==='prayer'&&u.skillCd<=0&&u.skillTime<=0&&s.units.some(a=>a.team==='ally'&&a.life==='active'&&a.maxHp-a.hp>=80&&Math.hypot(a.pos.x-u.pos.x,a.pos.y-u.pos.y)<=spec.range)){perform({type:'skill',id:u.id});}
   }
   step(s,1);
   if(Math.floor(s.time)%30===0)snap('30 second checkpoint');
  }
  snap('original 45-enemy battle finished or timed observation limit');
  const battleResult={phase:s.phase,result:s.result,time:s.time,kills:s.kills,spawned:s.spawned,total:s.totalEnemies,crystal:s.crystalHp,balance:s.fragments,flags:finishFlags()};
  let nextNode=null;
  if(s.phase==='result'&&s.result==='victory'){
   perform({type:'continue'});const rest=perform({type:'rest'});const next=perform({type:'enter',node:3});snap('next node after ordinary map/rest flow');nextNode={rest,next,node:s.node,phase:s.phase,balance:s.fragments,crystal:s.crystalHp,total:s.totalEnemies};
  }
  return {testedSource:'local uncommitted R3 source',method:'Fresh createGame; only production command and step mutate gameplay; no HP/resources/waves/enemy changes; automated tactical command policy, not a human mouse/UI playtest.',battleResult,nextNode,resourceLedger:{startingFragments:40,commandSpend:trace.reduce((n,v)=>n+Math.max(0,v.beforeBalance-v.balance),0),killCount:battleResult.kills,endingFragments:battleResult.balance},snapshots,trace,gameLog:s.log};
 });
 evidence.environment={startedAt,node:process.version,browser:browser.version(),sourceBefore,sourceAfter:fingerprint()};
 fs.writeFileSync('work/r3-real-map-playthrough.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({battleResult:evidence.battleResult,nextNode:evidence.nextNode,commands:evidence.trace.length,failedCommands:evidence.trace.filter(v=>!v.ok)},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
