const {chromium}=require('../../../game/node_modules/playwright');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {pathToFileURL}=require('node:url');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  assert.equal(await page.locator('#randomRotate').count(),1,'缺少随机90度旋转开关');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=400;const g=c.getContext('2d');for(const [x,y,color]of [[0,0,'rgba(255,0,0,0.5)'],[200,0,'#00ff00'],[0,200,'#0000ff'],[200,200,'#e09020']]){g.fillStyle=color;g.fillRect(x,y,200,200);}return c.toDataURL().split(',')[1];});
  await page.locator('#randomUpload').setInputFiles({name:'directional.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.querySelectorAll('#randomVariants article').length===1);
  const sample=()=>page.evaluate(()=>{const c=document.querySelector('#randomTiles'),g=c.getContext('2d');return Array.from({length:48},(_,i)=>[[100,100],[300,100],[100,300],[300,300]].map(([x,y])=>Array.from(g.getImageData(i%8*400+x,Math.floor(i/8)*400+y,1,1).data)));});
  const r=[255,0,0,128],g=[0,255,0,255],b=[0,0,255,255],o=[224,144,32,255],patterns=[[r,g,b,o],[b,r,o,g],[o,b,g,r],[g,o,r,b]];
  const fixed=await sample();assert.ok(fixed.every(p=>JSON.stringify(p)===JSON.stringify(patterns[0])));
  await page.locator('#randomRotate').check();const rotated=await sample();assert.equal(new Set(rotated.map(p=>JSON.stringify(p))).size,4);assert.ok(rotated.every(p=>patterns.some(w=>JSON.stringify(w)===JSON.stringify(p))));
  await page.locator('#randomSeams').uncheck();await page.locator('#randomNumbers').check();assert.deepEqual(await sample(),rotated);
  await page.locator('#randomReroll').click();assert.notDeepEqual(await sample(),rotated);await page.locator('#randomSeed').fill('1');await page.locator('#randomApplySeed').click();assert.deepEqual(await sample(),rotated);
  await page.locator('#randomRotate').uncheck();assert.deepEqual(await sample(),fixed);await page.locator('#randomRotate').check();assert.deepEqual(await sample(),rotated);
  const pending=page.waitForEvent('download');await page.locator('#randomExport').click();const dl=await pending;assert.match(dl.suggestedFilename(),/随机90度/);const file=path.join(root,'validation','400-atlas','随机母版-90度旋转.png');await dl.saveAs(file);
  assert.deepEqual(await page.evaluate(async(d)=>{const im=new Image();im.src='data:image/png;base64,'+d;await im.decode();return [im.width,im.height];},fs.readFileSync(file).toString('base64')),[3200,2400]);
  await page.locator('#randomSection').screenshot({path:path.join(root,'validation','400-atlas','09-母版随机90度旋转.png')});
  console.log('PASS: 0/90/180/270像素方向及Alpha、默认不旋转、辅助开关稳定、种子复现、恢复原向、PNG旋转导出');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
