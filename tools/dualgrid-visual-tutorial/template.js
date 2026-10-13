/* 截图逐格读取所得，不把该排列声明为任意插件的通用索引。 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const slots=[4,10,13,12,9,14,15,7,2,3,11,5,0,8,6,1];
 let current=7,tiles=[],source=null,names=[];
 const idOf=m=>'M'+String(m).padStart(2,'0');
 function shape(m,size,color){
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle=color;
  for(const [x,y,bit] of [[0,0,1],[1,0,2],[0,1,4],[1,1,8]])if(m&bit)g.fillRect(x*size/2,y*size/2,size/2,size/2);
  return c;
 }
 function atlas(size,textured){
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),s=size/4;g.imageSmoothingEnabled=false;
  slots.forEach((m,i)=>{
   let tile;
   if(!textured)tile=shape(m,s,'#29b52b');
   else if($('templateSmooth').checked)tile=tiles[m];
   else{tile=shape(m,s,'#fff');const t=tile.getContext('2d');t.globalCompositeOperation='source-in';t.drawImage(source,0,0,s,s);}
   g.drawImage(tile,i%4*s,Math.floor(i/4)*s,s,s);
  });return c;
 }
 function drawGuides(){
  const c=$('templateTextureGuide'),g=c.getContext('2d'),s=c.width/4;g.clearRect(0,0,c.width,c.height);
  if($('templateLines').checked){g.strokeStyle='#284b7190';g.lineWidth=1;g.setLineDash([4,4]);g.beginPath();for(let i=0;i<4;i++){g.moveTo((i+.5)*s,0);g.lineTo((i+.5)*s,c.height);g.moveTo(0,(i+.5)*s);g.lineTo(c.width,(i+.5)*s);}g.stroke();g.setLineDash([]);g.strokeStyle='#20344d';g.lineWidth=2;g.beginPath();for(let i=0;i<=4;i++){g.moveTo(i*s,0);g.lineTo(i*s,c.height);g.moveTo(0,i*s);g.lineTo(c.width,i*s);}g.stroke();}
  const k=slots.indexOf(current);g.strokeStyle='#f08d38';g.lineWidth=5;g.strokeRect(k%4*s+3,Math.floor(k/4)*s+3,s-6,s-6);
 }
 function seamBand(size){
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),s=size/4,w=14*s/400;
  slots.forEach((m,i)=>{
   const band=document.createElement('canvas');band.width=band.height=s;const b=band.getContext('2d');
   b.fillStyle='rgba(225,130,48,0.9019607843137255)';
   b.fillRect(0,0,s,w);b.fillRect(0,s-w,s,w);b.fillRect(0,w,w,s-2*w);b.fillRect(s-w,w,w,s-2*w);
   b.globalCompositeOperation='destination-in';b.drawImage(shape(m,s,'#fff'),0,0);
   g.drawImage(band,i%4*s,Math.floor(i/4)*s);
  });return c;
 }
 function render(){
  if(!source)return;
  for(const [id,tex]of [['templateShape',false],['templateTexture',true]]){const c=$(id),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.drawImage(atlas(c.width,tex),0,0);}
  const sc=$('templateSeamGuide'),sg=sc.getContext('2d');sg.clearRect(0,0,sc.width,sc.height);if($('templateSeams').checked)sg.drawImage(seamBand(sc.width),0,0);
  const host=$('templateOverlay');host.replaceChildren();host.classList.toggle('cut-lines',$('templateLines').checked);
  slots.forEach((m,i)=>{const b=document.createElement('button'),row=Math.floor(i/4)+1,col=i%4+1;
   b.setAttribute('aria-label',`模板第${row}行${col}列，${names[m]}`);b.setAttribute('aria-pressed',m===current);b.className=m===current?'selected':'';
   if($('templateLabels').checked)b.textContent=idOf(m);
   b.title=`第${row}行第${col}列：${idOf(m)} ${names[m]}`;
   b.onclick=()=>window.dispatchEvent(new CustomEvent('template-select',{detail:m}));host.append(b);
  });
  const k=slots.indexOf(current);$('templateSelection').textContent=`选中：第 ${Math.floor(k/4)+1} 行 · 第 ${k%4+1} 列 → ${idOf(current)} · ${names[current]}。`+(current===7?' 三个角留石砖，右下角挖空；这正是下方默认教学的那一张。':' 点击下方四步按钮，查看这格的保留区域与手绘位置。');drawGuides();
 }
 function download(c,name){c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
 function markedTemplate(withGreen,withSeams=false){
  const c=withGreen?atlas(1600,false):document.createElement('canvas');
  if(!withGreen)c.width=c.height=1600;
  const g=c.getContext('2d');
  if(withSeams)g.drawImage(seamBand(1600),0,0);
  // 200px中线为虚线，400px切格线为实线；不导出当前选择框。
  g.strokeStyle='#496a8a';g.lineWidth=2;g.setLineDash([10,8]);g.beginPath();
  for(let i=0;i<4;i++){const p=i*400+200;g.moveTo(p,0);g.lineTo(p,1600);g.moveTo(0,p);g.lineTo(1600,p);}g.stroke();g.setLineDash([]);
  g.fillStyle='#20344d';
  for(let i=0;i<=4;i++){const p=Math.max(0,Math.min(1596,i*400-2));g.fillRect(p,0,4,1600);g.fillRect(0,p,1600,4);}
  g.font='bold 32px Consolas, monospace';g.textBaseline='top';g.textAlign='left';g.lineJoin='round';g.lineWidth=5;
  slots.forEach((m,i)=>{const x=i%4*400+14,y=Math.floor(i/4)*400+14;g.strokeStyle='#20344d';g.strokeText(idOf(m),x,y);g.fillStyle='#fff';g.fillText(idOf(m),x,y);});
  return c;
 }
 for(const id of ['templateLines','templateLabels','templateSmooth','templateSeams'])$(id).onchange=render;
 $('exportTemplate').onclick=()=>download(atlas(1536,false),'截图布局-透明占用模板-1536.png');
 $('exportTemplate400').onclick=()=>download(atlas(1600,false),'双网格-绿色模板-每格400-整版1600.png');
 $('exportTemplateMarked').onclick=()=>download(markedTemplate(true),'双网格-绿色模板-400格-带网格编号.png');
 $('exportTemplateGuides').onclick=()=>download(markedTemplate(false),'双网格-400格-网格编号参考层.png');
 $('exportTemplateSeams').onclick=()=>download(markedTemplate(true,true),'双网格-400格-绿色模板-网格编号接缝带.png');
 $('exportSeamGuides').onclick=()=>download(markedTemplate(false,true),'双网格-400格-接缝带网格编号参考层.png');
 $('exportTemplateTexture').onclick=()=>download(atlas(1536,true),`截图布局-${$('templateSmooth').checked?'平滑':'直角'}-母版示范-1536.png`);
 $('exportTemplateTable').onclick=()=>{
  const rows=['槽位0起,行1起,列1起,教材编号,名称,左上1,右上2,左下4,右下8',...slots.map((m,i)=>[i,Math.floor(i/4)+1,i%4+1,idOf(m),names[m],...[1,2,4,8].map(b=>m&b?1:0)].join(','))];
  const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='截图布局-槽位对照.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 window.TemplateLesson={slots:Object.freeze([...slots]),update(m,t,s,n){current=m;tiles=t;source=s;names=n;render();}};
})();
