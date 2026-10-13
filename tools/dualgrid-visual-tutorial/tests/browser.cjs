// 真实本地页面 + 下载像素检查；不依赖游戏服务。
const {chromium}=require('../../../game/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'validation');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForSelector('#gallery button');
  assert.equal(await page.locator('#gallery button').count(),16);
  assert.equal(await page.locator('#variantTitle').textContent(),'M07 · 右下角要挖空');
  const png=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=c.height=384;const g=c.getContext('2d');
   g.fillStyle='#66868c';g.fillRect(0,0,384,384);
   for(let y=0;y<384;y+=96)for(let x=0;x<384;x+=96){g.fillStyle='#b5c8bd';g.fillRect(x+7,y+7,82,82);g.fillStyle='#90aaa2';g.fillRect(x+7,y+7,82,5);}
   return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(path.join(out,'test-seamless-384.png'),Buffer.from(png,'base64'));
  await page.locator('#upload').setInputFiles(path.join(out,'test-seamless-384.png'));
  await page.waitForFunction(()=>document.querySelector('#sourceStatus').textContent.includes('test-seamless'));
  // 错误尺寸必须拒绝，并保留上一个有效母版。
  const bad=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;return c.toDataURL().split(',')[1];});
  await page.locator('#upload').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from(bad,'base64')});
  await page.waitForFunction(()=>document.querySelector('#uploadMessage').textContent.includes('128 × 64'));
  assert.match(await page.locator('#sourceStatus').textContent(),/test-seamless/);
  await page.locator('#upload').setInputFiles(path.join(out,'test-seamless-384.png'));
  await page.getByRole('button',{name:'M09',exact:false}).click();
  const diag=await page.evaluate(()=>Array.from(document.querySelector('#result').getContext('2d').getImageData(192,192,1,1).data));
  assert.equal(diag[3],0);
  await page.getByRole('button',{name:'M07',exact:false}).click();
  const corners=await page.evaluate(()=>{const g=document.querySelector('#result').getContext('2d');return [[0,0],[383,0],[0,383],[383,383]].map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data));});
  assert.deepEqual(corners.map(p=>p[3]),[255,255,255,0]);
  // 真正触发下载，读取PNG再在浏览器解码检查，辅助棋盘不得参与导出。
  for(const [id,name] of [['exportMask','mask'],['exportResult','example']]){
   const pending=page.waitForEvent('download');await page.locator('#'+id).click();const dl=await pending;
   const file=path.join(out,'M07-'+name+'.png');await dl.saveAs(file);
   const data=fs.readFileSync(file).toString('base64');
   const pix=await page.evaluate(async(data)=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return {w:i.width,h:i.height,a:g.getImageData(383,383,1,1).data[3],first:Array.from(g.getImageData(0,0,1,1).data)};},data);
   assert.deepEqual([pix.w,pix.h,pix.a],[384,384,0]);
   assert.deepEqual(pix.first,name==='mask'?[255,255,255,255]:[102,134,140,255]);
  }
  await page.locator('#lesson').scrollIntoViewIfNeeded();
  await page.locator('#lesson').screenshot({path:path.join(out,'01-M07-绘制流程.png')});
  await page.getByRole('button',{name:'L 形',exact:true}).click();
  const logic=page.locator('#logicMap');const b=await logic.boundingBox();
  const px=b.width/11,py=b.height/9;
  // 空白处画两个新格；与教学算法独立的颜色及四邻居编号期望。
  await page.mouse.move(b.x+px*8,b.y+py*4);await page.mouse.down();
  await page.mouse.move(b.x+px*9,b.y+py*4,{steps:8});await page.mouse.up();
  assert.match(await page.locator('#affected').textContent(),/4 张/);
  assert.equal(await page.locator('#affected button').count(),4);
  assert.match(await page.locator('#affected').textContent(),/M12.*M04.*M03.*M01/);
  const mapPixel=await page.evaluate(()=>Array.from(document.querySelector('#logicMap').getContext('2d').getImageData(9*48+12,4*48+12,1,1).data));
  assert.deepEqual(mapPixel,[54,136,145,255]);
  await page.locator('#affected button').first().click();
  await page.locator('#mapSection').screenshot({path:path.join(out,'02-双网格地图对照.png')});
  // 右键实际擦掉新画的格，不能只切换工具视觉。
  const eraseBox=await logic.boundingBox();
  await page.mouse.click(eraseBox.x+eraseBox.width/11*9,eraseBox.y+eraseBox.height/9*4,{button:'right'});
  const erased=await page.evaluate(()=>Array.from(document.querySelector('#logicMap').getContext('2d').getImageData(9*48+12,4*48+12,1,1).data));
  assert.deepEqual(erased,[225,232,240,255]);
  await page.getByRole('button',{name:'独立一格',exact:true}).click();
  assert.match(await page.locator('#affected').textContent(),/M08.*M04.*M02.*M01/);
  await page.getByRole('button',{name:'斜向接触',exact:true}).click();
  assert.match(await page.locator('#affected').textContent(),/M09/);
  for(const name of ['横向长条','凹口','全部填满'])await page.getByRole('button',{name,exact:true}).click();
  assert.match(await page.locator('#affected').textContent(),/M15.*M15.*M15.*M15/);
  await page.locator('#dataGrid').uncheck();await page.locator('#renderGrid').uncheck();await page.locator('#weights').check();
  await page.getByRole('button',{name:'清空',exact:true}).click();
  const empty=await page.evaluate(()=>document.querySelector('#renderMap').getContext('2d').getImageData(40,25,1,1).data[3]);assert.equal(empty,0);
  await page.getByRole('button',{name:'M07',exact:false}).click();
  await page.locator('#maskTransparent').check();
  assert.equal(await page.evaluate(()=>document.querySelector('#mask').getContext('2d').getImageData(383,383,1,1).data[3]),0);
  await page.locator('#checkerToggle').uncheck();
  await page.locator('#steps button').nth(3).click();
  await page.locator('#inspect').click();assert.equal(await page.locator('#inspector').isVisible(),true);await page.locator('#closeInspector').click();
  const pending=page.waitForEvent('download');await page.locator('#exportAtlas').click();const atlas=await pending;await atlas.saveAs(path.join(out,'atlas-1536.png'));
  const atlasData=fs.readFileSync(path.join(out,'atlas-1536.png')).toString('base64');
  assert.deepEqual(await page.evaluate(async(d)=>{const i=new Image();i.src='data:image/png;base64,'+d;await i.decode();return [i.width,i.height];},atlasData),[1536,1536]);
  // 母版透明度必须保留，下载参考不把透明原图强行变不透明。
  const trans=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=384;const g=c.getContext('2d');g.fillStyle='rgba(20,40,60,0.5)';g.fillRect(0,0,384,384);g.clearRect(50,50,10,10);return c.toDataURL().split(',')[1];});
  await page.locator('#upload').setInputFiles({name:'transparent.png',mimeType:'image/png',buffer:Buffer.from(trans,'base64')});
  await page.waitForFunction(()=>document.querySelector('#sourceStatus').textContent.includes('transparent.png'));
  await page.getByRole('button',{name:'M15',exact:false}).click();
  const alpha=await page.evaluate(()=>{const g=document.querySelector('#result').getContext('2d');return [g.getImageData(0,0,1,1).data[3],g.getImageData(55,55,1,1).data[3]];});
  assert.deepEqual(alpha,[128,0]);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  // 在单独浏览器查看页重新打开下载PNG，真实棋盘仅由CSS提供。
  const viewer=await browser.newPage({viewport:{width:940,height:550}});
  const maskData=fs.readFileSync(path.join(out,'M07-mask.png')).toString('base64');
  const exampleData=fs.readFileSync(path.join(out,'M07-example.png')).toString('base64');
  await viewer.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>body{font:16px Microsoft YaHei;background:#edf2f7;color:#20344d;padding:20px}main{display:flex;gap:24px}figure{margin:0}img{width:384px;height:384px;border:1px solid #ccd8e4;background:conic-gradient(#c6cfd9 25%,#e1e6ec 0 50%,#c6cfd9 0 75%,#e1e6ec 0);background-size:20px 20px}</style><h2>重新打开下载PNG · 透明检查</h2><main><figure><figcaption>M07 蒙版 / 白色留，右下 Alpha = 0</figcaption><img src="data:image/png;base64,${maskData}"></figure><figure><figcaption>M07 示范 / 源坐标不变，右下 Alpha = 0</figcaption><img src="data:image/png;base64,${exampleData}"></figure></main><p>棋盘来自查看页CSS，下载PNG本身不含棋盘。</p></html>`);
  await viewer.locator('img').first().waitFor();await viewer.screenshot({path:path.join(out,'03-下载PNG透明检查.png')});await viewer.close();
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'passed',entry:'file://',screenshots:['01-M07-绘制流程.png','02-双网格地图对照.png'],checks:['16态/M07/对角','384PNG导入与128×64拒绝','L形与鼠标拖涂的实际网格像素','四关联渲染块与字面预期位权','右键擦除实际像素','六个示例/清空/辅助线开关','透明蒙版查看/步骤/像素查看弹窗','蒙版/示范真实下载透明像素','源RGB同坐标/半透明源Alpha','1536图集','390px无横向溢出','无pageerror']},null,2));
  console.log('PASS: file:// 导入、变体、涂画、透明下载、截图、图集、移动布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
