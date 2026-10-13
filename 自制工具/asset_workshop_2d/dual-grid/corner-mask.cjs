'use strict';
const assert=(ok,text)=>{if(!ok)throw Error(text);};
function cornerMask(corners){
 assert(corners&&['TL','TR','BL','BR'].every(k=>corners[k]===0||corners[k]===1),'四角必须为0/1');
 return corners.TL+2*corners.TR+4*corners.BL+8*corners.BR;
}
function checkGrid(s){assert(s&&Number.isInteger(s.width)&&Number.isInteger(s.height)&&s.width>=1&&s.height>=1&&s.width<=32&&s.height<=32&&Array.isArray(s.cells)&&s.cells.length===s.width*s.height&&s.cells.every(v=>v===0||v===1),'DataGrid需要1–32格及完整二值数组');return s;}
function traceCell(grid,x,y){
 checkGrid(grid);assert(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<=grid.width&&y<=grid.height,'显示格越界');
 const neighbors={},corners={};for(const[k,dx,dy]of [['TL',-1,-1],['TR',0,-1],['BL',-1,0],['BR',0,0]]){
  const nx=x+dx,ny=y+dy,outside=nx<0||ny<0||nx>=grid.width||ny>=grid.height,value=outside?0:grid.cells[ny*grid.width+nx];neighbors[k]={x:nx,y:ny,value,outside};corners[k]=value;
 }
 return{x,y,mask:cornerMask(corners),corners,neighbors};
}
function renderMasks(grid){checkGrid(grid);const cells=[];for(let y=0;y<=grid.height;y++)for(let x=0;x<=grid.width;x++)cells.push(traceCell(grid,x,y).mask);return{width:grid.width+1,height:grid.height+1,cells};}
function affectedRender(x,y){assert(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0,'Data格坐标无效');return[{x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}];}
function renderCellGeometry(x,y,c,ppu){
 assert([x,y].every(Number.isInteger)&&Number.isInteger(c)&&c>=2&&Number.isFinite(ppu)&&ppu>0,'显示坐标/格尺寸/PPU非法');const s=c/ppu;
 return{centerPixels:[x*c,y*c],topLeftPixels:[(x-.5)*c,(y-.5)*c],worldCenter:[x*s,y===0?0:-y*s],worldSize:s,worldTopLeft:[(x-.5)*s,-(y-.5)*s]};
}
module.exports={cornerMask,checkGrid,traceCell,renderMasks,affectedRender,renderCellGeometry};
