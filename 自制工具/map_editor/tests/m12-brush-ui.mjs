import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
const app=await electron.launch({args:process.env.XH_EDITOR_EXE?['--workspace=legacy','--test-hidden']:['.','--workspace=legacy','--test-hidden'],executablePath:process.env.XH_EDITOR_EXE??'node_modules/electron/dist/electron.exe'});
try{const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.locator('[data-mode="volume"]').click();await page.locator('#brush-size').fill('3',{timeout:3000});await page.locator('#thickness').fill('4');await page.locator('#top').click();
const r=await page.locator('#editview canvas').boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await page.waitForFunction(()=>document.querySelector('#count').textContent==='体素 36');
await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='体素 0');assert.deepEqual(errors,[]);console.log('M12_BRUSH_UI_PASS');
}finally{await app.evaluate(({app})=>app.exit(0));}
