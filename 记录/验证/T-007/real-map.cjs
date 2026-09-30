const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {chromium}=require('../../../game/node_modules/@playwright/test');
const root=path.resolve(__dirname,'../../..');
const sources=['engine.ts','skill-execution.ts','reap-path.ts','skill-catalog.ts','progression.ts','loadout.ts','personal.ts','combat-config.ts','types.ts'];
const hashes=()=>Object.fromEntries(sources.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'game/src/core',n))).digest('hex')]));
(async()=>{
 const startedAt=new Date().toISOString(),sourceBefore=hashes();
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage();
 await page.route('http://127.0.0.1:5173/t007-core-validation',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>T-007 real map</title>'}));
 await page.goto('http://127.0.0.1:5173/t007-core-validation');
 const runs=await page.evaluate(async()=>{
  const {createGame,command,step}=await import('/src/core/engine.ts');
  const {currentSkill}=await import('/src/core/progression.ts');
  const {skillInfo,resolveSkill}=await import('/src/core/skill-catalog.ts');
  const out=[];
  for(const alternate of [false,true]){
   const s=createGame(),trace=[],snapshots=[],casts=new Set();
   const perform=c=>{const before=s.fragments,r=command(s,c);trace.push({time:+s.time.toFixed(3),command:c,...r,beforeBalance:before,balance:s.fragments});return r.ok;};
   const snap=label=>snapshots.push({label,time:+s.time.toFixed(3),phase:s.phase,result:s.result,kills:s.kills,spawned:s.spawned,crystal:s.crystalHp,balance:s.fragments,units:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,life:u.life,hp:+u.hp.toFixed(2),pos:{...u.pos},weapon:u.weaponIndex,skill:skillInfo(u).id,stage:currentSkill(u).stage,branches:{...currentSkill(u).branches},count:currentSkill(u).counter,enabled:currentSkill(u).enabled,run:currentSkill(u).run?.spec.id}))});
   snap('fresh game with original 40 fragments and 45-enemy map');
   if(alternate){for(const [id,skillId] of [['ines','sanctuary'],['ranger','rain'],['fiorre','reap']])perform({type:'configureSkill',id,skillId});}
   const id=alternate?'ines':'fiorre';
   perform({type:'upgradeSkill',id,kind:'stage',expectedLevel:0});
   perform({type:'upgradeSkill',id,kind:'branch',branch:alternate?'A':'B',expectedLevel:0});
   perform({type:'start'});perform({type:'move',id:'hunter',to:{x:4.7,y:8}});
   for(let i=0;i<40&&s.phase==='battle';i++)step(s,.25);
   for(const [id,to] of [['ines',{x:6.6,y:8}],['fiorre',{x:5.7,y:8}],['ranger',{x:8,y:9}]])perform({type:'deploy',id,to,facing:'east'});
   let copied=false,copyAttempted=false;
   while(s.phase==='battle'&&s.time<340){
    const foes=s.units.filter(u=>u.team==='enemy'&&u.life==='active');
    for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'&&!u.loadout&&!u.recall&&!u.crossing)){
     const d=skillInfo(u),st=currentSkill(u),r=resolveSkill(u);
     if(d.id==='snipe'&&!st.enabled&&u.ready<=0)perform({type:'skill',id:u.id});
     if(d.id==='pain'&&st.counter>=3&&s.units.some(a=>a.team==='ally'&&a.life==='active'&&a.hp/a.maxHp<.85&&Math.hypot(a.pos.x-u.pos.x,a.pos.y-u.pos.y)<=r.range))perform({type:'skill',id:u.id});
     if(['hunt','sanctuary'].includes(d.id)&&st.cd<=0&&st.time<=0&&foes.some(e=>Math.hypot(e.pos.x-u.pos.x,e.pos.y-u.pos.y)<=r.range))perform({type:'skill',id:u.id});
     if(st.run)casts.add(st.run.spec.id);if(st.enabled&&d.id==='dance')casts.add('dance');
    }
    const ines=s.units.find(u=>u.id==='ines');
    if(!copyAttempted&&s.time>=45&&s.fragments>=20&&ines.life==='active'){copyAttempted=true;copied=perform({type:'clone',id:'ines',to:{x:7.8,y:8}});}
    step(s,.25);if(Math.round(s.time*4)%120===0)snap('30 second checkpoint');
   }
   snap('battle result or 340-second observation limit');
   const result={phase:s.phase,result:s.result,time:+s.time.toFixed(3),kills:s.kills,spawned:s.spawned,total:s.totalEnemies,crystal:s.crystalHp,balance:s.fragments,copied,observedAutomaticOrWindow:[...casts]};
   let nextNode;
   if(s.phase==='result'&&s.result==='victory'){perform({type:'continue'});perform({type:'rest'});perform({type:'enter',node:3});snap('normal next-node entry');nextNode={node:s.node,phase:s.phase,crystal:s.crystalHp,skills:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,skill:skillInfo(u).id,stage:currentSkill(u).stage,counter:currentSkill(u).counter,cd:currentSkill(u).cd,enabled:currentSkill(u).enabled}))};}
   out.push({case:alternate?'sanctuary/rain/reap':'pain/snipe/dance',method:'Fresh createGame; only production command/step modify gameplay. Original map/waves/enemies/resources/HP; automated policy, not human UI or balance approval.',result,nextNode,trace,snapshots,gameLog:s.log});
  }return out;
 });
 const evidence={environment:{startedAt,node:process.version,browser:browser.version(),sourceBefore,sourceAfter:hashes()},runs};
 fs.writeFileSync(path.join(__dirname,'real-map.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(runs.map(r=>({case:r.case,result:r.result,nextNode:r.nextNode,failedCommands:r.trace.filter(v=>!v.ok)})),null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
