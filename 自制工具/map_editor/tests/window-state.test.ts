import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {safeWindowState}=require('../desktop/window-state.cjs');
const screens=[{workArea:{x:0,y:0,width:1920,height:1080}},{workArea:{x:1920,y:0,width:1280,height:720}}];
test('window placement restores normal bounds and maximized intent, safely returns disconnected screens',()=>{
 assert.deepEqual(safeWindowState({version:1,bounds:{x:2100,y:50,width:1050,height:700},maximized:true},screens),{bounds:{x:2100,y:20,width:1050,height:700},maximized:true});
 const off=safeWindowState({version:1,bounds:{x:-9000,y:8000,width:5000,height:3000},maximized:false},screens);assert.equal(off.bounds.width,1920);assert.equal(off.bounds.height,1080);assert.equal(off.bounds.x,0);assert.equal(off.bounds.y,0);
 assert.equal(safeWindowState({version:1,bounds:{x:0,y:0,width:NaN,height:700}},screens).bounds.width,1500);
});
