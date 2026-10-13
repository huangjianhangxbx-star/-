'use strict';
const {PNG}=require('pngjs');
function solid(n,color=[22,29,34]){const p=new PNG({width:n,height:n});for(let i=0;i<p.data.length;i+=4)p.data.set([...color,255],i);return PNG.sync.write(p);}
function continuousStone(c=64,K=4){
 const n=c*K,p=new PNG({width:n,height:n}),rowSize=c/2;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const row=Math.floor(y/rowSize),q=(x+(row%2)*c/2)%c,edge=x<2||x>=n-2||y<2||y>=n-2||q<2||q>=c-2||y%rowSize<2||y%rowSize>=rowSize-2,block=(Math.floor((x+(row%2)*c/2)/c)+row*3)%5;
  p.data.set(edge?[10,14,12,255]:[63+block*3,76+block*3,70+block*2,255],(y*n+x)*4);
 }
 return PNG.sync.write(p);
}
function caseGrid(name,size=8){
 if(![1,2,3,8,16].includes(size))throw Error('地图演示尺寸无效');const cells=Array(size*size).fill(0),put=(x,y)=>{if(x>=0&&y>=0&&x<size&&y<size)cells[y*size+x]=1;},mid=Math.floor(size/2);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let on=false;
  switch(name){case'empty':break;case'full':on=true;break;case'single':on=x===mid&&y===mid;break;case'line':on=y===mid;break;case'cross':on=x===mid||y===mid;break;case'rectangle':on=x>=1&&y>=1&&x<size-1&&y<size-1;break;case'hole':on=x>=1&&y>=1&&x<size-1&&y<size-1&&!(x===mid&&y===mid);break;case'checker':on=(x+y)%2===0;break;case'border':on=x===0||y===0||x===size-1||y===size-1;break;case'L':on=x===1||y===size-2;break;case'T':on=y===1||x===mid;break;case'U':on=x===1||x===size-2||y===size-2;break;case'island':on=(x-mid)**2+(y-mid)**2<Math.max(1,(size/3)**2);break;default:throw Error('未知地图场景');}
  if(on)put(x,y);
 }
 return{width:size,height:size,cells};
}
module.exports={solid,continuousStone,caseGrid};
