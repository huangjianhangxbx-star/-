import {test,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
import {waveProgress} from '../src/core/waves';
import {writeFileSync} from 'node:fs';

test('normal resources complete short, rest and all twelve dark waves before unique banking',()=>{
 const s=createGame(),trace:any[]=[],waves:any[]=[];
 const act=(c:Parameters<typeof command>[1])=>{const r=command(s,c);expect(r.ok,r.reason).toBe(true);trace.push({node:s.node,time:s.time,action:c,balance:s.fragments,kills:s.kills,crystal:s.crystalHp});};
 // Explicit test account initialization only; no balance or result injection in play.
 s.economy.account={gold:25,vitality:100};act({type:'carry',gold:5,vitality:80});
 act({type:'weapon',id:'fiorre',index:0});act({type:'upgradeSkill',id:'ines',kind:'stage',expectedLevel:0});act({type:'upgradeSkill',id:'ranger',kind:'stage',expectedLevel:0});act({type:'draw',expectedPrice:10});const sold=s.cards.find(c=>c.group==='deck')!;act({type:'sellCard',cardId:sold.id});
 function prepare(){act({type:'start'});step(s,10.1);act({type:'deploy',id:'ranger',to:{x:3,y:4},facing:'east'});act({type:'deploy',id:'fiorre',to:{x:4,y:5.5},facing:'east'});act({type:'deploy',id:'ines',to:{x:2,y:7},facing:'east'});act({type:'move',id:'hunter',to:{x:3,y:5}});act({type:'skill',id:'ranger'});step(s,2.9);}
 let last='',bought=0;
 function play(){
  let lastKill=s.kills,idle=0;
  for(let n=0;n<20000&&s.phase==='battle';n++){
   if(s.kills!==lastKill){lastKill=s.kills;idle=0;}else idle+=.1;
   const ines=s.units.find(u=>u.id==='ines')!;
   // A legal tactical response to ranged opponents: move the melee defender
   // closer. Do not erase a live enemy or extend the defender's weapon range.
   if(idle>8&&ines.life==='active'&&ines.pos.y===7&&!ines.path.length&&s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.role==='ranged'&&e.pursuitTargetId===ines.id)){
    act({type:'move',id:ines.id,to:{x:2,y:6}});step(s,2);act({type:'move',id:'hunter',to:{x:2,y:7.4}});idle=0;
   }
   for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'&&!u.path.length&&!u.crossing)){
    const st=currentSkill(u);
    if(u.skillId==='pain'&&st.counter>=2||u.skillId==='hunt'&&st.cd===0&&st.time===0||u.skillId==='prayer'&&st.cd===0&&st.time===0&&s.units.some(a=>a.team==='ally'&&a.life==='active'&&a.hp<a.maxHp*.9))command(s,{type:'skill',id:u.id});
   }
   if(s.node===3){
    const r=s.units.find(u=>u.id==='ranger')!,st=currentSkill(r);
    if(bought===0&&s.fragments>=40){act({type:'upgradeSkill',id:r.id,kind:'stage',expectedLevel:st.stage});bought++;}
    else if(bought===1&&s.fragments>=12){act({type:'upgradeSkill',id:'fiorre',kind:'branch',branch:'reach',expectedLevel:0});bought++;}
    else if(bought===2&&s.fragments>=24){act({type:'upgradeSkill',id:'fiorre',kind:'stage',expectedLevel:0});bought++;}
   }
   step(s,.1);
   const p=waveProgress(s),stamp=s.node+':'+p.current+':'+p.phase;
   if(stamp!==last){last=stamp;waves.push({node:s.node,time:s.time,...p,previews:p.previews.map(p=>p.id),balance:s.fragments,clones:s.units.filter(u=>u.cloneOf).length,units:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,life:u.life,hp:u.hp,durability:u.weapons[u.weaponIndex].durability}))});}
  }
  writeFileSync('../记录/验证/T-012/normal-progress.json',JSON.stringify({trace,waves,state:{phase:s.phase,result:s.result,kills:s.kills,spawned:s.spawned,total:s.totalEnemies,time:s.time,crystal:s.crystalHp,balance:s.fragments,units:s.units}},null,2));
  expect(s.result).toBe('victory');expect(s.spawned).toBe(s.totalEnemies);expect(s.waveState?.phase).toBe('complete');
 }
 prepare();act({type:'clone',id:'ines',to:{x:3,y:6}});play();const short={time:s.time,kills:s.kills,total:s.totalEnemies,crystal:s.crystalHp,balance:s.fragments};expect(short.total).toBe(19);expect(s.units.some(u=>u.cloneOf)).toBe(false);
 act({type:'continue'});expect(s.economy.account).toEqual({gold:20,vitality:20});act({type:'rest'});act({type:'enter',node:3});expect(s.waves).toHaveLength(12);expect(s.time).toBe(0);expect(s.economy.draws).toBe(0);expect(s.cards.some(c=>c.group==='scene')).toBe(true);
 prepare();act({type:'clone',id:'ines',to:{x:3,y:6}});play();const long={time:s.time,kills:s.kills,total:s.totalEnemies,crystal:s.crystalHp,balance:s.economy.audit.at(-1)?.before};expect(long.total).toBe(114);expect(bought).toBe(3);expect(s.economy.settled).toBe('success');expect(s.economy.account.gold).toBe(25);expect(s.economy.account.vitality).toBeGreaterThan(20);const bank={...s.economy.account};expect(command(s,{type:'abandon'}).ok).toBe(false);step(s,30);expect(s.economy.account).toEqual(bank);
 expect(bank.vitality).toBe(20+80+4*(short.kills+long.kills)-24-24-10+2-40-40-12-24);
 const intermissions=waves.filter(w=>w.phase==='intermission');expect(intermissions.filter(w=>w.node===1)).toHaveLength(2);expect(intermissions.filter(w=>w.node===3)).toHaveLength(11);expect(intermissions.every(w=>w.clones===1)).toBe(true);
 writeFileSync('../记录/验证/T-012/normal-complete.json',JSON.stringify({short,long,bank,trace,waves},null,2));
});
