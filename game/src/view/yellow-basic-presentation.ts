/** Presentation sampling only; combat events remain on the authoritative clock. */
export function yellowBasicPresentation(pose:string,time:number):{pose:string;time:number}{
 if(pose!=='a3'||time<=.4)return {pose,time};
 // SAMPLE visual return: replay the original post-End tail in .24 simulation seconds.
 // Hit / Break / End / Finish and full-combo recovery are never dispatched here.
 if(time<.64)return {pose,time:.4+(time-.4)/.24*(1.2667-.4)};
 return {pose:'_stand',time:time-.64};
}
