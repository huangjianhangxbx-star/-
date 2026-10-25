import {performance} from 'node:perf_hooks';
import {placePaintPatch} from '../core/paint-clipboard.ts';
import {PaintSurfaceDomain} from '../core/paint-surface-domain.ts';
const cells=Array.from({length:1024},(_,i)=>({x:i%32,y:Math.floor(i/32),z:0}));
const d=new PaintSurfaceDomain(cells,new Set(cells.map(c=>`${c.x},${c.y},0`)),.25);
const patch={width:512,height:512,pixels:Array.from({length:662},(_,i)=>({u:(i*73)%512,v:Math.floor(i*73/512)%512,color:'#ff0000'}))};
const times=[];let count=0;
for(let i=0;i<50;i++){const hit=d.pixel({face:4,plane:1},256+i%8,256)!;const start=performance.now();count+=placePaintPatch(patch,d,hit,0,1,false).length;times.push(performance.now()-start);}
times.sort((a,b)=>a-b);console.log(JSON.stringify({scenario:'662-painted-pixels-in-512-square',count,medianMs:times[25],p95Ms:times[47]}));
