export type PackItem={id:string;definitionId:string;quantity:number;weapon?:boolean;x?:number;y?:number};
export type PackInput={columns:number;rows:number;items:PackItem[];definitions:Record<string,{width:number;height:number;maxStack:number;category:string}>};
export type PackPlacement=PackItem&{x:number;y:number};
export type PackScore={occupied:number;rectangle:number;fragments:number;adjacent:number;tie:string};
export type PackResult={status:'optimal'|'feasible_unproven'|'cancelled'|'infeasible';placements:PackPlacement[];score?:PackScore;nodes:number};
/** Exact fixed-orientation enumeration. Same-category/shape permutations use stable ID symmetry. */
export function solveInventoryPack(input:PackInput,budgetMs=10000):PackResult{
 const {columns:w,rows:h,definitions:defs}=input,start=performance.now(),groups=new Map<string,PackItem[]>();let nodes=0,timedOut=false,best:PackPlacement[]|undefined,bestScore:PackScore|undefined;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>100)return {status:'cancelled',placements:[],nodes};
 for(const i of input.items){const d=defs[i.definitionId];if(!d||![d.width,d.height,d.maxStack,i.quantity].every(n=>Number.isSafeInteger(n)&&n>0))return {status:'infeasible',placements:[],nodes};const key=i.weapon?i.id:i.definitionId;groups.set(key,[...(groups.get(key)??[]),i]);}
 const items:PackItem[]=[];for(const rows of groups.values()){rows.sort((a,b)=>a.id.localeCompare(b.id));let total=rows.reduce((n,i)=>n+i.quantity,0),j=0;const max=defs[rows[0].definitionId].maxStack;while(total>0){const old=rows[j++];if(!old)return {status:'infeasible',placements:[],nodes};const n=Math.min(total,max);items.push({...old,quantity:n});total-=n;}}
 items.sort((a,b)=>{const x=defs[a.definitionId],y=defs[b.definitionId];return y.width*y.height-x.width*x.height||y.width-x.width||y.height-x.height||x.category.localeCompare(y.category)||a.id.localeCompare(b.id);});
 const occupied=items.reduce((n,i)=>n+defs[i.definitionId].width*defs[i.definitionId].height,0);if(occupied>w*h)return {status:'infeasible',placements:[],nodes};
 const cells=Array<string|null>(w*h).fill(null),path:PackPlacement[]=[];
 function score():PackScore{let rectangle=0,adjacent=0,fragments=0;for(let top=0;top<h;top++){const free=Array(w).fill(true);for(let bottom=top;bottom<h;bottom++){let run=0;for(let x=0;x<w;x++){free[x]&&=cells[bottom*w+x]===null;run=free[x]?run+1:0;rectangle=Math.max(rectangle,run*(bottom-top+1));}}}const seen=new Set<number>();for(let i=0;i<w*h;i++){if(cells[i]===null&&!seen.has(i)){fragments++;const q=[i];seen.add(i);while(q.length){const n=q.pop()!;for(const v of [n%w>0?n-1:-1,n%w<w-1?n+1:-1,n>=w?n-w:-1,n<(h-1)*w?n+w:-1])if(v>=0&&cells[v]===null&&!seen.has(v)){seen.add(v);q.push(v);}}}if(cells[i]){if(i%w<w-1&&cells[i]===cells[i+1])adjacent++;if(i<(h-1)*w&&cells[i]===cells[i+w])adjacent++;}}
 return {occupied,rectangle,fragments,adjacent,tie:[...path].sort((a,b)=>a.id.localeCompare(b.id)).map(i=>String(i.y*w+i.x).padStart(3,'0')).join(',')};}
 function better(a:PackScore,b?:PackScore){return !b||a.occupied<b.occupied||a.occupied===b.occupied&&(a.rectangle>b.rectangle||a.rectangle===b.rectangle&&(a.fragments<b.fragments||a.fragments===b.fragments&&(a.adjacent>b.adjacent||a.adjacent===b.adjacent&&a.tie<b.tie)));}
 function visit(index:number){nodes++;if((nodes&1023)===0&&performance.now()-start>budgetMs){timedOut=true;return;}if(index===items.length){const value=score();if(better(value,bestScore)){bestScore=value;best=path.map(i=>({...i}));}return;}
  const item=items[index],d=defs[item.definitionId],prior=index?defs[items[index-1].definitionId]:undefined,min=prior&&prior.width===d.width&&prior.height===d.height&&prior.category===d.category?path[index-1].y*w+path[index-1].x+1:0;
  for(let y=0;y<=h-d.height&&!timedOut;y++)for(let x=0;x<=w-d.width&&!timedOut;x++){if(y*w+x<min)continue;const fill:number[]=[];let fit=true;for(let dy=0;dy<d.height;dy++)for(let dx=0;dx<d.width;dx++){const cell=(y+dy)*w+x+dx;if(cells[cell]!==null)fit=false;fill.push(cell);}if(!fit)continue;for(const n of fill)cells[n]=d.category;path.push({...item,x,y});visit(index+1);path.pop();for(const n of fill)cells[n]=null;}
 }
 visit(0);return {status:timedOut?best?'feasible_unproven':'cancelled':best?'optimal':'infeasible',placements:best??[],score:bestScore,nodes};
}
