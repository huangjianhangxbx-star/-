const fs=require('fs');
const path=require('path');
const {chromium,expect}=require('../../../game/node_modules/@playwright/test');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],trace=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const click=async(selector)=>{await page.locator(selector).click();trace.push({click:selector});};
 const advance=async(dt)=>{await page.evaluate(async dt=>{const {step}=await import('/src/core/engine.ts');step(window.prototype.state,dt);},dt);trace.push({productionStep:dt});await page.waitForTimeout(80);};
 await page.goto('http://127.0.0.1:5173/');
 await expect(page.getByRole('button',{name:'进入战斗',exact:true})).toBeEnabled();
 await page.locator('[data-action="build"]').first().click();trace.push({click:'first build entry'});await click('[data-build-unit="ines"]');await click('[data-config-skill="sanctuary"]');await click('[data-buy-stage]');await click('[data-buy-branch="A"]');
 await click('[data-build-unit="ranger"]');await click('[data-config-skill="rain"]');await click('[data-build-unit="fiorre"]');await click('[data-config-skill="reap"]');
 const configured=await page.evaluate(()=>({fragments:window.prototype.state.fragments,units:window.prototype.state.units.filter(u=>u.team==='ally').map(u=>({id:u.id,asset:u.asset,skill:u.skillId}))}));
 expect(configured.fragments).toBe(4);
 await click('[data-action="close-build"]');await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 const point=async p=>page.evaluate(p=>window.prototype.project(p),p);
 await click('[data-unit="hunter"]');let p=await point({x:4.7,y:8});await page.mouse.click(p.x,p.y);await page.mouse.click(1200,300,{button:'right'});await advance(10);
 for(const [id,to] of [['ines',{x:6.6,y:8}],['fiorre',{x:5.7,y:8}],['ranger',{x:8,y:9}]]){await click(`[data-unit="${id}"]`);p=await point(to);await page.mouse.click(p.x,p.y);trace.push({deployClick:{id,to}});await page.mouse.click(1200,300,{button:'right'});}
 await page.screenshot({path:path.join(__dirname,'battle-models.png')});
 await advance(37);
 await click('[data-unit="ines"]');await expect(page.locator('[data-world-skill]')).toBeEnabled();await click('[data-world-skill]');await advance(.2);
 const field=await page.evaluate(()=>({time:window.prototype.state.time,fragments:window.prototype.state.fragments,units:window.prototype.state.units.filter(u=>u.team==='ally').map(u=>({id:u.id,life:u.life,asset:u.asset,skill:u.skillId,run:u.skillStates?.[u.skillId]?.run?.spec.id})),effects:window.prototype.state.skillEffects?.length||0}));
 expect(field.units.find(u=>u.id==='ines').run).toBe('sanctuary');
 await page.screenshot({path:path.join(__dirname,'battle-field.png')});
 fs.writeFileSync(path.join(__dirname,'ui-scene.json'),JSON.stringify({method:'Normal original map and starting 40 fragments; skill selection, purchase, deployment and field cast through actual UI. Production step accelerates observation only; no gameplay state is assigned.',configured,field,trace,errors,browser:browser.version()},null,2));
 expect(errors).toEqual([]);console.log(JSON.stringify({configured,field,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
