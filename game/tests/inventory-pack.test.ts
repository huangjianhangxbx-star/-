import {test,expect} from 'vitest';
test('exact solver escapes left-fill trap without rotation and proves contiguous free rectangle',async()=>{
 const m=await import('../src/core/inventory-pack').catch(()=>undefined);expect(m).toBeDefined();const items=[{id:'a',definitionId:'wide',quantity:1},{id:'b',definitionId:'wide',quantity:1},{id:'c',definitionId:'tall',quantity:1},{id:'d',definitionId:'tall',quantity:1}];
 const defs={wide:{width:3,height:1,maxStack:1,category:'a'},tall:{width:1,height:2,maxStack:1,category:'b'}};const q=m!.solveInventoryPack({columns:4,rows:3,items,definitions:defs},30000);expect(q.status).toBe('optimal');expect(q.placements).toHaveLength(4);expect(q.score!.occupied).toBe(10);expect(q.score!.rectangle).toBe(2);
 const again=m!.solveInventoryPack({columns:4,rows:3,items,definitions:defs},30000);expect(again.placements).toEqual(q.placements);
});
test('legal stacks compact to minimum area; independent one-row enumeration leaves largest gap',async()=>{const m=await import('../src/core/inventory-pack').catch(()=>undefined);expect(m).toBeDefined();const q=m!.solveInventoryPack({columns:5,rows:1,items:[{id:'a',definitionId:'seed',quantity:3},{id:'b',definitionId:'seed',quantity:4}],definitions:{seed:{width:1,height:1,maxStack:5,category:'farm'}}});expect(q.status).toBe('optimal');expect(q.placements.reduce((n,i)=>n+i.quantity,0)).toBe(7);expect(q.score!.occupied).toBe(2);expect(q.score!.rectangle).toBe(3);});


// Independent labeled-piece brute force oracle: no production score/search helpers.
test('small-grid exact results match independent enumeration across shapes and categories',async()=>{
 const {solveInventoryPack}=await import('../src/core/inventory-pack');
 for(const shapes of [[[2,1,'a'],[1,2,'b']],[[1,1,'a'],[1,1,'b'],[1,1,'a']],[[2,1,'a'],[1,1,'a'],[1,1,'b']]] as const){
  const w=3,h=2,defs=Object.fromEntries(shapes.map(([width,height,category],i)=>['d'+i,{width,height,category,maxStack:1}])),items=shapes.map((_,i)=>({id:String(i),definitionId:'d'+i,quantity:1}));let best:number[]|undefined;const cells=Array(6).fill(-1);
  function leaf(){const empty=cells.map((v,i)=>v<0?i:-1).filter(i=>i>=0);let rect=0,components=0,adj=0;for(let x0=0;x0<w;x0++)for(let y0=0;y0<h;y0++)for(let x1=x0;x1<w;x1++)for(let y1=y0;y1<h;y1++){let free=true;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(cells[y*w+x]>=0)free=false;if(free)rect=Math.max(rect,(x1-x0+1)*(y1-y0+1));}const remaining=new Set(empty);while(remaining.size){components++;const queue=[remaining.values().next().value!];remaining.delete(queue[0]);for(const n of queue)for(const v of [...remaining])if(Math.abs(n%w-v%w)+Math.abs(Math.floor(n/w)-Math.floor(v/w))===1){queue.push(v);remaining.delete(v);}}for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)if(cells[a]>=0&&cells[b]>=0&&Math.abs(a%w-b%w)+Math.abs(Math.floor(a/w)-Math.floor(b/w))===1&&shapes[cells[a]][2]===shapes[cells[b]][2])adj++;const value=[rect,-components,adj];if(!best||value.some((v,i)=>v!==best![i]&&value.slice(0,i).every((n,j)=>n===best![j])&&v>best![i]))best=value;}
  function enumerate(i:number){if(i===shapes.length)return leaf();const [dw,dh]=shapes[i];for(let y=0;y<=h-dh;y++)for(let x=0;x<=w-dw;x++){const indices=[];for(let yy=y;yy<y+dh;yy++)for(let xx=x;xx<x+dw;xx++)indices.push(yy*w+xx);if(indices.some(n=>cells[n]>=0))continue;indices.forEach(n=>cells[n]=i);enumerate(i+1);indices.forEach(n=>cells[n]=-1);}}
  enumerate(0);const q=solveInventoryPack({columns:w,rows:h,definitions:defs,items});expect(q.status).toBe('optimal');expect([q.score!.rectangle,-q.score!.fragments,q.score!.adjacent]).toEqual(best);
 }
});

test('bounded search reports feasible-unproven instead of claiming an optimum',async()=>{const {solveInventoryPack}=await import('../src/core/inventory-pack');const items=Array.from({length:8},(_,i)=>({id:String(i),definitionId:'d'+i,quantity:1})),definitions=Object.fromEntries(items.map(i=>[i.definitionId,{width:1,height:1,maxStack:1,category:i.id}]));const q=solveInventoryPack({columns:5,rows:2,items,definitions},-1);expect(q.status).toBe('feasible_unproven');expect(q.placements).toHaveLength(8);});
