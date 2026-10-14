let walkRevision=0,walkMask=24,walkPiece=0;
async function drawWalkthrough(){
 const revision=++walkRevision,e=WALLSTUDY.families[0].entries.find(e=>e.mask===walkMask),im=new Image();
 im.src=location.protocol==='file:'?'file:///'+WALLSTUDY.libraryRoot.replaceAll('\\','/')+'/'+e.sourcePng:'/library/'+e.sourcePng;await im.decode();if(revision!==walkRevision)return;
 const w=im.naturalWidth,h=im.naturalHeight,half=Math.floor(w/2),right=w-half;
 const rectangles=[[0,0,half,half],[half,0,right,half],[0,half,half,half],[half,half,right,half],[0,half*2,w,h-half*2]],colors=['#ffb65e','#7ad7eb','#c2d980','#dd96d5','#f3e1ba'];
 const source=document.getElementById('walk-source'),assembly=document.getElementById('walk-assembly'),piece=document.getElementById('walk-piece'),whole=document.createElement('canvas');whole.width=w;whole.height=h;whole.getContext('2d').drawImage(im,0,0);
 source.width=assembly.width=w;source.height=assembly.height=h;const s=source.getContext('2d'),a=assembly.getContext('2d');s.drawImage(im,0,0);a.fillStyle='#18222e';a.fillRect(0,0,w,h);
 const joined=document.createElement('canvas');joined.width=w;joined.height=h;
 rectangles.forEach(([x,y,pw,ph],i)=>{joined.getContext('2d').drawImage(im,x,y,pw,ph,x,y,pw,ph);s.strokeStyle=colors[i];s.lineWidth=i===walkPiece?6:2;s.strokeRect(x+2,y+2,pw-4,ph-4);s.fillStyle=colors[i];s.font='bold 22px sans-serif';s.fillText(String(i+1),x+10,y+28);if(i!==walkPiece){a.globalAlpha=.22;a.drawImage(im,x,y,pw,ph,x,y,pw,ph);a.globalAlpha=1;}else a.drawImage(im,x,y,pw,ph,x,y,pw,ph);a.strokeStyle=colors[i];a.lineWidth=i===walkPiece?5:1;a.strokeRect(x+2,y+2,pw-4,ph-4);});
 const[x,y,pw,ph]=rectangles[walkPiece];piece.style.borderColor=colors[walkPiece];piece.width=pw;piece.height=ph;piece.getContext('2d').drawImage(im,x,y,pw,ph,0,0,pw,ph);document.getElementById('walk-result').src=im.src;
 let exact=null;try{const original=whole.getContext('2d').getImageData(0,0,w,h).data,result=joined.getContext('2d').getImageData(0,0,w,h).data;exact=original.every((v,i)=>v===result[i]);}catch{}
 const names=['左上','右上','左下','右下','下面剩余的整条'];document.getElementById('piece-explanation').textContent=`现在看第${walkPiece+1}块：${names[walkPiece]}。左图同色框就是取图的位置；中间只显示这块；右图把它放回同色框，其他区域压暗。原片是${w}×${h}px，取图窗为[${x},${y},${pw},${ph}]。`;
 document.getElementById('walk-proof').textContent=exact?'五块全部合回后，与原片逐像素相同。这一步只解释“取哪里、放哪里”，不证明这些区域都能在别的墙片上通用。':'五块按原位置合回；本机HTTP可核对精确像素。';
 document.querySelectorAll('[data-piece]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.piece)===walkPiece)));
 STUDY.walkthrough={mask:walkMask,selected:walkPiece,exact,rectangles,authorLayersRecovered:false};
}
document.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>{walkPiece=Number(b.dataset.piece);void drawWalkthrough();});
document.getElementById('walk-example').onchange=e=>{walkMask=Number(e.target.value);void drawWalkthrough();};
drawWalkthrough().catch(e=>document.getElementById('walk-proof').textContent='实例加载失败：'+e.message);
