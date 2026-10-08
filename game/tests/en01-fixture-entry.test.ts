import {test,expect} from 'vitest';
import {createGame} from '../src/core/engine';
test('EN01 fixture uses the main dungeon and one isolated V2 enemy; normal entry remains legacy',async()=>{
 const path='../src/core/en01-fixture.ts',api=await import(/* @vite-ignore */path).catch(()=>undefined);
 expect(api).toBeDefined();if(!api)return;
 const s=api.createEnemyFixture();expect(s.exploration?.definition.kind).toBe('standalone');
 expect(s.units.filter((u:any)=>u.team==='enemy')).toHaveLength(1);
 expect(s.units.filter((u:any)=>u.team==='enemy')[0].enemyV2?.profile.source).toBe('EN01 FIXTURE');
 expect(s.units.find((u:any)=>u.id==='hunter')?.basicProfileId).toBe('hunter-v2');
 expect(s.units.find((u:any)=>u.id==='ranger')?.basicProfileId).toBe('al-basic-v1');
 expect(createGame().units.some(u=>u.enemyV2)).toBe(false);
});
