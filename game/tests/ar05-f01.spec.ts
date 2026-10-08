import {test,expect} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
const out='../work/AR-05/F01';
test('main visual survives pause, 2x, modal 0.1x and scene rebuild',async({page})=>{
 test.setTimeout(60000);
 const open=async()=>{await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready)).toBe(true);};
 await open();await page.locator('[data-action="speed"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(2);
 await page.locator('[data-action="backpack"]').first().click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(.1);await page.locator('[data-action="backpack"]').first().click();
 await page.locator('[data-action="pause"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(0);await page.waitForTimeout(100);const a=await page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter').reference.canvas.toDataURL());await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter').reference.canvas.toDataURL())).toBe(a);
 await open();expect(await page.evaluate(()=>!!(window as any).spine.canvas)).toBe(true);
});
test('Blue neutral animated attachments survive actual Lab and main direction masks',async({page})=>{
 test.setTimeout(120000);mkdirSync(out,{recursive:true});const result:any[]=[];
 for(const endpoint of ['lab','main']){
  await page.goto('/');
  const rows=await page.evaluate(async(endpoint)=>{
   const dynamicImport=(path:string)=>import(/* @vite-ignore */path);let v:any;
   if(endpoint==='lab'){const m=await dynamicImport('/src/action-lab/presentation/spine.ts');await m.loadNativeRuntime();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;v=new m.NativeUnit(canvas,'blue');await v.load();}
   else {const m=await dynamicImport('/src/view/reference-spine41.ts');v=await m.ReferenceBlueVisual.load();}
   const skeleton=v.skeleton,state=v.state??v.animation;const roots=new Set(['左','左上','左下','上','下']);
   const branch=(slot:any)=>{let b=slot.bone;while(b.parent?.parent)b=b.parent;return b.data.name;};
   const mask=v.selectDirection.bind(v);const rows:any[]=[];
   if(endpoint==='lab'){
    const attachments=skeleton.slots.map((s:any)=>s.getAttachment());for(const slot of skeleton.slots)if(branch(slot)!=='左')slot.setAttachment(null);
    const legacySize=new (window as any).spine.Vector2(),offset=new (window as any).spine.Vector2();skeleton.getBounds(offset,legacySize,[]);
    skeleton.slots.forEach((s:any,i:number)=>s.setAttachment(attachments[i]));rows.push({endpoint,pose:'standing-frame',lost:Math.abs(v.bodyHeight-legacySize.y)>.001?[{height:v.bodyHeight,expected:legacySize.y}]:[]});
   }
   for(const pose of ['a1','a2','a3','a4'])for(const direction of ['左','左上','左下','上','下'])for(const time of [0,.0333,.1333,.3,.5,.7]){
    skeleton.setToSetupPose();const t0=state.setAnimation(0,pose,false),t1=state.setAnimation(1,'方向_'+direction,true);t0.trackTime=time;t1.trackTime=0;state.apply(skeleton);
    const before=skeleton.slots.map((slot:any)=>({slot:slot.data.name,branch:branch(slot),attachment:slot.getAttachment()?.name??null,alpha:slot.color.a,active:slot.bone.active}));mask(direction);
    if(pose==='a1'&&direction==='左'&&time===.1333){const slots=skeleton.slots.filter((slot:any)=>branch(slot)==='zuoshang'&&/头|肩|臂|发/.test(slot.data.name)).slice(0,12);rows.push({endpoint,pose,direction,time,lost:[],detail:{tracks:[t0,t1].map(t=>({animation:t.animation.name,time:t.trackTime,mixTime:t.mixTime,mixDuration:t.mixDuration,mixingFrom:t.mixingFrom?.animation.name??null})),slots:slots.map((slot:any)=>{const ancestry:string[]=[];for(let b=slot.bone;b;b=b.parent)ancestry.push(b.data.name);return {slot:slot.data.name,ancestry,before:before[skeleton.slots.indexOf(slot)].attachment,after:slot.getAttachment()?.name??null,alpha:slot.color.a,active:slot.bone.active,drawOrder:skeleton.drawOrder.indexOf(slot)};}),clipping:skeleton.drawOrder.filter((slot:any)=>slot.getAttachment()?.endSlot).map((slot:any)=>({slot:slot.data.name,end:slot.getAttachment().endSlot.name}))}});}
    const lost=before.filter((r:any,i:number)=>!roots.has(r.branch)&&r.attachment&&r.active&&r.alpha>0&&!skeleton.slots[i].getAttachment());
    const leaked=before.filter((r:any,i:number)=>roots.has(r.branch)&&r.branch!==direction&&skeleton.slots[i].getAttachment());rows.push({endpoint,pose,direction,time,lost:lost.concat(leaked)});
   }
   v.dispose();return rows;
  },endpoint);result.push(...rows);
 }
 writeFileSync(out+'/attachment-repro.json',JSON.stringify(result,null,2));expect(result.flatMap(r=>r.lost)).toEqual([]);
});
test('actual Lab and Hunter draw stay pixel-equal during held stages and rapid turning without state writes',async({page})=>{
 await page.goto('/');test.setTimeout(90000);
 const r=await page.evaluate(async()=>{
  const load=(path:string)=>import(/* @vite-ignore */path);const lm=await load('/src/action-lab/presentation/spine.ts');await lm.loadNativeRuntime();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const lab:any=new lm.NativeUnit(canvas,'blue');await lab.load();const mm=await load('/src/view/reference-spine41.ts');const main:any=await mm.ReferenceBlueVisual.load();let changed=0;
  const pixels=(v:any)=>{const a=new Uint8Array(512*512*4),gl=v.renderer.context.gl;gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  for(let i=0;i<240;i++){const stage=Math.floor(i/60),time=(i%60)/80,angle=[Math.PI,2.3,-2.3,Math.PI/2,-Math.PI/2,0][i%6];const actor:any={hp:10,hurtUntil:0,facing:angle,action:{pose:'a'+(stage+1),id:stage+1,track:{time},kind:'basic'}};const unit:any={life:'active',heading:-angle,basicAction:{presentationId:actor.action.pose,elapsed:time,angle:-angle,combatContext:{actionId:stage+1}}};const state:any={time:time+2};const before=JSON.stringify({actor,unit,state});lab.draw(actor,time+2,false,1);main.draw(unit,state,false);if(before!==JSON.stringify({actor,unit,state}))throw Error('visual mutated game state');const a=pixels(lab),b=pixels(main);for(let p=0;p<a.length;p++)if(a[p]!==b[p]){changed++;break;}}
  lab.dispose();main.dispose();return changed;
 });expect(r).toBe(0);
});
test('actual filtered render equals branch-only oracle across Blue poses, directions and mirrors',async({page})=>{
 test.setTimeout(120000);mkdirSync(out,{recursive:true});await page.goto('/');
 const evidence=await page.evaluate(async()=>{
  const m=await import(/* @vite-ignore */'/src/action-lab/presentation/spine.ts');await m.loadNativeRuntime();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const v:any=new m.NativeUnit(canvas,'blue');await v.load();const sk=v.skeleton,st=v.state,gl=v.renderer.context.gl;
  const dirs=['左','左上','左下','上','下'];const rows:any[]=[];
  const render=()=>{sk.updateWorldTransform();gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);v.renderer.begin();v.renderer.drawSkeleton(sk,true);v.renderer.end();const pixels=new Uint8Array(512*512*4);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,png:canvas.toDataURL()};};
  for(const pose of ['_stand','a1','a2','a3','a4','_move','_damaged','_die','skill_dashStrike','skill_架盾2','skill_盾冲前1','skill_盾冲前3','skill_盾冲！'])for(const dir of dirs)for(const mirror of [false,true])for(const time of [0,.0333,.1333,.3,.5,.7]){
   const images:any={};let d:any,e:any;
   for(const mode of ['B','C','D','E']){
    sk.setToSetupPose();st.clearTracks();st.setAnimation(0,pose,false).trackTime=time;if(mode!=='B')st.setAnimation(1,'方向_'+dir,true).trackTime=0;sk.scaleX=mirror?-1:1;st.apply(sk);
    if(mode==='D')v.selectDirection(dir);
    if(mode==='E')for(const slot of sk.slots){let b=slot.bone;while(b.parent?.parent)b=b.parent;if(dirs.includes(b.data.name)&&b.data.name!==dir)slot.setAttachment(null);}
    const r=render();if(mode==='D')d=r.pixels;if(mode==='E')e=r.pixels;if(['a1','a2','a3','a4'].includes(pose)&&dir==='左'&&!mirror&&time===.1333)images[mode]=r.png;
   }
   let changed=0;for(let i=0;i<d.length;i++)if(d[i]!==e[i])changed++;rows.push({pose,dir,mirror,time,changed,images});
  }v.dispose();return rows;
 });
 for(const r of evidence)for(const [mode,png] of Object.entries(r.images))writeFileSync(out+`/${r.pose}-${mode}.png`,Buffer.from((png as string).split(',')[1],'base64'));
 writeFileSync(out+'/render-matrix.json',JSON.stringify(evidence.map(({images,...r})=>r),null,2));expect(evidence.filter(r=>r.changed>0)).toEqual([]);
});
