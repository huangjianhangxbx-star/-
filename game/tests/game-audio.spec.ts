import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('formal audio shares one context and F10 observes the parent session',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{const Native=window.AudioContext;let count=0;(window as any).__audioContexts=()=>count;(window as any).AudioContext=class extends Native{constructor(...args:ConstructorParameters<typeof AudioContext>){super(...args);count++;}};});
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.phase),{timeout:30000}).toBe('battle');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.audio.inspect().context)).toBe('running');
 expect(await page.evaluate(()=>(window as any).__audioContexts())).toBe(1);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.audio.inspect().music.id),{timeout:3000}).toBe('explore');
 const world=await page.evaluate(()=>(window as any).prototype.audio.inspect().world);
 const before=await page.evaluate(()=>(window as any).prototype.audio.inspect().music.epoch);
 await page.evaluate(async()=>{const audio=(window as any).prototype.audio;await audio.unlockFromGesture();await audio.unlockFromGesture();});
 expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().music.epoch)).toBe(before);
 await page.keyboard.press('F10');await expect(page.getByText('F10 · 现场音频监控')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().world)).toBe(world);
 await page.locator('[data-audio-snapshot]').click();expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().snapshots.some((s:any)=>s.token==='f10-monitor-snapshot'))).toBe(true);
 await page.keyboard.press('F10');expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().snapshots.some((s:any)=>s.token==='f10-monitor-snapshot'))).toBe(false);
});

test('virtual world loops release real voices and resume only in range',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const state=await page.evaluate(async()=>{const audio=(window as any).prototype.audio;audio.setListener({x:0,y:0});audio.registerEmitter({id:'test-loop',eventId:'world.ambience',world:audio.currentWorld,position:{x:40,y:0},radius:5});const far=audio.inspect();audio.updateEmitter('test-loop',{x:1,y:0});const near=audio.inspect();audio.updateEmitter('test-loop',{x:40,y:0});const left=audio.inspect();await new Promise(resolve=>setTimeout(resolve,80));audio.setListener({x:0,y:0});audio.updateEmitter('test-loop',{x:1,y:0});const returned=audio.inspect();audio.removeEmitter('test-loop');return {far,near,left,returned,removed:audio.inspect()};});
 expect(state.far.emitters.find((e:any)=>e.id==='test-loop').virtual).toBe(true);
 expect(state.near.voices.filter((v:any)=>v.sourceId==='test-loop')).toHaveLength(1);
 expect(state.left.emitters.find((e:any)=>e.id==='test-loop').virtual).toBe(true);
 expect(state.returned.voices.filter((v:any)=>v.sourceId==='test-loop'),JSON.stringify({left:state.left,returned:state.returned})).toHaveLength(1);
 expect(state.removed.emitters.find((e:any)=>e.id==='test-loop')).toBeUndefined();
});

test('a stopped emitter can reactivate when still in range',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const result=await page.evaluate(async()=>{const audio=(window as any).prototype.audio;audio.setListener({x:0,y:0});audio.registerEmitter({id:'test-restart',eventId:'world.ambience',world:audio.currentWorld,position:{x:1,y:0},radius:5});const first=audio.inspect().voices.find((v:any)=>v.sourceId==='test-restart')?.id;audio.stopScope('test-restart','test');await new Promise(resolve=>setTimeout(resolve,80));audio.setListener({x:0,y:0});audio.updateEmitter('test-restart',{x:1,y:0});const after=audio.inspect();audio.removeEmitter('test-restart');return {first,after};});
 expect(result.first).toBeDefined();
 expect(result.after.emitters.find((e:any)=>e.id==='test-restart').virtual,JSON.stringify(result.after)).toBe(false);
 expect(result.after.voices.find((v:any)=>v.sourceId==='test-restart')?.id).not.toBe(result.first);
});

test('monitor counts music transitions and stop-all clears live music voices',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const result=await page.evaluate(()=>{const audio=(window as any).prototype.audio;audio.setDiagnosticMusic('combat',1);audio.stinger('victory');const before=audio.inspect();audio.stopAll();return {before,after:audio.inspect()};});
 expect(result.before.music.layers).toBeGreaterThan(3);
 expect(result.after.music.layers).toBe(0);
 expect(result.after.music.id).toBe('silent');
});

test('ordinary sound toggle names the master scope it actually mutes',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const control=page.locator('[data-action="sound"]');await expect(control).toHaveText('全部声音：开');await control.click();await expect(control).toHaveText('全部声音：关');
 expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().master.muted)).toBe(true);
});

