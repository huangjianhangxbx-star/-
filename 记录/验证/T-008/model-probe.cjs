const {chromium}=require('../../../game/node_modules/@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const label=process.argv[2]||'after';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-angle=swiftshader','--enable-webgl']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();
  const rows=await page.evaluate(async()=>{
   const {BattleScene}=await import('/src/view/scene.ts'),{createGame}=await import('/src/core/engine.ts');
   const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'100'});document.body.append(host);
   const scene=new BattleScene(host),s=createGame();s.phase='battle';s.waves=[];
   s.units.forEach((u,i)=>{u.life='active';u.pos={x:3+i*1.6,y:4};u.drawPos={...u.pos};});
   scene.update(s,{selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},.01);
   window.modelProbeScene=scene;
   const rows=[];
   for(const actor of scene.unitVisuals.values()){
    const visual=actor.spine,spine=window.spine,offset=new spine.Vector2(),size=new spine.Vector2();visual.skeleton.getBounds(offset,size,[]);
    const actions=[];
    for(const action of ['idle','move','attack','skill','dead']){
     visual.update(.1,action,1,true);const c=visual.canvas,data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let top=c.height,bottom=-1,left=c.width,right=-1,edgePixels=0;
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>80){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);if(x===0||y===0||x===c.width-1||y===c.height-1)edgePixels++;}
     actions.push({action,pixelHeight:bottom-top+1,worldHeight:(bottom-top+1)/c.height*actor.sprite.scale.y,edgePixels,bounds:{top,bottom,left,right}});
    }
    visual.update(0,'idle',1,true);actor.spineTexture.needsUpdate=true;
    rows.push({id:actor.unit.id,asset:actor.unit.asset,sourceBounds:{width:size.x,height:size.y},canvasScale:visual.scale,displayScale:actor.sprite.scale.y,anchor:actor.sprite.center.y,logical:actor.unit.pos,actions});
   }
   scene.renderer.render(scene.scene,scene.camera);return rows;
  });
  await page.screenshot({path:path.join(__dirname,`models-${label}.png`)});
  fs.writeFileSync(path.join(__dirname,`model-probe-${label}.json`),JSON.stringify({method:'Real production scene and source animations; four standing allies arranged by a test fixture for a repeatable size comparison. No source images or skeletons modified.',rows,errors},null,2));
  console.log(JSON.stringify({label,rows:rows.map(r=>({id:r.id,sourceBounds:r.sourceBounds,displayScale:r.displayScale,standing:r.actions[0]})),errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
