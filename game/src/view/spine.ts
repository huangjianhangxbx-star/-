// Spine 3.8 runtime is intentionally isolated from Three.js version and simulation.
// Binary animation names are validated in work/spine/parsed.json.
type SpineRuntime = any;
export type SpineAction = 'idle' | 'move' | 'attack' | 'skill' | 'dead';
let runtimePromise: Promise<SpineRuntime> | undefined;
export function runtime(): Promise<SpineRuntime> {
  return runtimePromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/vendor/spine-canvas.js';
    script.onload = () => resolve((window as any).spine);
    script.onerror = () => reject(new Error('Spine 3.8 runtime loading failed'));
    document.head.append(script);
  });
}
export const CHARACTER_ASSETS:Record<string,{file:string;actions:Record<SpineAction,string>}> = Object.fromEntries(['Arina','Cynthia','Dustin','Fenia','Galore','Livia','Verlaine_bot','Rina_F_Summer','Charlotte'].map(name=>[name,{file:name,actions:{idle:name==='Verlaine_bot'?'minion_stand':'stand',move:name==='Verlaine_bot'?'minion_run':'run',attack:name==='Verlaine_bot'?'minion_attack_01':'attack_01',skill:name==='Rina_F_Summer'?'skill_03':name==='Charlotte'?'skill_01':['Galore','Dustin'].includes(name)?'skill_01_01':'skill_01',dead:name==='Verlaine_bot'?'minion_dead':'dead'}}]));
const dataCache = new Map<string, Promise<any>>();
const readyData = new Map<string, {runtime:SpineRuntime;data:any}>();
async function dataFor(name: string, s: SpineRuntime) {
  if (!CHARACTER_ASSETS[name]) throw new Error(`Unknown Spine character: ${name}`);
  if (!dataCache.has(name)) dataCache.set(name, (async () => {
    const base = `/assets/characters/${name}/`;
    const [atlasResponse, binaryResponse] = await Promise.all([fetch(`${base}${name}.atlas`), fetch(`${base}${name}.skel`)]);
    if (!atlasResponse.ok || !binaryResponse.ok) throw new Error(`Missing Spine asset ${name}`);
    const atlasText = await atlasResponse.text();
    // Main character atlases currently have one page. Resolve every declared page anyway.
    const pages = atlasText.split(/\r?\n/).filter((line, i, lines) => line.trim() && (i === 0 || !lines[i - 1].trim()) && !line.includes(':'));
    const images = new Map<string, HTMLImageElement>();
    await Promise.all(pages.map(page => new Promise<void>((resolve, reject) => {
      const image = new Image(); image.onload = () => { images.set(page.trim(), image); resolve(); }; image.onerror = reject; image.src = base + page.trim();
    })));
    const atlas = new s.TextureAtlas(atlasText, (path: string) => new s.canvas.CanvasTexture(images.get(path)));
    return new s.SkeletonBinary(new s.AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(await binaryResponse.arrayBuffer()));
  })());
  return dataCache.get(name)!;
}
export class SpineVisual {
  readonly canvas = document.createElement('canvas');
  readonly names: string[];
  private skeleton: any;
  private state: any;
  private renderer: any;
  private context: CanvasRenderingContext2D;
  private scale = 1;
  private centerX = 0;
  private floorY = 0;
  private action = '';
  private skillVariant?:string;
  private constructor(private s: SpineRuntime, private data: any, private name: string) {
    this.canvas.width = this.canvas.height = 512;
    this.context = this.canvas.getContext('2d')!;
    this.names = data.animations.map((a: any) => a.name);
    this.skeleton = new s.Skeleton(data);
    this.state = new s.AnimationState(new s.AnimationStateData(data));
    this.state.data.defaultMix = .12;
    this.renderer = new s.canvas.SkeletonRenderer(this.context);
    this.renderer.triangleRendering = true;
    for(const action of Object.values(CHARACTER_ASSETS[name].actions))if(!this.names.includes(action))throw new Error(name+' missing animation '+action);
    this.state.setAnimation(0, CHARACTER_ASSETS[name].actions.idle, true);
    this.state.apply(this.skeleton); this.skeleton.updateWorldTransform();
    const offset = new s.Vector2(), size = new s.Vector2();
    this.skeleton.getBounds(offset, size, []);
    this.scale = Math.min(350 / Math.max(size.x, 1), 380 / Math.max(size.y, 1));
    this.centerX = offset.x + size.x / 2;
    this.floorY = offset.y;
    this.update(0, 'idle', 1);
  }
  static async load(name: string): Promise<SpineVisual> {
    const s = await runtime();
    try{const data=await dataFor(name,s);readyData.set(name,{runtime:s,data});return new SpineVisual(s,data,name);}
    catch(e){dataCache.delete(name);throw e;}
  }
  static prepared(name:string):SpineVisual|undefined{const ready=readyData.get(name);return ready?new SpineVisual(ready.runtime,ready.data,name):undefined;}
  static async preload(names:string[]){await Promise.all([...new Set(names)].map(async name=>{const visual=await SpineVisual.load(name);visual.dispose();}));}
  private animationName(action: SpineAction): string {
    return action==='skill'&&this.name==='Charlotte'&&['prayer','ward','bell'].includes(this.skillVariant||'')?'skill_02':CHARACTER_ASSETS[this.name].actions[action];
  }
  duration(action: SpineAction): number { return this.data.findAnimation(this.animationName(action)).duration; }
  update(dt: number, action: SpineAction = 'idle', facing = 1, restart = false, skillId?:string): void {
    this.skillVariant=skillId;
    const animation = this.animationName(action);
    if (animation !== this.action || restart) {
      this.state.setAnimation(0, animation, action !== 'dead' && action !== 'attack'); this.action = animation;
    }
    this.state.update(Math.max(0, dt)); this.state.apply(this.skeleton); this.skeleton.updateWorldTransform();
    const c = this.context; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 512, 512);
    c.translate(256, 450); c.scale(this.scale * (facing < 0 ? -1 : 1), -this.scale); c.translate(-this.centerX, -this.floorY);
    this.renderer.draw(this.skeleton);
  }
  dispose(): void { this.state.clearTracks(); this.canvas.width = this.canvas.height = 0; }
}