test('a burst of low and high priority requests stays inside the physical voice budget',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const result=await page.evaluate(()=>{const audio=(window as any).prototype.audio;for(let i=0;i<90;i++)audio.cue('battle.loot','pressure-low-'+i);for(let i=0;i<90;i++)audio.cue('reference.hurt','pressure-high-'+i);return audio.inspect();});
 expect(result.voices.length+result.music.layers).toBeLessThanOrEqual(48);
 expect(Object.keys(result.drops).some(key=>key.startsWith('voice-budget'))).toBe(true);
});

test('diagnostic stems retain one transport and render sample-aligned loop boundaries',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const result=await page.evaluate(async()=>{const audio=(window as any).prototype.audio;audio.setDiagnosticMusic('boss',1);const nodes=audio.musicNodes,epoch=audio.inspect().music.epoch,starts=nodes.map((node:any)=>node.start),duration=nodes[0].source.buffer.duration,rate=nodes[0].source.buffer.sampleRate;audio.setDiagnosticMusic('boss',.1);audio.setDiagnosticMusic('boss',1);const stable=epoch===audio.inspect().music.epoch&&nodes===audio.musicNodes;const offset=Math.round(rate*.01),frames=Math.round(duration*rate),offline=new OfflineAudioContext(3,frames*2+offset+2,rate),merger=offline.createChannelMerger(3);merger.connect(offline.destination);for(let i=0;i<3;i++){const source=offline.createBufferSource();source.buffer=nodes[i].source.buffer;source.loop=true;source.loopStart=0;source.loopEnd=duration;source.connect(merger,0,i);source.start(.01+starts[i]-Math.min(...starts));}const pcm=await offline.startRendering();return {method:'test-only offline PCM render of live diagnostic buffers and transport offsets; no human hearing claim',stable,starts,rate,frames,onsets:[0,1,2].map(channel=>pcm.getChannelData(channel).findIndex(sample=>Math.abs(sample)>1e-6)),loopErrors:[0,1,2].map(channel=>{const data=pcm.getChannelData(channel);let error=0;for(let i=offset;i<offset+frames;i+=97)error=Math.max(error,Math.abs(data[i]-data[i+frames]));return error;})};});
 expect(result.stable).toBe(true);expect(new Set(result.starts).size).toBe(1);expect(new Set(result.onsets).size).toBe(1);expect(result.loopErrors.every(error=>error<1e-5)).toBe(true);mkdirSync('../work/AUDIO-01',{recursive:true});writeFileSync('../work/AUDIO-01/stem-pcm.json',JSON.stringify(result,null,2));
});

test('a simulated visibility event keeps world loops virtual until visibility returns',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.audio.inspect().voices.filter((voice:any)=>voice.bus==='ambience').length)).toBe(0);
 await page.evaluate(()=>{delete (document as any).hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.audio.inspect().voices.some((voice:any)=>voice.bus==='ambience'))).toBe(true);
});

test('local original candidates decode through the restricted provider and keep provenance visible',async({page})=>{
 test.setTimeout(30000);
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().music.id),{timeout:4000}).toBe('explore');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().music.source),{timeout:15000}).toBe('local-original-candidate');
 expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().music.loopMode)).toBe('whole-file-evaluation-replay');
 expect(await page.evaluate(()=>(window as any).prototype.audio.inspect().cache.pcmBytes)).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).prototype.audio.setDiagnosticMusic('title'));
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().music.source),{timeout:15000}).toBe('local-original-candidate');
});

test('diagnostic output is captured from the same live master',async({page})=>{
 await page.goto('/?scene2d=1&legacyMap=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.audio.inspect().context)).toBe('running');
 const result=await page.evaluate(async()=>{const audio=(window as any).prototype.audio,stream=audio.captureStream() as MediaStream;const recorder=new MediaRecorder(stream),chunks:Blob[]=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();await new Promise(resolve=>setTimeout(resolve,1500));await new Promise<void>(resolve=>{recorder.onstop=()=>resolve();recorder.stop();});const blob=new Blob(chunks,{type:recorder.mimeType});const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return {data:btoa(binary),bytes:bytes.length,context:audio.inspect().context,peak:audio.inspect().peak};});
 expect(result.bytes).toBeGreaterThan(1000);expect(result.context).toBe('running');const folder=resolve('../work/AUDIO-01');mkdirSync(folder,{recursive:true});writeFileSync(resolve(folder,'diagnostic-master.webm'),Buffer.from(result.data,'base64'));
});
