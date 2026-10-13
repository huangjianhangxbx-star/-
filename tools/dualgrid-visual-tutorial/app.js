/* 本地教学：查看层和导出层分开，任何辅助底色不进入源像素。 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),N=384,C=DualGrid;
 const names=['全部透明','只留左上','只留右上','上半边石砖','只留左下','左半边石砖','右上与左下断开','右下角要挖空','只留右下','左上与右下断开','右半边石砖','左下角要挖空','下半边石砖','右上角要挖空','左上角要挖空','完整石砖'];
 const groupNames={empty:'空白',full:'全满',single:'单角',adjacent:'相邻双角',three:'三角',diagonal:'对角双角'};
 const tips={empty:'整张保持透明，不画石砖，也不要留下不透明背景。',full:'完整保留母版。砖缝和明暗跨过四边继续，不沿方框描边。',single:'保留这一角的石砖，在弧形交界补画外凸崩口。到两条画布边时沿用统一接缝；其余两角留透明。',adjacent:'保留相邻的两个角，沿横向或纵向交界补画连续断边。两端接缝处保持同一截面，不改变砖纹位置。',three:'从完整母版挖掉一个角，补画向内凹的砖缘和局部阴影。凹口两端接到边中点，接缝带内不要任意改轮廓。',diagonal:'分别保留两片石砖，中间留透明，不能用一块砖跨接。两片的四个出口分别服从相邻瓦片的边缘规则。'};
 const stepTexts=[
  '先看原图：石砖保持原位置。不要对不同变体随机平移、旋转或缩放；四角标签告诉你这一张有哪些石砖。',
  '白色要留，黑色要擦。红点是这张轮廓穿过的边中点；相邻两张除了点要对齐，整条边的透明度和颜色分布也要一致。',
  '把母版原坐标套进蒙版，空区就成为真正透明。灰白棋盘只是查看透明的背景，不会下载进图片。',
  '青色区域可以补绘崩口、砖边和局部阴影。橙色是画布四周的接缝提醒带，接触邻图处应保持整条边一致；带宽仅是教学提示。'
 ];
 const idOf=m=>'M'+String(m).padStart(2,'0');
 const group=m=>m===0?'empty':m===15?'full':[6,9].includes(m)?'diagonal':([1,2,4,8].includes(m)?'single':[7,11,13,14].includes(m)?'three':'adjacent');
 const makeCanvas=(w=N,h=N)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const source=makeCanvas(),tiles=[],masks=[],alphas=Array.from({length:16},(_,m)=>C.maskAlpha(m));
 const grid=Array.from({length:8},()=>Array(10).fill(0));
 let selected=7,step=0,brush=1,changed=[4,3],inspected=null,dragging=false,lastCell=null,lastPoint=null,dragValue=1;
 function demo(){
  const g=source.getContext('2d');g.clearRect(0,0,N,N);g.fillStyle='#6e8392';g.fillRect(0,0,N,N);
  for(let y=0;y<N;y+=96)for(let x=0;x<N;x+=96){
   g.fillStyle=((x+y)/96)%2?'#a5b7c0':'#b9c9ce';g.fillRect(x+7,y+7,82,82);
   g.fillStyle='#d0dde0';g.fillRect(x+7,y+7,82,5);g.fillRect(x+7,y+12,5,72);
   g.fillStyle='#8199a6';g.fillRect(x+12,y+84,77,5);g.fillRect(x+84,y+12,5,72);
   g.fillStyle='#738c9a';g.fillRect(x+38,y+34,13,3);g.fillRect(x+48,y+36,3,10);
  }
  $('sourceStatus').textContent='几何演示图 · 不是你的母版';$('uploadMessage').textContent='';rebuild();
 }
 function rebuild(){
  const src=source.getContext('2d').getImageData(0,0,N,N);
  for(let m=0;m<16;m++){
   const mask=makeCanvas(),tile=makeCanvas(),mi=new ImageData(N,N),ti=new ImageData(new Uint8ClampedArray(src.data),N,N);
   for(let p=0;p<N*N;p++){const a=alphas[m][p];mi.data.set([255,255,255,a],p*4);ti.data[p*4+3]=a?src.data[p*4+3]:0;}
   mask.getContext('2d').putImageData(mi,0,0);tile.getContext('2d').putImageData(ti,0,0);masks[m]=mask;tiles[m]=tile;
  }
  const g=$('source').getContext('2d');g.clearRect(0,0,N,N);g.drawImage(source,0,0);drawRepeat();buildGallery();showVariant();drawMaps();
 }
 async function loadFile(file){
  if(!file)return;
  if(file.type!=='image/png'&&!file.name.toLowerCase().endsWith('.png')){$('uploadMessage').textContent='请选择 PNG 图片。';return;}
  const url=URL.createObjectURL(file);
  try{
   // MIME和文件名只能作提示；解码前核对PNG签名。
   const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
   if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new Error('不是有效的 PNG 文件');
   const img=new Image();img.src=url;await img.decode();
   if(img.width!==N||img.height!==N){$('uploadMessage').textContent=`这张图是 ${img.width} × ${img.height}，请先在绘图软件准备 384 × 384 母版。当前图片未替换。`;return;}
   const g=source.getContext('2d');g.clearRect(0,0,N,N);g.drawImage(img,0,0);
   $('sourceStatus').textContent=`${file.name} · 384 × 384`;$('uploadMessage').textContent='导入成功。请检查右边 3 × 3 平铺是否有断纹。';rebuild();
  }catch(e){$('uploadMessage').textContent=`无法读取图片：${e.message}。请重新选择 PNG。`;}
  finally{URL.revokeObjectURL(url);$('upload').value='';}
 }
 function drawRepeat(){
  const g=$('repeat').getContext('2d');g.clearRect(0,0,N*3,N*3);g.imageSmoothingEnabled=false;
  for(let y=0;y<3;y++)for(let x=0;x<3;x++)g.drawImage(source,x*N,y*N);
  if($('seamLines').checked){g.strokeStyle='#e44646';g.lineWidth=2;g.setLineDash([8,5]);g.beginPath();for(let i=1;i<3;i++){g.moveTo(i*N,0);g.lineTo(i*N,N*3);g.moveTo(0,i*N);g.lineTo(N*3,i*N);}g.stroke();g.setLineDash([]);}
  const z=$('zoom').value;$('repeat').style.width=z==='fit'?'100%':`${N*3*Number(z)}px`;
 }
 function mini(m){return `<span class="corner-mini" aria-hidden="true">${[1,2,4,8].map(b=>`<i class="${m&b?'on':''}"></i>`).join('')}</span>`;}
 function buildGallery(){
  $('gallery').replaceChildren();
  for(let m=0;m<16;m++){
   const b=document.createElement('button');b.type='button';b.dataset.mask=m;b.dataset.group=group(m);b.setAttribute('aria-label',`${idOf(m)} ${names[m]}`);
   const title=document.createElement('strong');title.textContent=idOf(m);b.append(title);
   b.insertAdjacentHTML('beforeend',mini(m));
   const c=makeCanvas(96,96);c.className='checker';c.getContext('2d').drawImage(tiles[m],0,0,96,96);b.append(c);
   const caption=document.createElement('small');caption.textContent=names[m];b.append(caption);
   b.onclick=()=>{selected=m;showVariant();};$('gallery').append(b);
  }
 }
 function guides(canvas){
  const g=canvas.getContext('2d');g.clearRect(0,0,N,N);if(!$('guides').checked)return;
  g.strokeStyle='#bb444bc0';g.lineWidth=2;g.setLineDash([6,5]);g.beginPath();g.moveTo(192,0);g.lineTo(192,N);g.moveTo(0,192);g.lineTo(N,192);g.stroke();g.setLineDash([]);
  const points={top:[192,0],right:[384,192],bottom:[192,384],left:[0,192]};
  for(const side of C.crossings(selected)){const [x,y]=points[side];g.fillStyle='#db4248';g.beginPath();g.arc(x,y,9,0,Math.PI*2);g.fill();}
 }
 function drawLogic(){
  const g=$('logic').getContext('2d');g.clearRect(0,0,N,N);
  if(step===0)g.drawImage(source,0,0);
  const positions=[[0,0,1,'左上'],[192,0,2,'右上'],[0,192,4,'左下'],[192,192,8,'右下']];
  for(const [x,y,bit,name]of positions){const on=Boolean(selected&bit);
   g.fillStyle=step===0?(on?'#157f871c':'#c3652366'):(on?'#157f87':'#e4eaf1');g.fillRect(x,y,192,192);
   if(step===0){g.fillStyle=on?'#157f87':'#b65b20';g.fillRect(x+22,y+60,148,78);}
   g.fillStyle=step===0||on?'#fff':'#52657a';g.textAlign='center';g.font='bold 27px Microsoft YaHei';g.fillText(`${name} ${on?1:0}`,x+96,y+95);g.font='18px Microsoft YaHei';g.fillText(on?'石砖保留':'空 / 透明',x+96,y+122);
  }
 }
 function drawMask(){
  const g=$('mask').getContext('2d');g.clearRect(0,0,N,N);
  if(!$('maskTransparent').checked){g.fillStyle='#172335';g.fillRect(0,0,N,N);}g.drawImage(masks[selected],0,0);
 }
 function drawPaint(){
  const g=$('paint').getContext('2d');g.clearRect(0,0,N,N);g.drawImage(tiles[selected],0,0);
  const overlay=new ImageData(N,N),a=alphas[selected];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const p=y*N+x;if(!a[p])continue;
   const edge=x<14||x>=N-14||y<14||y>=N-14;
   overlay.data.set(edge?[225,130,48,180]:[28,155,153,58],p*4);
   // 仅标记内部石砖/空地界线，避免误导沿画布方框描边。
   if(!edge&&((x>0&&!a[p-1])||(x<N-1&&!a[p+1])||(y>0&&!a[p-N])||(y<N-1&&!a[p+N])))overlay.data.set([13,139,144,255],p*4);
  }
  const tint=makeCanvas();tint.getContext('2d').putImageData(overlay,0,0);g.drawImage(tint,0,0);
 }
 function showVariant(){
  TemplateLesson.update(selected,tiles,source,names);
  $('variantTitle').textContent=`${idOf(selected)} · ${names[selected]}`;
  document.querySelectorAll('#gallery button').forEach(b=>{const on=Number(b.dataset.mask)===selected;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  $('stepText').textContent=stepTexts[step];
  document.querySelectorAll('#steps button').forEach(b=>{const on=Number(b.dataset.step)===step;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
  document.querySelectorAll('[data-panel]').forEach(f=>f.classList.toggle('active',Number(f.dataset.panel)===step));
  document.querySelector('[data-panel="0"] figcaption b').textContent=step===0?'① 母版与四角':'① 四角逻辑';
  drawLogic();drawMask();const g=$('result').getContext('2d');g.clearRect(0,0,N,N);g.drawImage(tiles[selected],0,0);drawPaint();
  for(const id of ['logicGuide','maskGuide','resultGuide','paintGuide'])guides($(id));
  const labels={top:'上 [192, 0]',right:'右 [384, 192]',bottom:'下 [192, 384]',left:'左 [0, 192]'};
  const sides=C.crossings(selected);$('crossingText').textContent=(sides.length?'本张穿越的边中点：'+sides.map(s=>labels[s]).join(' · '):'本张没有穿越边中点的轮廓。')+'　十字中线 x = 192 / y = 192。';
  $('groupTitle').textContent=`${groupNames[group(selected)]}的下笔提示`;$('drawTip').textContent=tips[group(selected)];
  if($('inspector').open)drawInspect();
 }
 function drawInspect(){
  const g=$('inspectCanvas').getContext('2d');g.clearRect(0,0,N,N);g.drawImage(tiles[selected],0,0);g.drawImage($('resultGuide'),0,0);
  const sz=N*Number($('inspectZoom').value);$('inspectCanvas').style.width=sz+'px';$('inspectCanvas').style.height=sz+'px';
 }
 function download(canvas,name){canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
 function exportBW(){const c=makeCanvas(),g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,N,N);g.drawImage(masks[selected],0,0);download(c,`${idOf(selected)}-黑白查看图.png`);}
 function exportAtlas(){const c=makeCanvas(1536,1536),g=c.getContext('2d');for(let m=0;m<16;m++)g.drawImage(tiles[m],m%4*N,Math.floor(m/4)*N);download(c,'双网格-M00-M15-透明图集.png');}
 function exportTable(){
  const rows=['教材编号,名称,左上1,右上2,左下4,右下8,图集列0起,图集行0起,类别',...names.map((n,m)=>[idOf(m),n,...[1,2,4,8].map(b=>m&b?1:0),m%4,Math.floor(m/4),groupNames[group(m)]].join(','))];
  const blob=new Blob(['\uFEFF'+rows.join('\r\n')+'\r\n说明：编号仅用于本教材；Unity插件图集映射需另行确认。'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='双网格-编号对照表.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const S=48;
 function dataLines(g){g.strokeStyle='#157f8780';g.lineWidth=1;g.beginPath();for(let x=0;x<=10;x++){g.moveTo((x+.5)*S,S*.5);g.lineTo((x+.5)*S,8.5*S);}for(let y=0;y<=8;y++){g.moveTo(.5*S,(y+.5)*S);g.lineTo(10.5*S,(y+.5)*S);}g.stroke();}
 function renderLines(g){g.strokeStyle='#c3652366';g.lineWidth=1;g.beginPath();for(let x=0;x<=11;x++){g.moveTo(x*S,0);g.lineTo(x*S,9*S);}for(let y=0;y<=9;y++){g.moveTo(0,y*S);g.lineTo(11*S,y*S);}g.stroke();}
 function markCorners(g,rx,ry){
  for(const [x,y,bit]of [[rx,ry,1],[rx+1,ry,2],[rx,ry+1,4],[rx+1,ry+1,8]]){
   g.fillStyle=grid[y]?.[x]?'#0a7b86':'#edf2f7';g.strokeStyle='#173f5d';g.lineWidth=2;g.beginPath();g.arc((x+1)*S,(y+1)*S,5,0,Math.PI*2);g.fill();g.stroke();
   if($('weights').checked){g.font='bold 11px Consolas';g.fillStyle='#173f5d';g.fillText(String(bit),(x+1)*S+8,(y+1)*S-8);}
  }
 }
 function drawMaps(){
  const l=$('logicMap').getContext('2d'),r=$('renderMap').getContext('2d');l.clearRect(0,0,528,432);r.clearRect(0,0,528,432);l.fillStyle='#f0f4f8';l.fillRect(0,0,528,432);r.imageSmoothingEnabled=false;
  for(let y=0;y<8;y++)for(let x=0;x<10;x++){
   l.fillStyle=grid[y][x]?'#368891':'#e1e8f0';l.fillRect((x+.5)*S,(y+.5)*S,S,S);
   l.fillStyle=grid[y][x]?'#cae8e8':'#9eafc1';l.beginPath();l.arc((x+1)*S,(y+1)*S,3,0,Math.PI*2);l.fill();
  }
  for(let y=-1;y<8;y++)for(let x=-1;x<10;x++)r.drawImage(tiles[C.tileMask(grid,x,y)],(x+1)*S,(y+1)*S,S,S);
  if($('dataGrid').checked){dataLines(l);dataLines(r);}if($('renderGrid').checked)renderLines(r);
  if(changed){const [cx,cy]=changed;l.strokeStyle='#da823a';l.lineWidth=3;l.strokeRect((cx+.5)*S+2,(cy+.5)*S+2,S-4,S-4);
   for(const [x,y]of [[cx-1,cy-1],[cx,cy-1],[cx-1,cy],[cx,cy]]){r.strokeStyle='#e8a04a';r.lineWidth=3;r.strokeRect((x+1)*S+2,(y+1)*S+2,S-4,S-4);}
  }
  if(inspected){const [x,y]=inspected;r.strokeStyle='#18467b';r.lineWidth=4;r.strokeRect((x+1)*S+3,(y+1)*S+3,S-6,S-6);markCorners(l,x,y);markCorners(r,x,y);}
  else if(changed){markCorners(l,changed[0]-1,changed[1]-1);markCorners(r,changed[0]-1,changed[1]-1);}
  if($('weights').checked){r.font='9px Consolas';for(let y=-1;y<8;y++)for(let x=-1;x<10;x++){const ox=(x+1)*S,oy=(y+1)*S;r.fillStyle='#142c42';r.fillText('1',ox+4,oy+11);r.fillText('2',ox+36,oy+11);r.fillText('4',ox+4,oy+44);r.fillText('8',ox+36,oy+44);}}
  drawAffected();
 }
 function chooseTile(x,y){inspected=[x,y];selected=C.tileMask(grid,x,y);showVariant();drawMaps();}
 function drawAffected(){
  const host=$('affected');host.replaceChildren();
  if(!changed){host.textContent='在左边涂一格，再点这里的渲染块查看四角来源。';return;}
  const [x,y]=changed,text=document.createElement('span');text.textContent=`数据格 (${x+1}, ${y+1}) → 附近 4 张渲染块：`;host.append(text);
  for(const [rx,ry]of [[x-1,y-1],[x,y-1],[x-1,y],[x,y]]){const m=C.tileMask(grid,rx,ry),b=document.createElement('button');b.innerHTML=mini(m)+`<span>${idOf(m)} [${rx+1},${ry+1}]</span>`;b.title=`${names[m]}：左上${m&1?1:0} 右上${m&2?1:0} 左下${m&4?1:0} 右下${m&8?1:0}`;b.onclick=()=>chooseTile(rx,ry);if(inspected?.[0]===rx&&inspected?.[1]===ry)b.classList.add('active');host.append(b);}
  if(inspected){const m=C.tileMask(grid,...inspected),p=document.createElement('span');p.textContent=`正在看 ${idOf(m)}：左上 ${m&1?1:0} / 右上 ${m&2?1:0} / 左下 ${m&4?1:0} / 右下 ${m&8?1:0}`;host.append(p);}
 }
 function point(e,canvas){const b=canvas.getBoundingClientRect();return [(e.clientX-b.left)/b.width*canvas.width,(e.clientY-b.top)/b.height*canvas.height];}
 function paintPoint(px,py,value){
  const x=Math.floor(px/S-.5),y=Math.floor(py/S-.5);if(x<0||x>=10||y<0||y>=8)return;
  if(lastCell?.[0]===x&&lastCell?.[1]===y)return;lastCell=[x,y];grid[y][x]=value;changed=[x,y];inspected=null;drawMaps();
 }
 function strokeTo(p){
  if(lastPoint){const dx=p[0]-lastPoint[0],dy=p[1]-lastPoint[1],n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/12));for(let i=1;i<=n;i++)paintPoint(lastPoint[0]+dx*i/n,lastPoint[1]+dy*i/n,dragValue);}
  else paintPoint(...p,dragValue);lastPoint=p;
 }
 const lc=$('logicMap');lc.oncontextmenu=e=>e.preventDefault();
 lc.addEventListener('pointerdown',e=>{e.preventDefault();lc.setPointerCapture(e.pointerId);dragging=true;dragValue=e.button===2?0:brush;lastCell=null;lastPoint=null;strokeTo(point(e,lc));});
 lc.addEventListener('pointermove',e=>{if(dragging)strokeTo(point(e,lc));});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])lc.addEventListener(event,()=>{dragging=false;lastPoint=null;lastCell=null;});
 $('renderMap').onclick=e=>{const [px,py]=point(e,$('renderMap'));chooseTile(Math.min(9,Math.floor(px/S)-1),Math.min(7,Math.floor(py/S)-1));};
 function example(name){
  grid.forEach(row=>row.fill(0));const set=(x,y)=>grid[y][x]=1;
  if(name==='single')set(4,3);
  if(name==='line')for(let x=2;x<8;x++)set(x,3);
  if(name==='l'){for(let y=2;y<6;y++)set(3,y);for(let x=3;x<7;x++)set(x,5);}
  if(name==='notch'){for(let y=2;y<6;y++)for(let x=2;x<8;x++)set(x,y);grid[2][5]=grid[3][5]=0;}
  if(name==='diagonal'){set(4,3);set(5,4);}
  if(name==='full')grid.forEach(row=>row.fill(1));changed=[4,3];inspected=null;drawMaps();
 }
 $('upload').onchange=e=>loadFile(e.target.files[0]);$('demo').onclick=demo;
 const drop=$('dropzone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');loadFile(e.dataTransfer.files[0]);};
 $('seamLines').onchange=drawRepeat;$('zoom').onchange=drawRepeat;
 $('steps').onclick=e=>{const b=e.target.closest('[data-step]');if(b){step=Number(b.dataset.step);showVariant();}};
 window.addEventListener('template-select',e=>{selected=e.detail;showVariant();});
 $('guides').onchange=showVariant;$('maskTransparent').onchange=drawMask;
 $('checkerToggle').onchange=()=>document.body.classList.toggle('no-checker',!$('checkerToggle').checked);
 $('inspect').onclick=()=>{$('inspector').showModal();drawInspect();};$('closeInspector').onclick=()=>$('inspector').close();$('inspectZoom').onchange=drawInspect;
 $('exportMask').onclick=()=>download(masks[selected],`${idOf(selected)}-透明参考蒙版.png`);
 $('exportResult').onclick=()=>download(tiles[selected],`${idOf(selected)}-同坐标示范.png`);
 $('exportBW').onclick=exportBW;$('exportAtlas').onclick=exportAtlas;$('exportTable').onclick=exportTable;
 function setBrush(value){brush=value;$('brush').classList.toggle('active',value===1);$('eraser').classList.toggle('active',value===0);}
 $('brush').onclick=()=>setBrush(1);$('eraser').onclick=()=>setBrush(0);$('clear').onclick=()=>{grid.forEach(row=>row.fill(0));changed=null;inspected=null;drawMaps();};
 $('examples').onclick=e=>{const b=e.target.closest('[data-example]');if(b)example(b.dataset.example);};
 for(const id of ['dataGrid','renderGrid','weights'])$(id).onchange=drawMaps;
 // 键盘也可以涂逻辑格：方向键移光标，空格使用当前工具。
 lc.onkeydown=e=>{let [x,y]=changed||[4,3];const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[e.key]){e.preventDefault();x=Math.max(0,Math.min(9,x+moves[e.key][0]));y=Math.max(0,Math.min(7,y+moves[e.key][1]));changed=[x,y];inspected=null;drawMaps();}else if(e.key===' '){e.preventDefault();grid[y][x]=brush;changed=[x,y];inspected=null;drawMaps();}};
 demo();example('l');
})();
