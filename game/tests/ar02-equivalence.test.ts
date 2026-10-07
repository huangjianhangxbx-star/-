import {beforeEach,vi} from 'vitest';
import * as definitions from '../src/core/basic-definition';
const currentResolver=definitions.resolveBasicDefinition;
// Frozen AR02/AR03 contract regression explicitly exercises the retained legacy definition.
beforeEach(()=>{vi.spyOn(definitions,'resolveBasicDefinition').mockImplementation(u=>{const d=currentResolver(u);return d.id==='hunter-basic-v1'?definitions.BASIC_DEFINITIONS['legacy-main-basic']:d;});});
import {expect,test} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {arena,frame,fingerprint,projection,scenarios} from './ar02-fixture';
import {command,step} from '../src/core/engine';
import {configureCombatTrace} from '../src/core/combat-identity';
const file=new URL('./fixtures/ar02-gameplay-baseline.json',import.meta.url);

test.skipIf(!process.env.AR02_RECORD_BASELINE)('record the untouched AR01 gameplay baseline before any bridge code',()=>{
 if(existsSync(new URL('../src/core/combat-identity.ts',import.meta.url)))throw new Error('Baseline recorder is pre-bridge only; never replace frozen old evidence with current code.');
 const paths:Record<string,string[]>={};
 for(const skill of scenarios)for(const seed of [742,19]){
  const a=arena(skill,seed),values=[fingerprint(a.s)];
  for(let i=0;i<80;i++){frame(a,i);values.push(fingerprint(a.s));}
  paths[skill+'/'+seed]=values;
 }
 mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
 writeFileSync(file,JSON.stringify({baseline:'62a0dc8df9f34c94616fdca2f9a3bb7c0bd41e9c',frames:paths},null,2)+'\n');
},90000);

test('valid guard poison threshold matches separately frozen old Git source, not a rewritten baseline',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./fixtures/ar02-poison-guard-baseline.json',import.meta.url),'utf-8'));
 for(const seed of [742,19]){
  const a=arena('poison',seed),b=arena('poison',seed);
  for(const v of [a,b]){v.h.weapons[v.h.weaponIndex].profession='guard';v.e.poisonMeter=1000;}
  configureCombatTrace(a.s,true);configureCombatTrace(b.s,false);
  expect(fingerprint(a.s)).toBe(baseline.frames[seed][0]);
  for(const v of [a,b])command(v.s,{type:'basic',id:v.h.id,aim:v.e.pos,requestId:1});
  for(let i=0;i<12;i++){step(a.s,.05);step(b.s,.05);expect(projection(a.s)).toBe(projection(b.s));expect(fingerprint(a.s)).toBe(baseline.frames[seed][i+1]);}
 }
});

test.skipIf(!!process.env.AR02_RECORD_BASELINE).each(scenarios)('%s preserves every old field with trace on/off and against the pre-bridge baseline',async skill=>{
 const {configureCombatTrace,combatTraceSnapshot}=await import('../src/core/combat-identity');
 const baseline=JSON.parse(readFileSync(file,'utf-8'));
 for(const seed of [742,19]){
  const a=arena(skill,seed),b=arena(skill,seed);configureCombatTrace(a.s,true);configureCombatTrace(b.s,false);
  expect(fingerprint(a.s)).toBe(baseline.frames[skill+'/'+seed][0]);
  for(let i=0;i<80;i++){
   frame(a,i);frame(b,i);
   expect(projection(a.s),`seed ${seed}, frame ${i}`).toBe(projection(b.s));
   expect(fingerprint(a.s),`old baseline seed ${seed}, frame ${i}`).toBe(baseline.frames[skill+'/'+seed][i+1]);
  }
  expect(combatTraceSnapshot(a.s).length).toBeGreaterThan(0);expect(combatTraceSnapshot(b.s)).toEqual([]);
 }
},90000);
