'use strict';
// Derived tuple-by-tuple from the two pinned references, not copied implementation.
const MASK_TO_EXTERNAL=[12,15,8,9,0,11,14,7,13,4,1,10,3,2,5,6];
function externalIndex(mask){if(!Number.isInteger(mask)||mask<0||mask>15)throw Error('mask必须0–15');return MASK_TO_EXTERNAL[mask];}
function externalOrder(){return Array.from({length:16},(_,index)=>MASK_TO_EXTERNAL.indexOf(index));}
function unityCell(role,x,y){if(!['data','render'].includes(role)||![x,y].every(Number.isInteger))throw Error('Unity适配格坐标无效');return[x,role==='data'?-y-1:y===0?0:-y];}
function stateTable(){return Array.from({length:16},(_,mask)=>({mask,corners:{TL:mask&1?1:0,TR:mask&2?1:0,BL:mask&4?1:0,BR:mask&8?1:0},atlas:{column:mask%4,row:Math.floor(mask/4)},externalIndex:externalIndex(mask),file:`mask-${String(mask).padStart(2,'0')}.png`}));}
module.exports={externalIndex,externalOrder,unityCell,stateTable};
