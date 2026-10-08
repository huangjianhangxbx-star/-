import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../work/AR-05/F03';
const poses=['_stand','a1','a2','a3','a4','_move','_damaged','_die','skill_dashStrike','skill_架盾2','skill_盾冲前1','skill_盾冲前3','skill_盾冲！'];

test('Blue has one cranial rig through direction changes and protects F01 upper body',async({page})=>{
 test.setTimeout(120000);mkdirSync(out,{recursive:true});await page.goto('/');
 const result=await page.evaluate(async(poses)=>{
  const load=(p:string)=>import(/* @vite-ignore */p),rows:any[]=[],proof:any[]=[];
  const mm=await load('/src/view/reference-spine41.ts'),main:any=await mm.ReferenceBlueVisual.load();
  const lm=await load('/src/action-lab/presentation/spine.ts');await lm.loadNativeRuntime();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const lab:any=new lm.NativeUnit(canvas,'blue');await lab.load();
  const branch=(s:any)=>{let b=s.bone;while(b.parent?.parent)b=b.parent;return b.data.name;};
  // Native cranial attachment census, separate from renderer-to-renderer equality.
  // The standing viewport covers +/-246 x and -148..345 y; use the central body region.
  const heads=(sk:any)=>sk.slots.filter((s:any)=>/头|脸|中发/.test(s.data.name)&&s.getAttachment()&&s.bone.active&&s.color.a>.01&&Math.abs(s.bone.worldX)<200&&s.bone.worldY>-120&&s.bone.worldY<300);
  const pixel=(v:any)=>{const gl=v.renderer.context.gl,a=new Uint8Array(512*512*4);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const render=(v:any)=>{const sk=v.skeleton,gl=v.renderer.context.gl;sk.updateWorldTransform();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);v.renderer.begin();v.renderer.drawSkeleton(sk,true);v.renderer.end();};
  for(const [endpoint,v] of [['main',main],['lab',lab]] as const){
   const sk=v.skeleton,st=v.animation??v.state;
   const draw=(pose:string,time:number,angle:number,id:number)=>{const actor:any={hp:10,hurtUntil:0,facing:angle,action:{pose,id,track:{time},kind:'basic'}},unit:any={life:'active',heading:-angle,basicAction:{presentationId:pose,elapsed:time,angle:-angle,combatContext:{actionId:id}}},state:any={time:id+2};if(pose==='_die'){actor.hp=0;unit.life='down';}if(pose==='_damaged'){actor.hurtUntil=id+10;unit.hunterCombat={hurtUntil:id+10};}const before=JSON.stringify({actor,unit,state});if(endpoint==='main'){v.draw(unit,state,false);if(pose==='_die'||pose==='_damaged')v.draw(unit,{time:state.time+time},false);}else {v.draw(actor,id+2,false,1);if(pose==='_die'||pose==='_damaged')v.draw(actor,id+2+time,false,1);}if(JSON.stringify({actor,unit,state})!==before)throw Error('visual wrote authority');};
   // Applied idle is essential: a never-applied previous track hid the original defect.
   st.clearTracks();v.lastPose='';v.direction='';v.lastDirection='';draw('_stand',0,0,0);draw('_stand',.1,0,0);
   for(let i=0;i<4;i++)for(let t=0;t<[.225,.225,.275,.4][i];t+=.025)draw('a'+(i+1),t,2.408425714579223,i+1);
   proof.push({endpoint,mode:'held',branches:[...new Set(heads(sk).map(branch))],mixing:st.tracks[1].mixingFrom?.animation.name??null,tracks:st.tracks.filter(Boolean).map((t:any)=>({pose:t.animation.name,time:t.trackTime,mixTime:t.mixTime,mixDuration:t.mixDuration,mixingFrom:t.mixingFrom?.animation.name??null})),slots:sk.slots.map((s:any)=>{const ancestry:string[]=[];for(let b=s.bone;b;b=b.parent)ancestry.push(b.data.name);return {name:s.data.name,branch:branch(s),ancestry,attachment:s.getAttachment()?.name??null,active:s.bone.active,alpha:s.color.a,drawOrder:sk.drawOrder.indexOf(s),world:{x:s.bone.worldX,y:s.bone.worldY,a:s.bone.a,b:s.bone.b,c:s.bone.c,d:s.bone.d},clipEnd:s.getAttachment()?.endSlot?.name??null};}),constraints:sk.transformConstraints.map((c:any)=>({name:c.data.name,order:c.data.order,target:c.target.data.name,bones:c.bones.map((b:any)=>b.data.name),active:c.active,mixX:c.mixX,mixY:c.mixY,mixRotate:c.mixRotate})),png:v.canvas.toDataURL()});
   let id=10;
   for(const pose of poses)for(const [dir,base] of [['左',Math.PI],['左上',2.3],['左下',-2.3],['上',Math.PI/2],['下',-Math.PI/2]] as const)for(const mirror of [false,true])for(const time of [0,.0333,.1333,.3,.5,.7]){
    st.clearTracks();v.lastPose='';v.direction='';v.lastDirection='';draw('_stand',0,0,id++);draw('_stand',.1,0,id-1);
    const angle=mirror?Math.PI-base:base;draw(pose,time,angle,id++);sk.scaleX=mirror?-1:1;render(v);
    rows.push({endpoint,pose,dir,mirror,time,branches:[...new Set(heads(sk).map(branch))],mixing:st.tracks[1].mixingFrom?.animation.name??null});
    if(pose==='a1'&&dir==='左'&&!mirror&&time===.1333){
     const complete=pixel(v),png=v.canvas.toDataURL(),attachments=sk.slots.map((s:any)=>s.getAttachment());for(const s of sk.slots)if(branch(s)!=='左')s.setAttachment(null);render(v);const old=pixel(v);let difference=0;for(let p=0;p<old.length;p++)if(old[p]!==complete[p])difference++;
     proof.push({endpoint,mode:'F01-protection',difference,oldBranches:[...new Set(heads(sk).map(branch))],png,oldPng:v.canvas.toDataURL()});sk.slots.forEach((s:any,i:number)=>s.setAttachment(attachments[i]));
    }
   }
  }
  main.dispose();lab.dispose();return {rows,proof};
 },poses);
 for(const p of result.proof){writeFileSync(out+`/${p.endpoint}-${p.mode}.png`,Buffer.from(p.png.split(',')[1],'base64'));if(p.oldPng)writeFileSync(out+`/${p.endpoint}-F01-old.png`,Buffer.from(p.oldPng.split(',')[1],'base64'));delete p.png;delete p.oldPng;}
 writeFileSync(out+'/single-body-matrix.json',JSON.stringify(result,null,2));
 expect(result.rows.filter(r=>r.branches.length!==1||r.mixing!==null)).toEqual([]);
 for(const p of result.proof)if(p.mode==='held'){expect(p.branches).toHaveLength(1);expect(p.mixing).toBeNull();}else {expect(p.difference).toBeGreaterThan(1000);expect(p.oldBranches).toHaveLength(0);}
});

