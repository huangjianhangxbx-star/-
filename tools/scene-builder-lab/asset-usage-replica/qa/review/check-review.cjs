const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),{chromium}=require(path.resolve(root,'../../../game/node_modules/@playwright/test'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'review/index.html')).href);await page.waitForLoadState('load');
  await page.locator('#assets').scrollIntoViewIfNeeded();await page.locator('#evidence').scrollIntoViewIfNeeded();
  const images=await page.locator('img').evaluateAll(nodes=>nodes.map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})));
  if(images.some(e=>!e.loaded))throw Error('Unloaded image '+JSON.stringify(images.filter(e=>!e.loaded)));
  if(await page.locator('.asset').count()!==9)throw Error('Missing role previews');
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(e=>e.getAttribute('href')));
  const missing=links.filter(p=>!p.startsWith('#')&&!/^https?:/.test(p)&&!fs.existsSync(path.resolve(root,'review',decodeURIComponent(p.split('#')[0]))));
  if(missing.length)throw Error('Missing links '+missing.join(','));
  await page.getByRole('button',{name:'看 A',exact:true}).click();
  if(await page.locator('#reveal').inputValue()!=='0')throw Error('A button failed');
  await page.getByRole('button',{name:'看 B',exact:true}).click();
  if(await page.locator('#reveal').inputValue()!=='100')throw Error('B button failed');
  await page.locator('#reveal').fill('35');await page.locator('#reveal').dispatchEvent('input');
  if(await page.locator('#comparison').evaluate(e=>e.style.getPropertyValue('--reveal'))!=='35%')throw Error('Compare range failed');
  await page.getByRole('button',{name:'对半',exact:true}).click();
  await page.locator('summary').click();if(await page.locator('details').getAttribute('open')===null)throw Error('Details failed');
  await page.locator('summary').click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Desktop overflow');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'review-desktop.png')});
  await page.locator('#swap').screenshot({path:path.join(__dirname,'review-comparison.png')});
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'review-mobile.png')});
  if(errors.length)throw Error(errors.join(';'));
  const result={status:'PASS',scope:'Only public review-page layout, local links, image loading and comparison/details interactions. No game, Unity or physical desktop control.',imagesChecked:images.length,assetRoles:9,linksChecked:links.length,viewports:[1440,390],interactions:['A button','B button','comparison range','half compare','technical details'],errors};
  fs.writeFileSync(path.join(__dirname,'review-qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
