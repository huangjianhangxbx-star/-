/* 完整母版变体的独立混铺预览；不接触双网格母版/图集/逻辑格。 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);let variants=[],layout=[],cols=8,rows=6,seed=1,request=0;
 function nextRandom(state){
  let a=state>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
 }
 function regenerate(){
  const rng=nextRandom(seed);layout=variants.length?Array.from({length:cols*rows},()=>Math.floor(rng()*variants.length)):[];render();
 }
 function zoom(){
  const c=$('randomTiles'),stack=$('randomTileStack'),z=$('randomZoom').value;
  const viewport=stack.parentElement,w=z==='fit'?Math.min(viewport.clientWidth,viewport.clientHeight*cols/rows):c.width*Number(z);
  stack.style.width=`${w}px`;stack.style.height=`${w*rows/cols}px`;stack.style.aspectRatio=`${cols} / ${rows}`;
  c.style.imageRendering=z==='fit'||Number(z)<1?'auto':'pixelated';
 }
 function guides(){
  const c=$('randomGuides'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);if(!variants.length)return;
  const size=variants[0].image.width;
  if($('randomSeams').checked){g.strokeStyle='#e44646';g.lineWidth=2;g.setLineDash([10,7]);g.beginPath();for(let x=1;x<cols;x++){g.moveTo(x*size,0);g.lineTo(x*size,c.height);}for(let y=1;y<rows;y++){g.moveTo(0,y*size);g.lineTo(c.width,y*size);}g.stroke();g.setLineDash([]);}
  if($('randomNumbers').checked){g.font='bold 28px Consolas';g.lineWidth=4;g.strokeStyle='#20344d';g.fillStyle='#fff';g.textBaseline='top';layout.forEach((n,i)=>{const x=i%cols*size+12,y=Math.floor(i/cols)*size+12;g.strokeText(String(n+1),x,y);g.fillText(String(n+1),x,y);});}
 }
 function render(){
  const c=$('randomTiles'),cg=c.getContext('2d'),overlay=$('randomGuides'),size=variants[0]?.image.width||400;
  c.width=overlay.width=cols*size;c.height=overlay.height=rows*size;cg.imageSmoothingEnabled=false;
  layout.forEach((n,i)=>cg.drawImage(variants[n].image,i%cols*size,Math.floor(i/cols)*size));
  $('randomStatus').textContent=variants.length?`${variants.length} 张母版变体 · ${size} × ${size} · ${cols} × ${rows}随机平铺 · 种子${seed}`:'尚未添加母版变体。可一次选择你的原母版和3张变体，也可追加更多。';
  for(const id of ['randomReroll','randomApplySeed','randomExport','randomClear'])$(id).disabled=!variants.length;
  const list=$('randomVariants');list.replaceChildren();
  variants.forEach((v,i)=>{const card=document.createElement('article'),thumb=document.createElement('canvas');thumb.width=thumb.height=size;thumb.className='checker';thumb.getContext('2d').drawImage(v.image,0,0);
   const title=document.createElement('p');title.textContent=`${i+1}. ${v.name}`;const count=document.createElement('small');count.textContent=`本次使用 ${layout.filter(n=>n===i).length} 格 · 每格被选概率 1/${variants.length}`;
   const remove=document.createElement('button');remove.textContent='移除';remove.setAttribute('aria-label',`移除变体${i+1}`);remove.onclick=()=>{variants.splice(i,1);regenerate();};card.append(thumb,title,count,remove);list.append(card);
  });guides();zoom();
 }
 async function read(file){
  const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());if(![137,80,78,71,13,10,26,10].every((v,i)=>v===bytes[i]))throw new Error(`${file.name}：不是有效PNG`);
  const url=URL.createObjectURL(file);try{const im=new Image();im.src=url;await im.decode();if(im.width!==im.height||![400,384].includes(im.width))throw new Error(`${file.name}：${im.width} × ${im.height}，请用400×400或384×384`);return {name:file.name,image:im};}finally{URL.revokeObjectURL(url);}
 }
 async function load(files){
  if(!files.length)return;const token=++request,results=await Promise.allSettled(Array.from(files,read));if(token!==request)return;
  const errors=[];let added=0;
  for(const r of results){if(r.status==='rejected'){errors.push(r.reason.message);continue;}
   const v=r.value,size=variants[0]?.image.width;if(size&&size!==v.image.width){errors.push(`${v.name}：${v.image.width} × ${v.image.height}，当前变体为${size} × ${size}，请保持同尺寸`);continue;}
   variants.push(v);added++;
  }
  $('randomMessage').textContent=[added?`已追加${added}张。逐格随机选择，不旋转、不翻转。`:'没有添加有效新图片，原有变体保留。',...errors].join(' ');if(added)regenerate();$('randomUpload').value='';
 }
 $('randomUpload').onchange=e=>load(e.target.files);
 const drop=$('randomDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');load(e.dataTransfer.files);};
 $('randomReroll').onclick=()=>{seed=(seed+1)>>>0;$('randomSeed').value=seed;regenerate();};
 $('randomApplySeed').onclick=()=>{const n=Number($('randomSeed').value);if(!Number.isInteger(n)||n<0||n>4294967295){$('randomMessage').textContent='种子请输入0～4294967295的整数，当前排列保留。';return;}seed=n;regenerate();};
 $('randomGrid').onchange=()=>{[cols,rows]=$('randomGrid').value.split('x').map(Number);regenerate();};$('randomZoom').onchange=zoom;$('randomSeams').onchange=guides;$('randomNumbers').onchange=guides;
 window.addEventListener('resize',zoom);
 $('randomClear').onclick=()=>{request++;variants=[];layout=[];$('randomMessage').textContent='变体已清空，可载入新的同尺寸图片。';render();};
 $('randomExport').onclick=()=>{if(!variants.length)return;$('randomTiles').toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`母版变体随机平铺-${cols}x${rows}-种子${seed}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};
 render();
})();
