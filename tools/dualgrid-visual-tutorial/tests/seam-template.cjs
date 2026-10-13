const {chromium}=require('../../../game/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation','400-atlas');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  assert.equal(await page.locator('#exportTemplateSeams').count(),1,'缺少接缝带模板下载');
  for(const [id,name,green]of [['exportTemplateSeams','绿色模板-1600-网格编号接缝带.png',true],['exportSeamGuides','接缝带网格编号参考层-1600.png',false]]){
   const p=page.waitForEvent('download');await page.locator('#'+id).click();await(await p).saveAs(path.join(out,name));
   const result=await page.evaluate(async(data)=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const at=(x,y)=>Array.from(g.getImageData(x,y,1,1).data);return {size:[im.width,im.height],empty:at(8,100),edge:at(8,300),inside:at(30,300),far:at(100,300),innerCut:at(100,208),fullEdge:at(808,700),emptyM00:at(8,1300)};},fs.readFileSync(path.join(out,name)).toString('base64'));
   assert.deepEqual(result.size,[1600,1600]);assert.equal(result.empty[3],0);assert.equal(result.emptyM00[3],0);
   assert.ok(result.edge[0]>result.edge[1]&&result.edge[1]>result.edge[2]);assert.ok(result.fullEdge[0]>result.fullEdge[1]);
   if(green){assert.deepEqual(result.inside,[41,181,43,255]);assert.deepEqual(result.far,result.inside);assert.deepEqual(result.innerCut,result.inside);}
   else{assert.equal(result.edge[3],230);assert.equal(result.inside[3],0);assert.equal(result.innerCut[3],0);}
  }
  await page.locator('#templateSeams').check();assert.ok(await page.evaluate(()=>document.querySelector('#templateSeamGuide').getContext('2d').getImageData(2,96,1,1).data[3]>0));
  await page.locator('#templateSeams').uncheck();assert.equal(await page.evaluate(()=>document.querySelector('#templateSeamGuide').getContext('2d').getImageData(2,96,1,1).data[3]),0);
  console.log('PASS: 接缝带只覆盖外框绿色区，14px带宽、内部分界不描边、透明独立层、在线开关');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
