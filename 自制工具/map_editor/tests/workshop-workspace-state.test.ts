import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkshopWorkspaceStore,readWorkshopWorkspaceState} from '../desktop/workshop-workspace-state.ts';
const camera={position:[4,3,2],target:[1,0,0],up:[0,1,0],zoom:2};
const state=()=>({version:1,projectId:'p',workspace:'module',assetId:'a',sceneId:'s',assets:{a:{activeCanvasId:'fine',selectedObjectIds:['o'],editObjectId:'o',objectMode:false}},editor:null,preview:{scope:'scene',sceneId:'s',modelCamera:{...camera,content:'model'},sceneCameras:{s:{...camera,content:'scene'}}},assembly:camera,layout:{preview:true,assets:false,hierarchy:true,inspector:false,width:310}});
test('persists only project-scoped UI metadata and world cameras, never unsaved sources or drafts',()=>{
 const data=new Map<string,string>(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=new WorkshopWorkspaceStore(storage);
 store.save('E:\\Projects\\one', {...state(),cells:[{x:99}],draft:{palette:['#ffffff']},assets:{a:{...state().assets.a,model:{cells:[1]}}}});
 assert.equal(store.lastRoot(),'E:/Projects/one');assert.deepEqual(store.read('e:/projects/one','p'),state());
 assert.equal(store.read('E:/Projects/two','p'),null);assert.equal(store.read('E:/Projects/one','other-id'),null);
 assert.ok(![...data.values()].join('').includes('cells'));assert.ok(![...data.values()].join('').includes('draft'));
 store.save('E:/Projects/two',{...state(),assetId:'other'});assert.equal(store.read('E:/Projects/one','p')?.assetId,'a');assert.equal(store.read('E:/Projects/two','p')?.assetId,'other');
});
test('rejects corrupt/oversized state, finite camera violations and inherited keys without blocking project open',()=>{
 assert.equal(readWorkshopWorkspaceState({...state(),version:2}),null);assert.equal(readWorkshopWorkspaceState({...state(),assembly:{...camera,zoom:Infinity}})?.assembly,null);
 const storage={getItem:()=>'{broken',setItem:()=>{throw Error('quota');}},store=new WorkshopWorkspaceStore(storage);assert.equal(store.lastRoot(),null);assert.equal(store.read('e:/p','p'),null);assert.doesNotThrow(()=>store.save('e:/p',state()));
 const raw=JSON.parse(JSON.stringify(state()));raw.assets=JSON.parse('{"__proto__":{"activeCanvasId":"evil"},"a":{"activeCanvasId":"fine","selectedObjectIds":["o"],"editObjectId":null,"objectMode":true}}');assert.equal(Object.hasOwn(readWorkshopWorkspaceState(raw)!.assets,'__proto__'),false);
});
