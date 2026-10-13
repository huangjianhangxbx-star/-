const {chromium}=require('../../../game/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation','400-atlas');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  assert.equal(await page.locator('#exportTemplateMarked').count(),1,'缺少带格线编号下载');
  // 屏幕查看开关与下载内容独立，不可误带选中橙框或丢掉标记。
  await page.locator('#templateLines').uncheck();await page.locator('#templateLabels').uncheck();
  for(const [id,name,base]of [['exportTemplateMarked','绿色模板-1600-带网格编号.png',true],['exportTemplateGuides','网格编号参考层-1600.png',false]]){
   const pending=page.waitForEvent('download');await page.locator('#'+id).click();const d=await pending;await d.saveAs(path.join(out,name));
   const pix=await page.evaluate(async(data)=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
    const at=(x,y)=>Array.from(g.getImageData(x,y,1,1).data);
    const labelCounts=Array.from({length:16},(_,i)=>{const a=g.getImageData(i%4*400+10,Math.floor(i/4)*400+10,110,50).data;let n=0;for(let p=3;p<a.length;p+=4)if(a[p])n++;return n;});
    return {size:[im.width,im.height],empty:at(100,100),green:at(100,300),line:at(400,100),half:at(200,80),labels:labelCounts};
   },fs.readFileSync(path.join(out,name)).toString('base64'));
   assert.deepEqual(pix.size,[1600,1600]);assert.equal(pix.empty[3],0);assert.deepEqual(pix.green,base?[41,181,43,255]:[0,0,0,0]);assert.equal(pix.line[3],255);assert.ok(pix.half[3]>0);assert.ok(pix.labels.every(n=>n>50));
  }
  console.log('PASS: 带标记模板及独立透明标记层，400实线/200虚线/16格编号区域/透明空区');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
