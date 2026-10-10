import { runtime } from './spine';
const cache=new Map<string,Promise<any>>();
export const FX_CLIPS:Record<string,{attack:string;skill:string;hit?:string}>={
 Arina:{attack:'attack_effect_01',skill:'skill_effect_01_01',hit:'attack_effect_01_uatk_01'},
 Cynthia:{attack:'attack_effect_01_ammo',skill:'skill_effect_01_uatk',hit:'attack_effect_01_uatk'},
 Galore:{attack:'attack_effect_01',skill:'skill_effect_01_01_01',hit:'attack_effect_01_uatk'},
 Livia:{attack:'attack_effect_01',skill:'skill_effect_01_01'},
 Dustin:{attack:'skill_effect_02',skill:'skill_effect_02'},
 Verlaine_bot:{attack:'minion_attack_01',skill:'minion_attack_01'},
};
async function dataFor(asset:string,s:any){
 const name=asset+'_effect';if(!cache.has(name))cache.set(name,(async()=>{
 const base=`/assets/effects/${name}/`;const [a,b]=await Promise.all([fetch(base+name+'.atlas'),fetch(base+name+'.skel')]);if(!a.ok||!b.ok)throw Error('Missing FX '+name);
 const text=await a.text(),lines=text.split(/\r?\n/),pages=lines.filter((l,i)=>l.trim()&&(i===0||!lines[i-1].trim())&&!l.includes(':'));const images=new Map();
 await Promise.all(pages.map(page=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(page.trim(),image);resolve()};image.onerror=reject;image.src=base+page.trim()})));
 const atlas=new s.TextureAtlas(text,(path:string)=>new s.canvas.CanvasTexture(images.get(path)));
 return new s.SkeletonBinary(new s.AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(await b.arrayBuffer()));
 })());return cache.get(name)!;
}
/** One non-looping source FX, with bounds sampled across its full clip to prevent cropping. */
export class SpineFX {
 readonly canvas=document.createElement('canvas');readonly duration:number;private elapsed=0;private skeleton:any;private state:any;private renderer:any;private scale:number;private cx:number;private cy:number;
 private constructor(s:any,data:any,readonly clip:string){
 this.canvas.width=this.canvas.height=384;this.skeleton=new s.Skeleton(data);this.state=new s.AnimationState(new s.AnimationStateData(data));this.renderer=new s.canvas.SkeletonRenderer(this.canvas.getContext('2d'));this.renderer.triangleRendering=true;this.duration=Math.max(.15,data.findAnimation(clip).duration);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const offset=new s.Vector2(),size=new s.Vector2();this.state.setAnimation(0,clip,false);
 for(let i=0;i<=12;i++){if(i)this.state.update(this.duration/12);this.state.apply(this.skeleton);this.skeleton.updateWorldTransform();this.skeleton.getBounds(offset,size,[]);if(Number.isFinite(size.x)&&size.x>0&&size.y>0){minX=Math.min(minX,offset.x);minY=Math.min(minY,offset.y);maxX=Math.max(maxX,offset.x+size.x);maxY=Math.max(maxY,offset.y+size.y)}}
 if(!Number.isFinite(minX)){minX=minY=-100;maxX=maxY=100}this.scale=340/Math.max(maxX-minX,maxY-minY,1);this.cx=(minX+maxX)/2;this.cy=(minY+maxY)/2;this.skeleton.setToSetupPose();this.state.setAnimation(0,clip,false);this.update(0,1);
 }
 static async load(asset:string,action:'attack'|'skill'|'hit'){const clips=FX_CLIPS[asset];if(!clips)return null;const clip=clips[action];if(!clip)return null;const s=await runtime();return new SpineFX(s,await dataFor(asset,s),clip)}
 static preload(asset:string){if(FX_CLIPS[asset])void runtime().then(s=>dataFor(asset,s)).catch(()=>{});}
 update(dt:number,facing:number){this.elapsed+=Math.max(0,dt);this.state.update(Math.max(0,dt));this.state.apply(this.skeleton);this.skeleton.updateWorldTransform();const c=this.canvas.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,384,384);c.translate(192,192);c.scale(this.scale*facing,-this.scale);c.translate(-this.cx,-this.cy);this.renderer.draw(this.skeleton);return this.elapsed<this.duration;}
 dispose(){this.state.clearTracks();this.canvas.width=this.canvas.height=0;}
}

