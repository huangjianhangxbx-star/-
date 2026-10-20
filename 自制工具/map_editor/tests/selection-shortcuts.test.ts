import test from 'node:test';
import assert from 'node:assert/strict';
import {getShortcuts,setShortcut,resetShortcuts,shortcutKey} from '../desktop/selection-shortcuts.ts';
test('selection shortcuts can be remapped and reject duplicate/reserved keys',()=>{
 (globalThis as any).localStorage={setItem(){},removeItem(){}};
 setShortcut('copy','Ctrl+K');assert.equal(getShortcuts().copy,'Ctrl+K');
 assert.throws(()=>setShortcut('paste','Ctrl+K'));assert.throws(()=>setShortcut('move','Ctrl+S'));
 assert.equal(shortcutKey({ctrlKey:true,key:'k'} as any),'Ctrl+K');resetShortcuts();assert.equal(getShortcuts().copy,'Ctrl+C');
});
