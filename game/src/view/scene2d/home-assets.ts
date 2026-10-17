import * as THREE from 'three';
export type HomeAsset={id:string;width:number;height:number;ppu:number;footAnchor:[number,number];url:string};
/** One atomic revision cache, owned by the scene view. Failed loads leave no partial cache. */
export class HomeAssets {
 private revision='';private entries=new Map<string,{meta:HomeAsset;material:THREE.ShaderMaterial}>();
 private disposed=false;
 constructor(private textures:Set<THREE.Texture>,private materials:Set<THREE.Material>,private make:(t:THREE.Texture,role:number)=>THREE.ShaderMaterial){}
 async prepare(revision:string,required:string[]=[]){if(this.disposed)throw Error('家园资源准备已取消');if(this.revision===revision)return;const fresh=new Map<string,{meta:HomeAsset;material:THREE.ShaderMaterial}>(),textures:THREE.Texture[]=[],materials:THREE.Material[]=[];
  try{const response=await fetch('/assets/home02/manifest.json?v='+encodeURIComponent(revision));if(!response.ok)throw Error('home02/manifest.json');const data=await response.json() as {assets:HomeAsset[]};
   if(!Array.isArray(data.assets)||new Set(data.assets.map(a=>a.id)).size!==data.assets.length)throw Error('家园素材清单重复或无效');
   for(const id of required)if(!data.assets.some(a=>a.id===id))throw Error('家园素材清单缺少：'+id);
   for(const a of data.assets)if(!Array.isArray(a.footAnchor)||a.footAnchor.length!==2||a.footAnchor.some((n,i)=>!Number.isFinite(n)||n<0||n>(i?a.height:a.width)))throw Error('家园素材锚点无效：'+a.id);
   for(const meta of data.assets){if(this.disposed)throw Error('家园资源准备已取消');if(!meta.id||!meta.url.startsWith('/assets/home02/')||!(meta.width>0&&meta.height>0&&meta.ppu>0))throw Error('家园素材元数据无效：'+meta.id);let t:THREE.Texture;try{t=await new THREE.TextureLoader().loadAsync(meta.url+'?v='+encodeURIComponent(revision));}catch{throw Error('家园素材缺失：'+meta.url);}textures.push(t);if(this.disposed)throw Error('家园资源准备已取消');t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;const material=this.make(t,meta.id.startsWith('floor-')||meta.id==='courtyard'?0:3);materials.push(material);fresh.set(meta.id,{meta,material});}
   // Replacement is only requested after old geometry has been released by its owner.
   for(const e of this.entries.values()){const t=e.material.uniforms.map.value as THREE.Texture;t.dispose();this.textures.delete(t);e.material.dispose();this.materials.delete(e.material);}
   for(const t of textures)this.textures.add(t);this.entries=fresh;this.revision=revision;
  }catch(e){for(const t of textures)t.dispose();for(const m of materials){m.dispose();this.materials.delete(m);}throw e;}
 }
 get(id:string){const e=this.entries.get(id);if(!e)throw Error('家园素材未准备：'+id);return e;}
 get count(){return this.entries.size;}
 dispose(){this.disposed=true;for(const e of this.entries.values()){const t=e.material.uniforms.map.value as THREE.Texture;t.dispose();this.textures.delete(t);e.material.dispose();this.materials.delete(e.material);}this.entries.clear();}
}
