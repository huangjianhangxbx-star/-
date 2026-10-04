import {it,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {writeFileSync} from 'node:fs';
it('real loss, retry and exhaustion retain spent costs and consume rewards only once',()=>{
 const s=createGame();s.economy.account={gold:50,vitality:60};expect(command(s,{type:'carry',gold:10,vitality:40}).ok).toBe(true);expect(command(s,{type:'draw'}).ok).toBe(true);const deck=s.cards.find(c=>c.group==='deck')!,log:any[]=[];
 const until=(check:()=>boolean)=>{for(let n=0;n<10000&&!check()&&s.phase==='battle';n++)step(s,.1);expect(check()).toBe(true);};
 for(let attempt=0;attempt<=2;attempt++){
  expect(command(s,{type:'start'}).ok).toBe(true);until(()=>s.kills>=1);const first=s.units.find(u=>u.team==='enemy'&&u.life==='dead');log.push({attempt,firstId:first?.id,balance:s.fragments,rewardCount:s.economy.rewards.length});expect(s.fragments).toBe(30+s.economy.rewards.length*4);expect(new Set(s.economy.rewards).size).toBe(s.economy.rewards.length);
  const move=command(s,{type:'move',id:'hunter',to:{x:6,y:2}});expect(move.ok,move.reason).toBe(true);until(()=>s.phase==='result');expect(s.result).toBe('defeat');
  if(attempt<2){expect(s.fragments).toBe(30+s.economy.rewards.length*4);expect(s.cards.some(c=>c.id===deck.id)).toBe(true);expect(s.economy.account).toEqual({gold:40,vitality:20});expect(command(s,{type:'continue'}).ok).toBe(true);expect(command(s,{type:'enter',node:1}).ok).toBe(true);expect(s.economy.draws).toBe(0);expect(s.cards.filter(c=>c.group==='scene')).toHaveLength(0);}
 }
 expect(s.canStay).toBe(false);expect(s.economy.settled).toBe('failure');expect(s.economy.account).toEqual({gold:40,vitality:20});expect(s.fragments).toBe(0);expect(s.cards).toHaveLength(0);expect(command(s,{type:'continue'}).ok).toBe(true);expect(s.phase).toBe('ended');expect(command(s,{type:'newExpedition'}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);expect(s.economy.rewards).toHaveLength(0);writeFileSync('../记录/验证/T-012/normal-failure.json',JSON.stringify({log,account:s.economy.account,audit:s.economy.audit},null,2));
});
