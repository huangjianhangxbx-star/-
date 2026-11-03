const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.argv[2]);
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage(),errors=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,800]]){
   await page.setViewportSize({width,height});await page.goto(pathToFileURL(path.join(root,'index.html')).href);
   await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
   const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:Array.from(document.images).map(i=>({src:i.src,width:i.naturalWidth})),links:Array.from(document.querySelectorAll('a[href]')).map(a=>a.href),warning:document.querySelector('.proposal').textContent}));
   if(state.overflow)throw Error(name+' horizontal overflow');
   if(!state.warning.includes('尚非 Unity 运行效果'))throw Error('Missing proposal warning');
   const pending=[];
   for(const href of state.links)if(href.startsWith('file:')&&!fs.existsSync(fileURLToPath(href))){if(process.argv.includes('--allow-pending-documents')&&/le04-continuous-rule-terrain/.test(href))pending.push(href);else throw Error('Missing local link '+href);}
   let interactions=0;
   for(const mode of ['straight','corner','junction']){
    await page.locator(`[data-path="${mode}"]`).click();
    for(let step=0;step<5;step++){
     await page.locator(`[data-step="${step}"]`).click();
     if(await page.locator('[data-step][aria-pressed="true"]').count()!==1)throw Error('Ambiguous current step');
     for(const progress of [20,65,100]){
      await page.locator('#progress').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},progress);
      const s=await page.evaluate(()=>({svg:document.querySelector('#new-view').innerHTML,tag:document.body.dataset.diagramState,copy:document.querySelector('#step-copy').textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
      if(!s.tag.startsWith(`${mode}:${step}:${progress}:`)||!s.copy||s.svg.includes('NaN')||s.overflow)throw Error('Broken interactive state '+s.tag);
      interactions++;
     }
    }
   }
   await page.locator('[data-path="corner"]').click();await page.locator('[data-step="4"]').click();await page.locator('#extend').check();
   if(await page.locator('.halo-boundary').count()!==1)throw Error('No local update highlight');
   const withLock=await page.locator('#new-view').innerHTML();await page.locator('#protect').uncheck();const noLock=await page.locator('#new-view').innerHTML();if(withLock===noLock)throw Error('Protection demonstration does not change');await page.locator('#protect').check();
   await page.locator('.workbench').screenshot({path:path.join(__dirname,name+'-drawing.png')});
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,name+'-top.png')});await page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});
   observations.push({name,width,height,images:state.images.length,localLinks:state.links.filter(x=>x.startsWith('file:')).length,interactiveStates:interactions+2,horizontalOverflow:false,pendingDocumentLinks:pending});
  }
  if(errors.length)throw Error(errors.join('\n'));
  const pending=observations.some(o=>o.pendingDocumentLinks.length);
  const report={status:pending?'PAGE_PASS_DOCUMENT_LINKS_PENDING':'PASS',scope:'Local explanatory page only. Schematic interaction is not Unity functionality, rendering, performance, Tiny Glade internals or a completed LE04 claim.',utc:new Date().toISOString(),observations,errors};
  fs.writeFileSync(path.join(__dirname,'page-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
