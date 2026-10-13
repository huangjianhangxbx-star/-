/* 完整手绘图集独立于教学母版，裁切后直接渲染，禁止重套轮廓。 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),slots=TemplateLesson.slots;
 let tiles=null,current=7,fileName='',request=0;
 function showSelected(m){
  current=m;const c=$('atlasSelected'),g=c.getContext('2d');g.clearRect(0,0,400,400);
  if(tiles)g.drawImage(tiles[m],0,0);
  const slot=slots.indexOf(m);$('atlasSelectedTitle').textContent=`当前素材 · M${String(m).padStart(2,'0')} · 第${Math.floor(slot/4)+1}行${slot%4+1}列`;
  document.querySelectorAll('#atlasSlots button').forEach((b,i)=>{const on=slots[i]===m;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 }
 function sourceChanged(){
  $('mapSourceStatus').textContent=$('mapSource').value==='atlas'?`当前使用 ${fileName} · 16张原图素材`:'当前使用原有母版自动示范。';
  window.dispatchEvent(new Event('atlas-source-change'));
 }
 async function load(file){
  if(!file)return;const token=++request;let url;
  try{
   const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
   if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new Error('请选择有效的PNG图片');
   url=URL.createObjectURL(file);const im=new Image();im.src=url;await im.decode();if(token!==request)return;
   if(im.width!==1600||im.height!==1600){$('atlasMessage').textContent=`这张图是 ${im.width} × ${im.height}，需要1600 × 1600（4×4格，每格400）。当前有效图集未替换。`;return;}
   const next=Array(16);slots.forEach((m,i)=>{const c=document.createElement('canvas');c.width=c.height=400;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,i%4*400,Math.floor(i/4)*400,400,400,0,0,400,400);next[m]=c;});
   const whole=$('atlasWhole'),g=whole.getContext('2d');g.clearRect(0,0,1600,1600);g.drawImage(im,0,0);tiles=next;fileName=file.name;
   $('atlasSlots').replaceChildren();slots.forEach((m,i)=>{const b=document.createElement('button');b.textContent='M'+String(m).padStart(2,'0');b.setAttribute('aria-label',`图集第${Math.floor(i/4)+1}行第${i%4+1}列`);b.onclick=()=>window.dispatchEvent(new CustomEvent('atlas-select',{detail:m}));$('atlasSlots').append(b);});
   $('mapSource').querySelector('[value="atlas"]').disabled=false;$('mapSource').value='atlas';showSelected(current);sourceChanged();
   $('atlasStatus').textContent=`${fileName} · 1600 × 1600 · 16格已载入`;$('atlasMessage').textContent='地图已切换到完整手绘图集，去下方点 / 拖涂画。';
  }catch(e){if(token===request)$('atlasMessage').textContent=`无法载入：${e.message}。当前有效图集未替换。`;}
  finally{if(url)URL.revokeObjectURL(url);$('atlasUpload').value='';}
 }
 $('atlasUpload').onchange=e=>load(e.target.files[0]);$('mapSource').onchange=sourceChanged;
 const drop=$('atlasDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');load(e.dataTransfer.files[0]);};
 window.AtlasPreview={showSelected,getTiles:()=>$('mapSource').value==='atlas'?tiles:null};
})();
