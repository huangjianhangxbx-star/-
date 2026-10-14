/* Observational source windows, never a recovered or lossless authoring master. */
async function materialBoard(){
 const data=WALLSTUDY,f=data.families[0],root=document.getElementById('material-parts'),parts=[];
 const states=['外侧两边','竖向边','横向边','内凹接角','内部留空'],corners=['左上','右上','左下','右下'];
 const state=(m,q)=>{const[a,b,d]=[[8,2,1],[16,2,4],[8,64,32],[16,64,128]][q];return !(m&a)&&!(m&b)?0:!(m&a)?1:!(m&b)?2:!(m&d)?3:4;};
 const cache=new Map();
 async function load(e){if(!cache.has(e.spriteKey)){const im=new Image();im.src=location.protocol==='file:'?'file:///'+data.libraryRoot.replaceAll('\\','/')+'/'+e.sourcePng:'/library/'+e.sourcePng;await im.decode();cache.set(e.spriteKey,im);}return cache.get(e.spriteKey);}
 for(let q=0;q<4;q++)for(let s=0;s<5;s++){
  const e=f.entries.filter(e=>state(e.mask,q)===s).sort((a,b)=>(a.width===341?0:1)-(b.width===341?0:1)||a.mask-b.mask)[0];
  if(!e)throw Error('缺少登记接角状态');const im=await load(e),half=Math.floor(e.width/2),x=q%2?half:0,y=q>1?half:0,w=q%2?e.width-half:half,h=half;
  if(y+h>im.height)throw Error('观察窗超出原片');
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,x,y,w,h,0,0,w,h);
  let pixelExact=null;try{const original=document.createElement('canvas');original.width=im.width;original.height=im.height;original.getContext('2d').drawImage(im,0,0);const a=original.getContext('2d').getImageData(x,y,w,h).data,b=c.getContext('2d').getImageData(0,0,w,h).data;pixelExact=a.every((v,i)=>v===b[i]);}catch{}
  const button=document.createElement('button');button.className='material-part';const label=document.createElement('span');label.textContent=corners[q]+' · '+states[s];const meta=document.createElement('small');meta.textContent='索引'+e.originalIndex+' / M'+e.mask;button.append(c,label,meta);
  button.onclick=()=>{document.getElementById('material-detail').textContent=`${corners[q]} / ${states[s]}：原片索引${e.originalIndex}，M${e.mask}；观察窗 [${x},${y},${w},${h}]px，原PPU ${e.ppu}。这是源片局部，不是已证明可复用的独立零件。`;const link=document.getElementById('material-source');link.href=im.src;link.textContent='打开这格对应的完整原片';};root.append(button);parts.push({quadrant:q,state:s,index:e.originalIndex,mask:e.mask,rect:[x,y,w,h],pixelExact});
 }
 const front=f.entries.find(e=>e.mask===24),im=await load(front),c=document.getElementById('material-front'),y=Math.round(im.width/2);c.width=im.width;c.height=im.height-y;c.getContext('2d').drawImage(im,0,y,im.width,im.height-y,0,0,im.width,im.height-y);
 window.STUDY.materialBoard={ready:true,parts,recoveredAuthorMaster:false,lossless47Reconstruction:false};
}
materialBoard().catch(e=>document.getElementById('material-detail').textContent='真实素材对照加载失败：'+e.message);
