const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.argv[2]);
const root=path.resolve(__dirname,'..');
const allowPending=process.argv.includes('--allow-pending-documents');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],observations=[];
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['tablet',900,1000],['mobile',390,844],['small-mobile',320,800]]){
   await page.setViewportSize({width,height});
   await page.goto(pathToFileURL(path.join(root,'index.html')).href);
   const state=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    status:document.querySelector('.status').textContent,
    text:document.body.textContent,
    links:Array.from(document.querySelectorAll('a[href]')).map(a=>({raw:a.getAttribute('href'),url:a.href})),
    taskRows:document.querySelectorAll('.schedule tbody tr').length,
    diagrams:document.querySelectorAll('svg').length
   }));
   if(state.overflow)throw Error(name+' horizontal overflow');
   if(!state.status.includes('尚未实施'))throw Error('Missing planning status');
   if(!state.text.includes('不要求网格焊接或体积融合'))throw Error('Missing separate geometry scope');
   if(!state.text.includes('具体雪岩分层及其美术构件规则不在本夜范围'))throw Error('Missing snowrock exclusion from A');
   if(state.taskRows!==7)throw Error('Expected tasks 0 through 6');
   const pending=[];
   for(const link of state.links){
    if(link.raw.startsWith('#')){
     if(!await page.locator(link.raw).count())throw Error('Broken section '+link.raw);
    }else if(link.url.startsWith('file:')&&!fs.existsSync(fileURLToPath(link.url))){
     if(allowPending&&/2026-11-03-le04-/.test(link.url))pending.push(link.url);
     else throw Error('Missing local file '+link.url);
    }
   }
   await page.screenshot({path:path.join(__dirname,name+'-top.png')});
   await page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});
   await page.locator('#routes').screenshot({path:path.join(__dirname,name+'-routes.png')});
   if(width===1440||width===390)await page.locator('#night').screenshot({path:path.join(__dirname,name+'-schedule.png')});
   observations.push({name,width,height,horizontalOverflow:state.overflow,taskRows:state.taskRows,diagrams:state.diagrams,localLinks:state.links.filter(l=>l.url.startsWith('file:')&&!l.raw.startsWith('#')).length,pendingDocumentLinks:pending});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(pathToFileURL(path.join(root,'../plan-explainer/index.html')).href);
  const banner=page.locator('#superseded-notice');
  if(!await banner.count()||!await banner.textContent().then(t=>t.includes('2026-11-03')))throw Error('Old page has no superseded notice');
  if(await banner.locator('a').getAttribute('href')!=='../overnight-plan/index.html')throw Error('Old page new-plan link incorrect');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Old notice causes horizontal overflow');
  await page.screenshot({path:path.join(__dirname,'old-page-superseded-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});await page.reload();
  await banner.screenshot({path:path.join(__dirname,'old-page-superseded-desktop.png')});
  const pending=observations.some(o=>o.pendingDocumentLinks.length);
  fs.writeFileSync(path.join(__dirname,'page-qa.json'),JSON.stringify({status:errors.length?'FAIL':pending?'PAGE_PASS_DOCUMENT_LINKS_PENDING':'PASS',scope:'Local plan page and old-page superseded notice only; not Unity functionality or performance. No desktop control.',utc:new Date().toISOString(),observations,oldPageNoticeChecked:true,errors},null,2));
  if(errors.length)throw Error(errors.join('\n'));
  process.stdout.write('OVERNIGHT_PAGE_QA '+(pending?'PAGE_PASS_DOCUMENT_LINKS_PENDING':'PASS')+'\n');
 }finally{await browser.close();}
})().catch(e=>{process.stderr.write(String(e.stack||e));process.exitCode=1;});