test('real main held attack stays single-body with one Hunter visual and canvas texture',async({page})=>{
 test.setTimeout(60000);mkdirSync(out,{recursive:true});await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready)).toBe(true);
 const c=await page.evaluate(()=>{const p=(window as any).prototype;return p.project(p.state.units.find((u:any)=>u.id==='hunter').pos);});await page.mouse.move(c.x-140,c.y-100);await page.mouse.down();
 const rows=await page.evaluate(async()=>{const p=(window as any).prototype,rows:any[]=[];for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const h=p.state.units.find((u:any)=>u.id==='hunter'),actor=p.scene.unitVisuals.get('hunter'),v=actor.reference;const heads=v.skeleton.slots.filter((s:any)=>/头|脸|中发/.test(s.data.name)&&s.getAttachment()&&s.bone.active&&s.color.a>.01&&Math.abs(s.bone.worldX)<200&&s.bone.worldY>-120&&s.bone.worldY<300).map((s:any)=>{let b=s.bone;while(b.parent?.parent)b=b.parent;return b.data.name;});rows.push({pose:h.basicAction?.presentationId,time:h.basicAction?.elapsed,branches:[...new Set(heads)],mixing:v.animation.tracks[1]?.mixingFrom?.animation.name??null,units:p.state.units.filter((u:any)=>u.id==='hunter').length,texture:actor.sprite.material.map.image===v.canvas,png:h.basicAction?.presentationId==='a4'?v.canvas.toDataURL():undefined});}return rows;});
 await page.mouse.up();await page.screenshot({path:out+'/after-main.png'});const key=rows.find(r=>r.pose==='a4'&&(r.time??0)>.2)!;expect(key).toBeTruthy();writeFileSync(out+'/after-native.png',Buffer.from(key.png!.split(',')[1],'base64'));writeFileSync(out+'/real-after.json',JSON.stringify(rows.map(({png,...r})=>r),null,2));expect(rows.filter(r=>r.branches.length!==1||r.mixing!==null||r.units!==1||!r.texture)).toEqual([]);
});
