const {test}=require('node:test');
const assert=require('node:assert/strict');
let core={}; try {core=require('../core.js');} catch(e) {if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('M07保留三个角并挖空右下，完整与空白不丢像素',()=>{
  assert.equal(typeof core.alphaAt,'function');
  for(const [x,y,a] of [[0,0,255],[383,0,255],[0,383,255],[383,383,0]]) assert.equal(core.alphaAt(7,x,y),a);
  assert.ok(core.maskAlpha(15).every(a=>a===255));
  assert.ok(core.maskAlpha(0).every(a=>a===0));
});
test('两个对角状态中心断开且不改变角位权',()=>{
  assert.equal(typeof core.alphaAt,'function');
  for(const m of [6,9])assert.equal(core.alphaAt(m,192,192),0);
  for(let m=0;m<16;m++)for(const [x,y,b] of [[0,0,1],[383,0,2],[0,383,4],[383,383,8]])assert.equal(core.alphaAt(m,x,y),(m&b)?255:0);
});
test('同一共边两个状态的384个Alpha逐像素相同，包含对角',()=>{
  assert.equal(typeof core.alphaAt,'function');
  for(let a=0;a<16;a++)for(let b=0;b<16;b++){
    if(Boolean(a&2)===Boolean(b&1)&&Boolean(a&8)===Boolean(b&4))for(let p=0;p<384;p++)assert.equal(core.alphaAt(a,383,p),core.alphaAt(b,0,p));
    if(Boolean(a&4)===Boolean(b&1)&&Boolean(a&8)===Boolean(b&2))for(let p=0;p<384;p++)assert.equal(core.alphaAt(a,p,383),core.alphaAt(b,p,0));
  }
});
test('单数据格的四个半格渲染邻居分别取右下8、左下4、右上2、左上1',()=>{
  assert.equal(typeof core.tileMask,'function');
  assert.deepEqual([core.tileMask([[1]],-1,-1),core.tileMask([[1]],0,-1),core.tileMask([[1]],-1,0),core.tileMask([[1]],0,0)],[8,4,2,1]);
  assert.equal(core.tileMask([[1,1],[1,0]],0,0),7);
});
test('M07只有右下两边穿越，整满没有轮廓穿越',()=>{
  assert.equal(typeof core.crossings,'function');
  assert.deepEqual(core.crossings(7),['right','bottom']); assert.deepEqual(core.crossings(15),[]);
});
