const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.argv[2]);
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,800]]){
   await page.setViewportSize({width,height});await page.goto(pathToFileURL(path.join(root,'index.html')).href);
   await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
   const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:document.images.length,links:Array.from(document.querySelectorAll('a[href]')).map(a=>a.href),faq:document.querySelectorAll('.recipe-faq dt').length,examples:document.querySelectorAll('.recipe-table tbody tr').length,copy:document.querySelector('#recipes').textContent,diagram:document.body.dataset.diagramState}));
   if(state.overflow)throw Error(name+' horizontal overflow');
   for(const href of state.links)if(href.startsWith('file:')&&!fs.existsSync(fileURLToPath(href)))throw Error('Missing local link '+href);
   if(state.faq!==3||state.examples!==3||!state.copy.includes('假想我方方案')||!state.copy.includes('本轮仍只做规则岩体')||!state.copy.includes('模型本身没有AI')||!state.copy.includes('不能在无解处任意塞方块'))throw Error('Incomplete clarification or scope');
   if(!state.diagram||!await page.locator('#new-view rect').count())throw Error('Existing diagram failed to initialize');
   await page.locator('#recipes').screenshot({path:path.join(__dirname,name+'-recipe-clarification.png')});
   observations.push({name,width,height,images:state.images,localLinks:state.links.filter(h=>h.startsWith('file:')).length,faqQuestions:state.faq,exampleRows:state.examples,horizontalOverflow:false});
  }
  if(errors.length)throw Error(errors.join('\n'));
  const report={status:'PASS',utc:new Date().toISOString(),scope:'Static FAQ/table clarification, links, images and responsive layout only. Existing diagrams initialize; unchanged 47-state interaction matrix is not repeated. No Unity functionality or hypothetical roof/stair implementation is tested.',observations,errors};
  fs.writeFileSync(path.join(__dirname,'recipe-clarification-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
