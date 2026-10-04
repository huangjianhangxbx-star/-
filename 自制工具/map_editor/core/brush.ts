import {faceNormals,faceOffsets,resolveFace} from './surface.ts';
import type {EditorDocument} from './document.ts';
export type BrushConfig={mode:string;action:string;shape:string;size:number;thickness:number;level:number;direction:number;color:number;tag:string};
export type Candidate={x:number;y:number;z:number;face:number;status:'applied'|'noop'|'skipped';reason?:string};
const key=(p:{x:number;y:number;z:number})=>`${p.x},${p.y},${p.z}`;
export function strokeLine(a:{x:number;y:number},b:{x:number;y:number}){
 const steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));if(steps>512)throw Error('单次笔画跨度过大');
 return Array.from({length:steps+1},(_,i)=>({x:Math.round(a.x+(b.x-a.x)*i/(steps||1)),y:Math.round(a.y+(b.y-a.y)*i/(steps||1))}));
}
export function brushCandidates(e:EditorDocument,hit:any,c:BrushConfig):Candidate[]{
 if(![c.size,c.thickness,c.level].every(Number.isInteger)||c.size<1||c.size>33||c.thickness<1||c.thickness>256||![1,-1].includes(c.direction)||!['square','circle'].includes(c.shape))throw Error('笔刷尺寸1至33格、厚度1至256层，参数必须有效');
 if(c.size*c.size*(c.mode==='property'?1:c.thickness)>250000)throw Error('笔刷体积超过25万格预算');
 const result:Candidate[]=[],face=hit.face??4,n=faceNormals[face],offset=faceOffsets[face];
 if(!n)throw Error('表面方向无效');
 const normalAxis=n.findIndex(v=>v!==0), tangents=[0,1,2].filter(a=>a!==normalAxis);
 for(let i=0;i<c.size;i++)for(let j=0;j<c.size;j++){
  const u=i-Math.floor(c.size/2),v=j-Math.floor(c.size/2);
  if(c.shape==='circle'&&u*u+v*v>(c.size/2)**2)continue;
  let plane=[hit.x+u,hit.y+v,hit.z];
  if(c.mode==='stack'||c.mode==='property'){plane=[hit.x,hit.y,hit.z];plane[tangents[0]]+=u;plane[tangents[1]]+=v;}
  let targets:number[][]=[];
  if(c.mode==='property')targets=[plane];
  else if(c.mode==='height'&&c.action==='erase'){
   targets=[...(e.columns.get(`${plane[0]},${plane[1]}`)??[])].map(k=>k.split(',').map(Number));
   if(!targets.length)targets=[[plane[0],plane[1],c.level-1]];
  }else for(let d=0;d<c.thickness;d++){
   if(c.mode==='stack')targets.push(plane.map((value,a)=>value+offset[a]+n[a]*(c.action==='add'?d+1:-d)));
   else targets.push([plane[0],plane[1],c.mode==='height'?c.level-c.thickness+d:c.level+c.direction*d]);
  }
  for(const p of targets){
   const target:Candidate={x:p[0],y:p[1],z:p[2],face,status:'applied'}; const old=e.cells.get(key(target));
   let reason:string|undefined;
   if((c.mode==='height'&&(c.level-c.thickness < -8192||c.level-1>8192))||p.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>8192))reason='out-of-bounds';
   else if(c.mode==='height'&&e.protected.has(`${p[0]},${p[1]}`))reason='protected-column';
   else if(c.mode==='property'&&!resolveFace(e.cells,p[0],p[1],p[2],face))reason='missing-support';
   else if(c.mode==='property'&&c.action!=='erase'&&['walk','highground'].includes(c.tag)&&face!==4)reason='not-standing-face';
   if(reason){target.status='skipped';target.reason=reason;}
   else if((c.mode!=='height'||c.action==='repaint')&&c.mode!=='property'&&((c.action==='add'&&old)||((c.action==='erase'||c.action==='repaint')&&!old)||(c.action==='repaint'&&old?.color===c.color)))target.status='noop';
   result.push(target);
  }
 }
 return result;
}
export function applyBrush(e:EditorDocument,points:Candidate[],c:BrushConfig,seen=new Set<string>()){
 e.check();const pending=points.filter(p=>!seen.has(`${c.mode}:${key(p)}:${p.face}`));
 const additions=new Set(pending.filter(p=>p.status==='applied'&&!e.cells.has(key(p))&&!['property'].includes(c.mode)&&c.action==='add').map(key));
 if(e.cells.size+additions.size>250000)throw Error('体素预算超限，已取消本笔');
 const columns=new Set<string>();
 e.batch(()=>{for(const p of pending){const k=`${c.mode}:${key(p)}:${p.face}`;seen.add(k);
  if(p.status==='skipped'){e.skip(p.reason!,key(p));continue;}if(p.status==='noop')continue;
  if(c.action==='repaint'&&c.mode!=='property'){const old=e.cells.get(key(p));if(old)e.put(p.x,p.y,p.z,c.color,old.owner??'height');}
  else if(c.mode==='height'){const col=`${p.x},${p.y}`;if(columns.has(col))continue;columns.add(col);if(c.action==='erase')e.eraseColumn(p.x,p.y);else e.height(p.x,p.y,c.level,c.thickness,c.color);}
  else if(c.mode==='property')e.surface(p.x,p.y,p.z,p.face,c.action==='erase'?'':c.tag);
  else {const old=e.cells.get(key(p));if(c.action==='repaint'){if(old)e.put(p.x,p.y,p.z,c.color,old.owner??'height');}
   else if(c.action==='erase'){if(old)e.volume(p.x,p.y,p.z,c.color,true);}
   else if(!old)e.volume(p.x,p.y,p.z,c.color);
  }
 }});
}



