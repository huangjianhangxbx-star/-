import test from 'node:test';
import assert from 'node:assert/strict';
import {setShortcut,resetShortcuts} from '../desktop/selection-shortcuts.ts';
test('selection remapping cannot shadow the plain T Q E modeling tools',()=>{
 (globalThis as any).localStorage={setItem(){},removeItem(){}};
 try{for(const key of ['T','Q','E'])assert.throws(()=>setShortcut('move',key),/此按键/);}finally{resetShortcuts();}
 // Modified keys remain usable for user remapping.
 try{setShortcut('move','Ctrl+T');}finally{resetShortcuts();}
});
test('older saved selection mappings yield T Q E back to the modeling tools',async()=>{
 (globalThis as any).localStorage={getItem(){return JSON.stringify({copy:'T',paste:'Q',move:'E'});},setItem(){},removeItem(){}};
 const url=new URL('../desktop/selection-shortcuts.ts?tool-key-migration',import.meta.url).href;
 const migrated=await import(url);
 assert.deepEqual(migrated.getShortcuts(),{copy:'Ctrl+C',paste:'Ctrl+V',move:'G'});
});
