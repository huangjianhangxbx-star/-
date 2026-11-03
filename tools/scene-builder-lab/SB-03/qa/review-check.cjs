const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),{chromium}=require(path.resolve(root,'../../../game/node_modules/@playwright/test'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto(pathToFileURL(path.join(root,'review/index.html')).href);await page.waitForLoadState('load');
 for(let i=0;i<9;i++){await page.locator('.source').nth(i).click();await page.waitForFunction(()=>{const e=document.getElementById('source-usage');return e.complete&&e.naturalWidth>0});if(!await page.locator('#source-title').textContent())throw Error('Missing source title');}
 const images=await page.locator('img').evaluateAll(nodes=>nodes.map(e=>({src:e.getAttribute('src'),width:e.naturalWidth,complete:e.complete})));if(images.some(e=>!e.complete||!e.width))throw Error('Broken image');
 const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(e=>e.getAttribute('href')));const missing=links.filter(p=>!p.startsWith('http')&&!p.startsWith('#')&&!fs.existsSync(path.resolve(root,'review',decodeURIComponent(p))));if(missing.length)throw Error('Missing links '+missing.join(','));
 await page.locator('.source').first().click();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Desktop overflow');await page.screenshot({path:path.join(root,'reports/review-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');await page.screenshot({path:path.join(root,'reports/review-mobile.png'),fullPage:true});if(errors.length)throw Error(errors.join(';'));
 fs.writeFileSync(path.join(root,'reports/review-qa.json'),JSON.stringify({status:'PASS',sources:9,images,linksChecked:links.length,viewports:[1440,390],overflow:false,errors},null,2));console.log('SB03 review PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
