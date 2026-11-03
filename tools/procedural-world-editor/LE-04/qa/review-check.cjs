const fs=require('fs');const path=require('path');const{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');const{chromium}=require(path.resolve(root,'../../../game/node_modules/@playwright/test'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto(pathToFileURL(path.join(root,'review/index.html')).href);await page.waitForLoadState('load');
 if(await page.evaluate(()=>window.LE04_EVIDENCE?.status)!=='PASS')throw new Error('Actual workflow must pass before page review.');
 for(let i=0;i<8;i++){await page.locator('#stage-menu button').nth(i).click();await page.waitForFunction(()=>document.querySelector('#stage-image').complete&&document.querySelector('#stage-image').naturalWidth>0);}
 await page.locator('#compare').fill('25');const clip=await page.locator('#after').evaluate(e=>e.style.clipPath);if(!clip.includes('25%'))throw new Error('Compare control does not update actual images.');
 const images=await page.locator('img').evaluateAll(nodes=>nodes.map(e=>({src:e.getAttribute('src'),complete:e.complete,width:e.naturalWidth})));if(images.some(i=>!i.complete||!i.width))throw new Error('Missing actual images: '+JSON.stringify(images));
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Desktop overflow');await page.screenshot({path:path.join(root,'reports/review-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile overflow');await page.screenshot({path:path.join(root,'reports/review-mobile.png'),fullPage:true});
 if(errors.length)throw new Error(errors.join('; '));fs.writeFileSync(path.join(root,'reports/review-qa.json'),JSON.stringify({status:'PASS',browser:'Edge headless',viewports:[1440,390],stages:8,images,compareControl:true,overflow:false,errors},null,2));console.log('LE04 review PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
