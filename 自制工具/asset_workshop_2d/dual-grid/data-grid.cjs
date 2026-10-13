'use strict';
const {checkGrid,renderMasks,traceCell,affectedRender}=require('./corner-mask.cjs');
function createDataGrid(initial){
 checkGrid(initial);let grid={width:initial.width,height:initial.height,cells:[...initial.cells]},render=renderMasks(grid);const past=[],future=[];
 function update(previous){const points=new Map();for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++)if(previous[y*grid.width+x]!==grid.cells[y*grid.width+x])for(const p of affectedRender(x,y))points.set(`${p.x},${p.y}`,p);
  const changed=[...points.values()].sort((a,b)=>a.y-b.y||a.x-b.x).map(p=>({...p,mask:traceCell(grid,p.x,p.y).mask}));for(const p of changed)render.cells[p.y*render.width+p.x]=p.mask;return changed;
 }
 function paint(edits){
  if(!Array.isArray(edits)||edits.length>1024||edits.some(e=>!e||!Number.isInteger(e.x)||!Number.isInteger(e.y)||e.x<0||e.y<0||e.x>=grid.width||e.y>=grid.height||![0,1].includes(e.value)))throw Error('涂画坐标或地形无效，未修改地图');
  const before=[...grid.cells];for(const e of edits)grid.cells[e.y*grid.width+e.x]=e.value;const changed=update(before);if(changed.length){past.push(before);if(past.length>64)past.shift();future.length=0;}return changed;
 }
 function history(from,to){if(!from.length)return[];const before=[...grid.cells];to.push(before);grid.cells=from.pop();return update(before);}
 return{snapshot:()=>({width:grid.width,height:grid.height,cells:[...grid.cells]}),render:()=>({width:render.width,height:render.height,cells:[...render.cells]}),paint,undo:()=>history(past,future),redo:()=>history(future,past),trace:(x,y)=>traceCell(grid,x,y)};
}
module.exports={createDataGrid};
