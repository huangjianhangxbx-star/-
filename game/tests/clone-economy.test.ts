import {it,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
import {writeFileSync} from 'node:fs';
it('A25 original map uses only initial balance and real kill income for old/new copies',()=>{
 const s=createGame(),log:any[]=[];const trace=(action:string)=>log.push({action,time:s.time,kills:s.kills,balance:s.fragments,hp:s.crystalHp,phase:s.phase});
 const act=(c:Parameters<typeof command>[1])=>{const r=command(s,c);expect(r.ok,r.reason).toBe(true);trace(c.type);};
 expect(s.fragments).toBe(40);act({type:'weapon',id:'fiorre',index:0});act({type:'upgradeSkill',id:'ines',kind:'stage',expectedLevel:0});act({type:'start'});step(s,10.1);
 act({type:'deploy',id:'ranger',to:{x:3,y:4},facing:'east'});act({type:'deploy',id:'fiorre',to:{x:4,y:4},facing:'east'});act({type:'deploy',id:'ines',to:{x:2,y:6},facing:'east'});act({type:'move',id:'hunter',to:{x:3,y:5}});act({type:'skill',id:'ranger'});
 const advance=(predicate:()=>boolean)=>{for(let n=0;n<8000&&!predicate()&&s.phase==='battle';n++){for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active')){const st=currentSkill(u);if((u.skillId==='pain'&&st.counter>0||['hunt','prayer'].includes(u.skillId!)&&st.cd===0&&st.time===0)&&!u.path.length)command(s,{type:'skill',id:u.id});}step(s,.1);}trace('advance');if(!predicate())writeFileSync('../记录/验证/T-010/economy-failure.json',JSON.stringify({log,units:s.units},null,2));expect(predicate(),JSON.stringify(log)).toBe(true);};
 advance(()=>s.fragments>=20);act({type:'clone',id:'ines',to:{x:3,y:6}});const old=s.units.at(-1)!;expect(currentSkill(old).stage).toBe(1);
 advance(()=>s.fragments>=12);act({type:'upgradeSkill',id:'ines',kind:'branch',branch:'A',expectedLevel:0});expect(currentSkill(old).branches.A).toBeUndefined();
 advance(()=>s.fragments>=20);act({type:'clone',id:'ines',to:{x:2,y:5}});const fresh=s.units.at(-1)!;expect(currentSkill(fresh).branches.A).toBe(1);expect(s.units).toContain(old);
 advance(()=>currentSkill(old).counter>0||currentSkill(fresh).counter>0);const caster=currentSkill(old).counter>0?old:fresh;act({type:'skill',id:caster.id});act({type:'destroyClone',id:old.id});expect(s.units).toContain(fresh);
 act({type:'extract',id:'ines',via:'shadow'});advance(()=>s.phase==='result');expect(s.units.some(u=>u.cloneOf)).toBe(false);expect(s.fragments).toBe(40+s.kills*4-24-20-12-20);writeFileSync('../记录/验证/T-010/normal-economy.json',JSON.stringify({result:s.result,log,kills:s.kills,initial:40},null,2));
});
