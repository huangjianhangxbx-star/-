import type {GameState,Unit} from '../core/types';
import {runtime} from './spine';
import {maskBlueDirection,blueStandingBounds} from './blue-direction-mask';
let nativeRuntime:Promise<any>|undefined;
// Vendor globals are captured once. Loading 4.1 must never merge into the 3.8 namespace.
async function referenceRuntime():Promise<any>{
 return nativeRuntime??= (async()=>{const legacy=await runtime();const w=window as any;w.spine=undefined;
  try{return await new Promise<any>((resolve,reject)=>{const script=document.createElement('script');script.src='/__al01-assets/vendor/spine-webgl-4.1.56.js';script.onload=()=>resolve(w.spine);script.onerror=()=>reject(new Error('Hunter Reference assets unavailable: Spine 4.1'));document.head.append(script);});}
  finally{w.spine=legacy;}
 })();
}
export class ReferenceBlueVisual {
 readonly canvas=document.createElement('canvas');ready=false;portrait='';
 private renderer:any;private manager:any;private skeleton:any;private animation:any;private track:any;
 private lastPose='';private direction='';private poseStart=0;
 private constructor(private s:any){this.canvas.width=this.canvas.height=512;}
 static async load():Promise<ReferenceBlueVisual>{
  const response=await fetch('/__al01-assets/blue/unit.json');if(!response.ok)throw new Error('Hunter Reference assets unavailable: blue/unit.json');
  const s=await referenceRuntime(),v=new ReferenceBlueVisual(s),context=new s.ManagedWebGLRenderingContext(v.canvas,{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
  v.renderer=new s.SceneRenderer(v.canvas,context);v.manager=new s.AssetManager(context,'/__al01-assets/blue/');
  await Promise.all([new Promise<void>((ok,bad)=>v.manager.loadTextureAtlas('unit.atlas',()=>ok(),(_p:string,e:string)=>bad(new Error(e)))),new Promise<void>((ok,bad)=>v.manager.loadJson('unit.json',()=>ok(),(_p:string,e:string)=>bad(new Error(e))))]);
  const data=new s.SkeletonJson(new s.AtlasAttachmentLoader(v.manager.get('unit.atlas'))).readSkeletonData(v.manager.get('unit.json'));
  v.skeleton=new s.Skeleton(data);v.skeleton.setSkinByName('default');v.animation=new s.AnimationState(new s.AnimationStateData(data));v.track=v.animation.setAnimation(0,'_stand',true);v.animation.setAnimation(1,'方向_左',true);v.animation.apply(v.skeleton);v.skeleton.updateWorldTransform();v.selectDirection('左');
  const offset=new s.Vector2(),size=new s.Vector2();blueStandingBounds(v.skeleton,offset,size);v.renderer.camera.setViewport(size.y*3,size.y*3);v.renderer.camera.position.set(0,size.y*.6,0);v.ready=true;const gl=v.renderer.context.gl;gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);v.renderer.begin();v.renderer.drawSkeleton(v.skeleton,true);v.renderer.end();v.portrait=v.canvas.toDataURL();return v;
 }
 private selectDirection(root:string):void{maskBlueDirection(this.skeleton.slots,root);}
 draw(u:Unit,state:GameState,moving:boolean):void{
  if(!this.ready)return;const h=u.hunterCombat,a=h?.special,b=u.basicAction,pose=u.life!=='active'?'_die':state.time<(h?.hurtUntil??0)?'_damaged':a?.pose??b?.presentationId??(moving?'_move':'_stand');
  const key=pose+'/'+(a?.context?.actionId??b?.combatContext?.actionId??'')+'/'+(pose==='_damaged'?h?.hurtUntil:'');
  if(key!==this.lastPose){this.track=this.animation.setAnimation(0,pose,pose==='_stand'||pose==='_move'||a?.kind==='guard');this.lastPose=key;this.poseStart=state.time;}
  const angle=-(a?.facing??b?.angle??u.heading??0),up=Math.sin(angle)>.38,down=Math.sin(angle)<-.38;
  let direction=up?'方向_左上':down?'方向_左下':'方向_左';if(Math.abs(Math.cos(angle))<.35)direction=up?'方向_上':'方向_下';
  if(direction!==this.direction){this.animation.setAnimation(1,direction,true);this.direction=direction;}this.skeleton.scaleX=Math.cos(angle)>0?-1:1;
  this.track.trackTime=pose==='_die'?Math.min(.7,state.time-this.poseStart):pose==='_damaged'?state.time-this.poseStart:a?.elapsed??b?.elapsed??state.time-this.poseStart;
  this.skeleton.setToSetupPose();this.animation.apply(this.skeleton);this.selectDirection(direction.slice(3));this.skeleton.updateWorldTransform();
  const gl=this.renderer.context.gl;gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);this.renderer.begin();this.renderer.drawSkeleton(this.skeleton,true);this.renderer.end();
 }
 dispose():void{this.manager?.dispose();this.renderer?.dispose();this.ready=false;}
}
