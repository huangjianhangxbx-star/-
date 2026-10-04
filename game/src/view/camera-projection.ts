export type CameraProjection={left:number;right:number;top:number;bottom:number};

// Pure world padding covers terrain edges, standing actors and architecture.
// Ground depth is foreshortened by the scene's fixed (0,28,22) view direction.
const groundDepth=28/Math.hypot(28,22);
function fit(w:number,h:number,width:number,height:number):CameraProjection{
 const viewportWidth=Math.max(1,w),viewportHeight=Math.max(1,h);
 const pixelsPerUnit=Math.min(viewportWidth/(width+2),viewportHeight/(height*groundDepth+2.4));
 const halfHeight=viewportHeight/(pixelsPerUnit*2),halfWidth=halfHeight*viewportWidth/viewportHeight;
 return {left:-halfWidth,right:halfWidth,top:halfHeight,bottom:-halfHeight};
}
export const fitTowerProjection=(w:number,h:number,width:number,height:number)=>fit(w,h,width,height);
export const explorationProjection=(w:number,h:number)=>fit(w,h,14,9);
