// Verified Blue direction roots. English-named branches are animated transform
// sources (e.g. a1 moves zuoshang onto 左); their attachment result must survive.
const directionRoots=new Set(['左','左上','左下','上','下']);
type Bone={data:{name:string};parent?:Bone|null};
type Slot={bone:Bone;setAttachment(value:null):void};
function rootBranch(bone:Bone):string{while(bone.parent?.parent)bone=bone.parent;return bone.data.name;}
export function maskBlueDirection(slots:readonly Slot[],selected:string):void{
 for(const slot of slots){const branch=rootBranch(slot.bone);
  if(directionRoots.has(branch)&&branch!==selected)slot.setAttachment(null);
 }
}
/** Fixed standing frame ignores offstage source rigs, then restores animation results. */
export function blueStandingBounds(skeleton:any,offset:any,size:any):void{
 const attachments=skeleton.slots.map((slot:any)=>slot.getAttachment());
 try{for(const slot of skeleton.slots)if(rootBranch(slot.bone)!=='左')slot.setAttachment(null);skeleton.getBounds(offset,size,[]);}
 finally{skeleton.slots.forEach((slot:any,i:number)=>slot.setAttachment(attachments[i]));}
}
