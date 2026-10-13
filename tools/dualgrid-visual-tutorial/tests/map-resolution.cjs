const {chromium}=require('../../../game/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1600;const g=c.getContext('2d');g.fillStyle='#123456';g.fillRect(0,0,1600,1600);g.fillStyle='#ff0000';g.fillRect(840,400,1,400);return c.toDataURL().split(',')[1];});
  await page.locator('#atlasUpload').setInputFiles({name:'one-pixel-detail.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.querySelector('#atlasStatus').textContent.includes('one-pixel'));
  await page.locator('#dataGrid').uncheck();await page.locator('#renderGrid').uncheck();await page.getByRole('button',{name:'全部填满',exact:true}).click();
  const detail=await page.evaluate(()=>{const c=document.querySelector('#renderMap'),s=c.width/11,g=c.getContext('2d');return Array.from(g.getImageData(Math.floor((8+40/400)*s),Math.floor((6+125/400)*s),1,1).data);});
  assert.deepEqual(detail,[255,0,0,255],'400素材的单像素红线在地图中丢失');
  assert.deepEqual(await page.evaluate(()=>{const c=document.querySelector('#renderMap');return [c.width,c.height];}),[4400,3600]);
  await page.locator('#mapPreviewZoom').selectOption('1');
  assert.equal(await page.locator('#renderMap').evaluate(e=>e.getBoundingClientRect().width),4400);
  await page.locator('#mapPreviewZoom').selectOption('fit');
  await page.locator('#openMapDetail').click();assert.ok(await page.locator('#mapDetail').isVisible());
  await page.locator('#mapDetailZoom').selectOption('2');assert.equal(await page.locator('#mapDetailCanvas').evaluate(e=>e.getBoundingClientRect().width),8800);await page.locator('#closeMapDetail').click();
  // 原位点击仍按11×9虚拟格定位，不随高清像素倍率漂移。
  const c=page.locator('#renderMap'),box=await c.boundingBox();await page.mouse.click(box.x+box.width/11*8.5,box.y+box.height/9*6.5);
  assert.match(await page.locator('#atlasSelectedTitle').textContent(),/M15/);
  const pending=page.waitForEvent('download');await page.locator('#exportMapNative').click();const d=await pending;const file=path.join(root,'validation','400-atlas','地图-原像素清晰度.png');await d.saveAs(file);
  assert.deepEqual(await page.evaluate(async(data)=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();return [i.width,i.height];},fs.readFileSync(file).toString('base64')),[4400,3600]);
  await page.locator('#mapSection').screenshot({path:path.join(root,'validation','400-atlas','07-原像素地图预览.png')});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS: 400原像素细线、4400×3600整图、原尺寸/200%查看、点击坐标、原图导出、移动布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
