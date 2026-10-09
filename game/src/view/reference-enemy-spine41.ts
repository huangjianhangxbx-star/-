import {referenceRuntime} from './reference-spine41';
import type {GameState,Unit} from '../core/types';
type Family='zombie'|'ranged';
type FamilyRenderer={canvas:HTMLCanvasElement;renderer:any;manager:any;data:any;leases:number};
const families=new Map<Family,Promise<FamilyRenderer>>();
/** Shared GPU owner per family; skeletons and animation tracks remain per body. */
async function acquire(family:Family){
 let pending=families.get(family);
 if(!pending){pending=(async()=>{
  const response=await fetch(`/__al01-assets/${family}/unit.json`);if(!response.ok)throw Error(`Enemy assets unavailable: ${family}/unit.json`);
  const json=await response.json(),s=await referenceRuntime(),canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=new s.ManagedWebGLRenderingContext(canvas,{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
  const renderer=new s.SceneRenderer(canvas,context),manager=new s.AssetManager(context,`/__al01-assets/${family}/`);
  try{
   await new Promise<void>((ok,bad)=>manager.loadTextureAtlas('unit.atlas',()=>ok(),(_:any,e:any)=>bad(Error(String(e)))));
   const data=new s.SkeletonJson(new s.AtlasAttachmentLoader(manager.get('unit.atlas'))).readSkeletonData(json);
   for(const name of ['_stand','_move','attack','_damaged','_die','方向_左下'])if(!data.findAnimation(name))throw Error(`Missing native enemy pose ${family}/${name}`);
   return {canvas,renderer,manager,data,leases:0};
  }catch(e){manager.dispose();renderer.dispose();context.gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=canvas.height=0;throw e;}
 })();families.set(family,pending);pending.catch(()=>{if(families.get(family)===pending)families.delete(family);});}
 const pool=await pending;pool.leases++;return pool;
}
// Keep one GPU owner per supported family for this page. Skeleton/output leases still
// release immediately; recycling the atlas/context during world transitions can stall
// the browser's next image load. The cache is bounded by the two Family values.
function release(_family:Family,pool:FamilyRenderer){pool.leases--;}

/** Original 4.1 enemy assets, independent skeleton/track/output. Never drives combat events. */
export class ReferenceEnemyVisual {
 readonly canvas=document.createElement('canvas');ready=false;pose='';error='';
 private skeleton:any;private animation:any;private track:any;private viewport=1;private output:CanvasRenderingContext2D;
 private poseKey='';private poseStart=0;private direction='';private deadAt?:number;
 private mask=document.createElement('canvas');private revision=0;private maskRevision=-1;
 private constructor(private s:any,readonly family:Family,private pool:FamilyRenderer){this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=512;this.output=this.canvas.getContext('2d')!;}
 static async load(family:'zombie'|'ranged'){
  const pool=await acquire(family),s=await referenceRuntime(),v=new ReferenceEnemyVisual(s,family,pool);
  try{
   v.skeleton=new s.Skeleton(pool.data);v.skeleton.setSkinByName('default');v.animation=new s.AnimationState(new s.AnimationStateData(pool.data));v.track=v.animation.setAnimation(0,'_stand',true);v.animation.setAnimation(1,'方向_左下',true);v.animation.apply(v.skeleton);v.skeleton.updateWorldTransform();
   const offset=new s.Vector2(),size=new s.Vector2();v.skeleton.getBounds(offset,size,[]);v.viewport=size.y;v.ready=true;return v;
  }catch(e){v.dispose();throw e;}
 }
 draw(u:Unit,state:GameState,moving:boolean){
  if(!this.ready)return;const st=u.enemyV2!,a=st.action;if(u.life==='dead')this.deadAt??=state.time;else this.deadAt=undefined;
  const pose=u.life==='dead'?'_die':state.time<st.hurtUntil?'_damaged':a?'attack':moving?'_move':'_stand',key=`${state.combatIdentity?.generation}/${pose}/${a?.context.actionId??''}/${pose==='_damaged'?st.hurtAt:''}`;
  if(key!==this.poseKey){this.track=this.animation.setAnimation(0,pose,pose==='_stand'||pose==='_move');this.poseKey=key;this.poseStart=state.time;}this.pose=pose;
  const angle=-(a?.facing??u.heading??0),direction=this.family==='ranged'&&Math.sin(angle)>.38?'方向_左上':'方向_左下';
  if(direction!==this.direction){this.animation.clearTrack(1);this.animation.setAnimation(1,direction,true);this.direction=direction;}this.skeleton.scaleX=Math.cos(angle)>0?-1:1;
  this.track.trackTime=pose==='attack'?Math.max(0,state.time-a!.context.acceptedAt):pose==='_die'?Math.max(0,state.time-this.deadAt!):Math.max(0,state.time-(pose==='_damaged'?st.hurtAt??this.poseStart:this.poseStart));
  this.skeleton.setToSetupPose();this.animation.apply(this.skeleton);this.skeleton.updateWorldTransform();
  const renderer=this.pool.renderer,gl=renderer.context.gl;renderer.camera.setViewport(this.viewport*3,this.viewport*3);renderer.camera.position.set(0,this.viewport*.6,0);gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(this.skeleton,true);renderer.end();this.output.clearRect(0,0,512,512);this.output.drawImage(this.pool.canvas,0,0);this.revision++;
 }
 /** On-demand alpha copy: WebGL canvases cannot acquire a second 2D context. */
 opaqueAt(x:number,y:number){const c=this.mask.getContext('2d',{willReadFrequently:true})!;if(this.maskRevision!==this.revision){c.clearRect(0,0,512,512);c.drawImage(this.canvas,0,0);this.maskRevision=this.revision;}return c.getImageData(x,y,1,1).data[3]>24;}
 dispose(){if(!this.canvas.width)return;this.ready=false;release(this.family,this.pool);this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=0;}
}
