const {chromium}=require('../../../game/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation','400-atlas');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await browser.newPage({viewport:{width:1600,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  assert.equal(await page.locator('#exportTemplate400').count(),1,'缺少400格绿色模板');
  const download=page.waitForEvent('download');await page.locator('#exportTemplate400').click();await (await download).saveAs(path.join(out,'绿色模板-1600.png'));
  const check=async(file)=>page.evaluate(async(d)=>{const i=new Image();i.src='data:image/png;base64,'+d;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return {size:[i.width,i.height],blank:Array.from(g.getImageData(100,100,1,1).data),green:Array.from(g.getImageData(100,300,1,1).data)};},fs.readFileSync(file).toString('base64'));
  const template=await check(path.join(out,'绿色模板-1600.png'));assert.deepEqual(template.size,[1600,1600]);assert.equal(template.blank[3],0);assert.deepEqual(template.green,[41,181,43,255]);
  // 完整源400默认及400原图导出，不经384重采样。
  assert.equal(await page.locator('#result').getAttribute('width'),'400');
  const mother=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=400;const g=c.getContext('2d');g.fillStyle='#527896';g.fillRect(0,0,400,400);return c.toDataURL().split(',')[1];});
  await page.locator('#upload').setInputFiles({name:'mother400.png',mimeType:'image/png',buffer:Buffer.from(mother,'base64')});await page.waitForFunction(()=>document.querySelector('#sourceStatus').textContent.includes('mother400'));
  assert.match(await page.locator('#crossingText').textContent(),/400, 200/);
  const resultDownload=page.waitForEvent('download');await page.locator('#exportResult').click();await (await resultDownload).saveAs(path.join(out,'M07-400.png'));assert.deepEqual((await check(path.join(out,'M07-400.png'))).size,[400,400]);
  const fixture=await page.evaluate(()=>{const order=[4,10,13,12,9,14,15,7,2,3,11,5,0,8,6,1],c=document.createElement('canvas');c.width=c.height=1600;const g=c.getContext('2d');
   order.forEach((m,i)=>{const ox=i%4*400,oy=Math.floor(i/4)*400;g.fillStyle=`rgb(${20+i*10},${180-i*10},${100+i*10})`;for(const [x,y,b]of [[0,0,1],[1,0,2],[0,1,4],[1,1,8]])if(m&b)g.fillRect(ox+x*200,oy+y*200,200,200);});
   // M07空角上的手绘标记必须保留，不许再套自动蒙版。
   g.fillStyle='#ff00ff';g.fillRect(1200+350,400+350,20,20);g.clearRect(1200+20,400+20,20,20);g.fillStyle='rgba(50,100,150,0.5)';g.fillRect(1200+20,400+20,20,20);
   return c.toDataURL().split(',')[1];});
  const file=path.join(out,'test-painted-atlas-1600.png');fs.writeFileSync(file,Buffer.from(fixture,'base64'));
  await page.locator('#atlasUpload').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#atlasMessage').textContent.length>0);
  assert.match(await page.locator('#atlasStatus').textContent(),/test-painted/,await page.locator('#atlasMessage').textContent());
  assert.equal(await page.locator('#mapSource').inputValue(),'atlas');
  const want=[4,10,13,12,9,14,15,7,2,3,11,5,0,8,6,1];
  for(let slot=0;slot<16;slot++){
   await page.locator('#atlasSlots button').nth(slot).click();
   const m=want[slot],bit=[1,2,4,8].find(b=>m&b);
   const pix=await page.evaluate((b)=>{const x=(b===2||b===8)?300:100,y=(b===4||b===8)?300:100;const c=document.querySelector('#atlasSelected');return [c.width,c.height,...c.getContext('2d').getImageData(x,y,1,1).data];},bit||1);
   assert.deepEqual(pix,m===0?[400,400,0,0,0,0]:[400,400,20+slot*10,180-slot*10,100+slot*10,255]);
  }
  await page.locator('#atlasSlots button').nth(7).click();
  const unchanged=await page.evaluate(()=>{const g=document.querySelector('#atlasSelected').getContext('2d');return [Array.from(g.getImageData(355,355,1,1).data),g.getImageData(25,25,1,1).data[3]];});assert.deepEqual(unchanged,[[255,0,255,255],128]);
  const invalid=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1200;return c.toDataURL().split(',')[1];});
  await page.locator('#atlasUpload').setInputFiles({name:'bad1200.png',mimeType:'image/png',buffer:Buffer.from(invalid,'base64')});await page.waitForFunction(()=>document.querySelector('#atlasMessage').textContent.includes('1200 × 1200'));assert.match(await page.locator('#atlasStatus').textContent(),/test-painted/);
  await page.locator('#dataGrid').uncheck();await page.locator('#renderGrid').uncheck();await page.getByRole('button',{name:'全部填满',exact:true}).click();
  const sample=()=>page.evaluate(()=>{const c=document.querySelector('#renderMap');return Array.from(c.getContext('2d').getImageData(Math.floor(408*c.width/528),Math.floor(312*c.height/432),1,1).data);});assert.deepEqual(await sample(),[80,120,160,255]);
  await page.locator('#mapSource').selectOption('mother');assert.deepEqual(await sample(),[82,120,150,255]);await page.locator('#mapSource').selectOption('atlas');assert.deepEqual(await sample(),[80,120,160,255]);
  // 修改教学母版不会覆盖已导入的整图集。
  await page.locator('#demo').click();assert.deepEqual(await sample(),[80,120,160,255]);
  await page.getByRole('button',{name:'L 形',exact:true}).click();const b=await page.locator('#logicMap').boundingBox();await page.mouse.click(b.x+b.width/11*8,b.y+b.height/9*4);assert.equal(await page.locator('#affected button').count(),4);
  await page.locator('#atlasSection').screenshot({path:path.join(out,'05-整图集载入.png')});await page.locator('#mapSection').screenshot({path:path.join(out,'06-手绘图集试画.png')});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS: 400默认/原图导出、1600绿色模板、16槽原像素Alpha、错误尺寸保留、两模式切换、涂画、移动布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
