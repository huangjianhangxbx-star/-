// AR05: this frozen historical suite verifies the retained pre-Blue branch.

vi.mock('../src/core/hunter-state',async importActual=>({...await importActual<object>(),isHunterV2:()=>false}));
import {beforeEach,vi} from 'vitest';
import * as definitions from '../src/core/basic-definition';
const currentResolver=definitions.resolveBasicDefinition;
// Frozen AR02/AR03 contract regression explicitly exercises the retained legacy definition.
beforeEach(()=>{vi.spyOn(definitions,'resolveBasicDefinition').mockImplementation(u=>{const d=currentResolver(u);return d.id==='hunter-basic-v1'?definitions.BASIC_DEFINITIONS['legacy-main-basic']:d;});});
import {createHash} from 'node:crypto';
import {combatTraceSnapshot} from '../src/core/combat-identity';
import {test,expect} from 'vitest';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {cases,setup,frame,gameplay,identity} from './ar03-fixture';
const file=new URL('./fixtures/ar03-old-basic.json',import.meta.url);
test.skipIf(!process.env.AR03_RECORD_BASELINE)('freeze AR02 before any Basic runtime implementation',()=>{
 if(existsSync(new URL('../src/core/basic-runtime.ts',import.meta.url)))throw Error('Cannot replace old evidence with migrated source');
 const rows:any={};for(const kind of cases)for(const seed of [742,19]){const a=setup(kind,seed),states=[{game:gameplay(a.s),trace:identity(a.s),rawTraceHash:createHash('sha256').update(JSON.stringify(combatTraceSnapshot(a.s))).digest('hex')}];for(let i=0;i<60;i++){frame(a,kind,i);states.push({game:gameplay(a.s),trace:identity(a.s),rawTraceHash:createHash('sha256').update(JSON.stringify(combatTraceSnapshot(a.s))).digest('hex')});}rows[kind+'/'+seed]=states;}
 writeFileSync(file,JSON.stringify({baseline:'5cb9e488c30a472a729e01b4bcf0334271eb639b',rows},null,2));expect(Object.keys(rows)).toHaveLength(cases.length*2);
},90000);
test.skipIf(!!process.env.AR03_RECORD_BASELINE).each(cases)('%s preserves every old gameplay field and AR02 identity/outcomes',kind=>{
 const old=JSON.parse(readFileSync(file,'utf-8'));for(const seed of [742,19]){const a=setup(kind,seed),row=old.rows[kind+'/'+seed];expect(gameplay(a.s)).toBe(row[0].game);for(let i=0;i<60;i++){frame(a,kind,i);expect(gameplay(a.s),`seed=${seed},frame=${i}`).toBe(row[i+1].game);expect(identity(a.s),`trace seed=${seed},frame=${i}`).toBe(row[i+1].trace);}}
},90000);
