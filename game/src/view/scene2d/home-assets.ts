import * as THREE from 'three';
import {validateWallMapping} from '../../core/scene2d-map';
export type HomeAsset = {id:string;width:number;height:number;ppu:number;footAnchor:[number,number];url:string};
export type HomeWall = {index:number;url:string;width:number;height:number;ppu:number;pivot:{x:number;y:number};key:string};
type ImageEntry = {meta:HomeAsset;material:THREE.ShaderMaterial};
type WallEntry = {meta:HomeWall;material:THREE.ShaderMaterial};

/** A candidate owns all of its textures. Nothing is shared with an older map revision. */
export class HomeAssets {
  private revision = '';
  private entries = new Map<string,ImageEntry>();
  private walls = new Map<number,WallEntry>();
  private ownedTextures:THREE.Texture[] = [];
  private ownedMaterials:THREE.Material[] = [];
  private disposed = false;
  wallMapping?:Record<string,number>;
  constructor(private textures:Set<THREE.Texture>, private materials:Set<THREE.Material>,
    private make:(t:THREE.Texture,role:number)=>THREE.ShaderMaterial) {}

  async prepare(revision:string, required:string[] = [],
    manifests = ['/assets/home02/manifest.json'], wallManifest?:string) {
    if (this.disposed) throw Error('家园资源准备已取消');
    if (this.revision === revision) return;
    const fresh = new Map<string,ImageEntry>(), walls = new Map<number,WallEntry>();
    const textures:THREE.Texture[] = [], materials:THREE.Material[] = [];
    const json = async (url:string) => {
      let response:Response;
      try {response = await fetch(url.startsWith('/__scene2d-assets/') ? url : url+'?v='+encodeURIComponent(revision));}
      catch {throw Error('家园素材清单加载失败：'+url);}
      if (!response.ok) throw Error('家园素材清单加载失败：'+url);
      return response.json();
    };
    const texture = async (url:string, role:number) => {
      if (this.disposed) throw Error('家园资源准备已取消');
      let t:THREE.Texture;
      try { t = await new THREE.TextureLoader().loadAsync(url.startsWith('/__scene2d-assets/') ? url : url+'?v='+encodeURIComponent(revision)); }
      catch { throw Error('家园素材缺失：'+url); }
      textures.push(t);
      if (this.disposed) throw Error('家园资源准备已取消');
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      const material = this.make(t,role);
      materials.push(material);
      return material;
    };
    try {
      const data = await Promise.all(manifests.map(json));
      if (data.some(d=>!Array.isArray(d.assets))) throw Error('家园素材清单无效');
      const assets:HomeAsset[] = data.flatMap(d=>d.assets);
      if (new Set(assets.map(a=>a.id)).size !== assets.length) throw Error('家园素材清单重复');
      for (const id of required) if (!assets.some(a=>a.id===id)) throw Error('家园素材清单缺少：'+id);
      for (const a of assets) {
        if (!a.id || !/^\/assets\/home02(?:-fix01)?\/[a-z-]+\.png$/.test(a.url) ||
          ![a.width,a.height,a.ppu].every(n=>Number.isFinite(n)&&n>0) ||
          !Array.isArray(a.footAnchor) || a.footAnchor.length!==2 ||
          a.footAnchor.some((n,i)=>!Number.isFinite(n)||n<0||n>(i?a.height:a.width))) throw Error('家园素材元数据无效：'+a.id);
      }
      const wall = wallManifest ? await json(wallManifest) as {mapping:Record<string,number>;walls:HomeWall[]} : undefined;
      if (wall) {
        validateWallMapping(wall.mapping);
        if (!Array.isArray(wall.walls) || wall.walls.length!==47 ||
          new Set(wall.walls.map(w=>w.index)).size!==47 || wall.walls.some(w=>
            !Number.isInteger(w.index)||w.index<1||w.index>47||
            w.url!=='/__scene2d-assets/home-wall/'+w.index+'.png'||
            ![w.width,w.height,w.ppu].every(n=>Number.isFinite(n)&&n>0)||
            !w.pivot||![w.pivot.x,w.pivot.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))) throw Error('家园原墙清单无效');
      }
      for (const meta of assets) fresh.set(meta.id,{meta,material:await texture(meta.url,
        meta.id.startsWith('floor-')||meta.id==='courtyard' ? 0 : 3)});
      for (const meta of wall?.walls??[]) walls.set(meta.index,{meta,material:await texture(meta.url,1)});
      this.releaseOwned();
      for (const t of textures) this.textures.add(t);
      this.ownedTextures=textures;this.ownedMaterials=materials;
      this.entries=fresh;this.walls=walls;this.wallMapping=wall?.mapping;this.revision=revision;
    } catch (error) {
      for (const t of textures) t.dispose();
      for (const m of materials) {m.dispose();this.materials.delete(m);}
      throw error;
    }
  }
  get(id:string) {const e=this.entries.get(id);if(!e)throw Error('家园素材未准备：'+id);return e;}
  wall(index:number) {const e=this.walls.get(index);if(!e)throw Error('家园原墙未准备：'+index);return e;}
  get count() {return this.ownedTextures.length;}
  private releaseOwned() {
    for(const t of this.ownedTextures){t.dispose();this.textures.delete(t);}
    for(const m of this.ownedMaterials){m.dispose();this.materials.delete(m);}
    this.ownedTextures=[];this.ownedMaterials=[];
  }
  dispose() {this.disposed=true;this.releaseOwned();this.entries.clear();this.walls.clear();}
}
