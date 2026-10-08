import {referenceRuntime} from './reference-spine41';
import type {GameState,Unit} from '../core/types';
/** Original 4.1 enemy assets, independent skeleton/track/context. Never drives combat events. */
export class ReferenceEnemyVisual {
 readonly canvas=document.createElement('canvas');ready=false;pose='';error='';
 private renderer:any;private manager:any;private skeleton:any;private animation:any;private track:any;
 private poseKey='';private poseStart=0;private direction='';private deadAt?:number;
 private mask=document.createElement('canvas');private revision=0;private maskRevision=-1;
 private constructor(private s:any,readonly family:'zombie'|'ranged'){this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=512;}
 static async load(family:'zombie'|'ranged'){
  const response=await fetch(`/__al01-assets/${family}/unit.json`);if(!response.ok)throw Error(`Enemy assets unavailable: ${family}/unit.json`);
  const s=await referenceRuntime(),v=new ReferenceEnemyVisual(s,family);
  try{
   const context=new s.ManagedWebGLRenderingContext(v.canvas,{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});v.renderer=new s.SceneRenderer(v.canvas,context);v.manager=new s.AssetManager(context,`/__al01-assets/${family}/`);
   const loaded=await Promise.allSettled([new Promise<void>((ok,bad)=>v.manager.loadTextureAtlas('unit.atlas',()=>ok(),(_:any,e:any)=>bad(Error(String(e))))),new Promise<void>((ok,bad)=>v.manager.loadJson('unit.json',()=>ok(),(_:any,e:any)=>bad(Error(String(e)))))]);
   for(const result of loaded)if(result.status==='rejected')throw result.reason;
   const data=new s.SkeletonJson(new s.AtlasAttachmentLoader(v.manager.get('unit.atlas'))).readSkeletonData(v.manager.get('unit.json'));
   for(const name of ['_stand','_move','attack','_damaged','_die','方向_左下'])if(!data.findAnimation(name))throw Error(`Missing native enemy pose ${family}/${name}`);
   v.skeleton=new s.Skeleton(data);v.skeleton.setSkinByName('default');v.animation=new s.AnimationState(new s.AnimationStateData(data));v.track=v.animation.setAnimation(0,'_stand',true);v.animation.setAnimation(1,'方向_左下',true);v.animation.apply(v.skeleton);v.skeleton.updateWorldTransform();
   const offset=new s.Vector2(),size=new s.Vector2();v.skeleton.getBounds(offset,size,[]);v.renderer.camera.setViewport(size.y*3,size.y*3);v.renderer.camera.position.set(0,size.y*.6,0);v.ready=true;return v;
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
  const gl=this.renderer.context.gl;gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);this.renderer.begin();this.renderer.drawSkeleton(this.skeleton,true);this.renderer.end();this.revision++;
 }
 /** On-demand alpha copy: WebGL canvases cannot acquire a second 2D context. */
 opaqueAt(x:number,y:number){const c=this.mask.getContext('2d',{willReadFrequently:true})!;if(this.maskRevision!==this.revision){c.clearRect(0,0,512,512);c.drawImage(this.canvas,0,0);this.maskRevision=this.revision;}return c.getImageData(x,y,1,1).data[3]>24;}
 dispose(){this.ready=false;this.manager?.dispose();this.renderer?.dispose();this.renderer?.context.gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=0;}
}
