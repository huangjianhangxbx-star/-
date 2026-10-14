/* Local source pixels explain visual regions; these are not recovered author layers. */
async function loadLesson(){
 const data=window.WALLSTUDY,family=data.families[0],entry=family.entries.find(e=>e.mask===24);
 const url=e=>location.protocol==='file:'?'file:///'+data.libraryRoot.replaceAll('\\','/')+'/'+e.sourcePng:'/library/'+e.sourcePng;
 const source=document.getElementById('lesson-source');source.src=url(entry);await source.decode();
 const w=source.naturalWidth,h=source.naturalHeight,split=Math.round(w/2);
 // A half-cell line is an observation aid, not a recovered source layer boundary.
 const whole=document.createElement('canvas');whole.width=w;whole.height=h;whole.getContext('2d').drawImage(source,0,0);
 function patch(id,y,height){const c=document.getElementById(id);c.width=w;c.height=height;c.getContext('2d').drawImage(source,0,y,w,height,0,0,w,height);return c;}
 const top=patch('lesson-top',0,split),front=patch('lesson-front',split,h-split),joined=document.getElementById('lesson-joined');joined.width=w;joined.height=h;
 const ctx=joined.getContext('2d');ctx.drawImage(top,0,0);ctx.drawImage(front,0,split);
 let exact=null;try{const a=whole.getContext('2d').getImageData(0,0,w,h).data,b=ctx.getImageData(0,0,w,h).data;exact=a.every((v,i)=>v===b[i]);}catch{ /* file:// image display works, pixel reads may be blocked */ }
 const meta=document.getElementById('lesson-meta');meta.textContent=`这张实际原片：${w}×${h}px，PPU ${entry.ppu}。橙线在第${split}行，只用于分区观察；重叠、暗色与黑线也都是原PNG内容。`;
 document.getElementById('lesson-status').textContent=exact===true?'两块按原坐标合回，逐RGBA与原片完全一致。没有改色、补笔或缩放源像素。':'分区按原坐标合回；精确像素比较需要本机HTTP模式。';
 document.getElementById('lesson-line').style.top=(split/h*100)+'%';
 const examples=document.getElementById('lesson-examples');examples.replaceChildren();
 for(const [mask,label]of [[0,'独立短柱：有两个端头'],[24,'横向直段：中间这片可重复'],[10,'转向接合：需检查内外角']]){
  const e=family.entries.find(t=>t.mask===mask);if(!e)continue;const card=document.createElement('figure'),im=document.createElement('img'),caption=document.createElement('figcaption');im.src=url(e);im.alt=label;caption.textContent=label;card.append(im,caption);examples.append(card);
 }
 window.STUDY.lesson={pixelExact:exact,sourceIndex:entry.originalIndex,splitRow:split,actualPPU:entry.ppu,recoveredAuthorLayers:false};
}
loadLesson().catch(e=>document.getElementById('lesson-status').textContent='原图教学加载失败：'+e.message);
