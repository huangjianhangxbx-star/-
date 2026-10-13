(function(root){
  'use strict';
  function alphaAt(mask,x,y,size=384){
    const u=x/(size-1),v=y/(size-1);
    const fields=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
    const value=(mask===6||mask===9)
      ? Math.max(...fields.map((f,i)=>(mask&(1<<i))?f:0))
      : fields.reduce((sum,f,i)=>sum+((mask&(1<<i))?f:0),0);
    return value>=0.5?255:0;
  }
  function maskAlpha(mask,size=384){
    const a=new Uint8ClampedArray(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)a[y*size+x]=alphaAt(mask,x,y,size);
    return a;
  }
  function tileMask(grid,x,y){
    const at=(x,y)=>grid[y]?.[x]?1:0;
    return at(x,y)+2*at(x+1,y)+4*at(x,y+1)+8*at(x+1,y+1);
  }
  function crossings(m){
    return [['top',1,2],['right',2,8],['bottom',4,8],['left',1,4]]
      .filter(([,a,b])=>Boolean(m&a)!==Boolean(m&b)).map(([name])=>name);
  }
  const api={alphaAt,maskAlpha,tileMask,crossings};
  if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.DualGrid=api;
})(typeof window==='undefined'?globalThis:window);
