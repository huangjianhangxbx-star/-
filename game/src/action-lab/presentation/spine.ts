import type {Actor} from '../runtime/world';
// The vendor runtime stays local and isolated. No global 3.8 renderer is imported.
declare global {interface Window {spine:any}}
export class NativeUnit {
 private renderer:any;private manager:any;private skeleton:any;private state:any;private track:any;
 private lastPose='';private lastDirection='';private poseStart=0;private bodyHeight=1000;
 constructor(readonly canvas:HTMLCanvasElement,readonly family:'blue'|'zombie'|'ranged'){}
 async load():Promise<void>{
  // Fetch failure must reject promptly instead of waiting for vendor retry completion.
  if(this.family==='ranged'){const response=await fetch('/__al01-assets/ranged/unit.json');if(!response.ok)throw new Error('骷髅弓骨架不可用');}
  const s=window.spine,context=new s.ManagedWebGLRenderingContext(this.canvas,{alpha:true,premultipliedAlpha:true});
  this.renderer=new s.SceneRenderer(this.canvas,context);this.manager=new s.AssetManager(context,`/__al01-assets/${this.family}/`);
  await Promise.all([new Promise<void>((ok,bad)=>this.manager.loadTextureAtlas('unit.atlas',()=>ok(),(_p:string,e:string)=>bad(new Error(e)))),new Promise<void>((ok,bad)=>this.manager.loadJson('unit.json',()=>ok(),(_p:string,e:string)=>bad(new Error(e))))]);
  const data=new s.SkeletonJson(new s.AtlasAttachmentLoader(this.manager.get('unit.atlas'))).readSkeletonData(this.manager.get('unit.json'));
  this.skeleton=new s.Skeleton(data);this.skeleton.setSkinByName('default');this.state=new s.AnimationState(new s.AnimationStateData(data));
  this.track=this.state.setAnimation(0,'_stand',true);this.state.setAnimation(1,this.family==='blue'?'方向_左':'方向_左下',true);this.state.apply(this.skeleton);this.skeleton.updateWorldTransform();
  this.selectDirection(this.family==='blue'?'左':'左下');
  const offset=new s.Vector2(),size=new s.Vector2();this.skeleton.getBounds(offset,size,[]);this.bodyHeight=size.y;
  // Fixed framing from standing bounds: action frames never resize the unit or authority collider.
  this.renderer.camera.setViewport(this.bodyHeight*3,this.bodyHeight*3);this.renderer.camera.position.set(0,this.bodyHeight*.6,0);
 }
 private selectDirection(root:string):void{
  // Native blue contains multiple complete directional rigs laid out beside one another.
  // Show only the selected rig; this does not change its vertices, bones or animation data.
  if(this.family!=='blue')return;
  for(const slot of this.skeleton.slots){let bone=slot.bone;while(bone.parent?.parent)bone=bone.parent;
   if(bone.parent&&bone.data.name!==root)slot.setAttachment(null);
  }
 }
 draw(a:Actor,sim:number,moving:boolean,generation:number):void{
  if(!this.skeleton)return;const s=window.spine;
  const pose=a.hp<=0?'_die':sim<a.hurtUntil?'_damaged':a.action?a.action.pose:moving?'_move':'_stand';
  const key=`${generation}/${pose}/${a.action?.id??''}/${pose==='_damaged'?a.hurtRealTime:''}`;
  if(key!==this.lastPose){this.track=this.state.setAnimation(0,pose,pose==='_stand'||pose==='_move'||a.action?.kind==='shield');this.lastPose=key;this.poseStart=sim;}
  const angle=a.action?.facing??a.facing,up=Math.sin(angle)>.38,down=Math.sin(angle)<-.38;
  let direction=up?'方向_左上':down?'方向_左下':'方向_左';
  if(this.family!=='blue')direction=this.family==='ranged'&&up?'方向_左上':'方向_左下';
  if(a.id==='blue'&&Math.abs(Math.cos(angle))<.35)direction=up?'方向_上':'方向_下';
  if(direction!==this.lastDirection){this.state.setAnimation(1,direction,true);this.lastDirection=direction;}
  this.skeleton.scaleX=Math.cos(angle)>0?-1:1;
  // Authority action time drives the pose, including pause, hitstop and cancellation.
  this.track.trackTime=a.action&&pose!=='_die'&&pose!=='_damaged'?a.action.track.time:sim-this.poseStart;
  this.skeleton.setToSetupPose();this.state.apply(this.skeleton);this.selectDirection(direction.slice(3));this.skeleton.updateWorldTransform();
  this.skeleton.color.set(1,sim<a.hurtUntil?.62:1,sim<a.hurtUntil?.62:1,1);
  const gl=this.renderer.context.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  this.renderer.begin();this.renderer.drawSkeleton(this.skeleton,true);this.renderer.end();
 }
 dispose():void{this.manager?.dispose();this.renderer?.dispose();}
}
export async function loadNativeRuntime():Promise<void>{await new Promise<void>((ok,bad)=>{const script=document.createElement('script');script.src='/__al01-assets/vendor/spine-webgl-4.1.56.js';script.onload=()=>ok();script.onerror=()=>bad(new Error('本机 Spine 4.1 运行资源不可用'));document.head.append(script);});}
