'use strict';
function at(px,py,cell,width,height,offset){if(![px,py,cell].every(Number.isFinite)||cell<=0)return null;const x=Math.floor(px/cell-offset),y=Math.floor(py/cell-offset);return x>=0&&y>=0&&x<width&&y<height?{x,y}:null;}
const dataCellAt=(px,py,cell,width,height)=>at(px,py,cell,width,height,.5);
const renderCellAt=(px,py,cell,width,height)=>at(px,py,cell,width,height,0);
function check(a,b,value){if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isInteger)||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>128||![0,1].includes(value))throw Error('笔刷坐标或地形值非法');}
function lineCells(a,b,value){check(a,b,value);const out=[];let x=a.x,y=a.y;const dx=Math.abs(b.x-a.x),sx=a.x<b.x?1:-1,dy=-Math.abs(b.y-a.y),sy=a.y<b.y?1:-1;let error=dx+dy;
 for(;;){out.push({x,y,value});if(x===b.x&&y===b.y)break;const e=2*error;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}}return out;
}
function rectangleCells(a,b,value){check(a,b,value);const out=[];for(let y=Math.min(a.y,b.y);y<=Math.max(a.y,b.y);y++)for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)out.push({x,y,value});return out;}
module.exports={dataCellAt,renderCellAt,lineCells,rectangleCells};
