import {basicPresentation} from './basic-presentation';
import {activeEncounters} from '../core/encounter-domain';
import {REACTIONS} from '../core/enemy-combat';
import {DamageFloatLayer} from './damage-floats';
import {TelegraphLayer} from './telegraph';
import {DirectionalLayer} from './directionality';
import {movementAnimationRate} from './movement-animation';
import {loadDarkDungeon,campfireMesh,releaseDarkDungeon} from './dark-dungeon';
import {activityRadius} from '../core/autonomy';
import {comfortRadius} from '../core/autonomy-query';
import {fitTowerProjection,explorationProjection} from './camera-projection';
import {controlFocus} from './control-focus';
import {isStandaloneExploration} from '../core/exploration-party';
import {ExplorationFog} from './exploration-fog';
import {positionKnown,positionVisible} from '../core/visibility';
import {skillAreas} from './skill-areas';
import {rangeOverlay} from './range-overlay';
import {cell,SPACE,distance} from '../core/spatial';
import * as THREE from 'three';
import type {GameState, Pos, UIOverlay, Unit} from '../core/types';
import {visible} from '../core/engine';
import {SpineVisual} from './spine';
import {ReferenceBlueVisual} from './reference-spine41';
import {SpineFX} from './spine-fx';
import {streetDetails,batchArchitecture} from './street-details';
import {wavePreviews as queryWavePreviews} from '../core/waves';
import {getWorkbenchSample} from '../core/workbench-map';
import {workbenchMesh,addWorkbenchDecorations} from './workbench-terrain';

const P = {ink:0x171c20, stone:0x747e80, bone:0xd8d4c7, copper:0xa98c60, red:0xb65559, cyan:0x74b9c7};
const LAYER_HEIGHT = SPACE.layerHeight;
type Actor = {basicRef?:Unit['basicAction'];basicClip?:string;basicAcceptedAt?:number;released?:boolean;group:THREE.Group;sprite:THREE.Sprite;bar:THREE.Sprite;barCanvas:HTMLCanvasElement;barTexture:THREE.CanvasTexture;buff:THREE.Sprite;buffCanvas:HTMLCanvasElement;buffTexture:THREE.CanvasTexture;lastBuff:string;buffMaximum:Map<string,number>;arrow:THREE.Mesh;lastBar:string;unit:Unit;spine?:SpineVisual;reference?:ReferenceBlueVisual;referenceRequested?:boolean;spineTexture?:THREE.CanvasTexture;animationDt:number;loadFailed?:boolean;attackRemaining:number;attackRestart:boolean;pendingRef?:Unit['attackPending']|Unit['attackIntent'];previousPos:Pos;moving:boolean;hadPath:boolean;deathElapsed:number;downPose?:HTMLCanvasElement};
type WavePreview = {id:string;points:THREE.Vector3[];lengths:number[];total:number;heads:THREE.Mesh[]};

/** Rendering consumes simulation state; geometry never decides battle rules. */
export class BattleScene {
  readonly telegraphs=new TelegraphLayer();readonly damageFloats=new DamageFloatLayer();
  readonly directions=new DirectionalLayer();
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-10,10,6,-6,.1,100);
  readonly unitVisuals = new Map<string,Actor>();
  private renderer:THREE.WebGLRenderer;
  private terrain = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private effectsGroup = new THREE.Group();
  private skillAreaGroup=new THREE.Group();private skillAreaKey='';
  private nativeEffects:{visual:SpineFX;sprite:THREE.Sprite;texture:THREE.CanvasTexture;facing:number;pos:Pos}[]=[];
  private seenEffects=new Set<number>();
  private fxCastTimes=new Map<string,number>();
  private fxPending=0;
  private fxState:GameState|null=null;
  private waveGroup = new THREE.Group();
  private waveKey = '';
  private wavePreviews:WavePreview[] = [];
  private structures = new THREE.Group();
  private tileMeshes:THREE.Object3D[] = [];
  private tileHeights = new Map<string,number>();
  private ray = new THREE.Raycaster();
  private observer:ResizeObserver;
  private dungeonLantern=new THREE.PointLight(0xffd6a1,20,10,2);
  private ambient = new THREE.HemisphereLight(0xabc6eb,0x3a4653,1.2);
  private crystal:THREE.Group | null = null;
  private crystalGem:THREE.Mesh | null = null;
  private state:GameState | null = null;
  private terrainKey = '';
  private overlayKey = '';
  private structuresKey = '';

  private stoneTexture:THREE.CanvasTexture;
  private elapsed = 0;private fog=new ExplorationFog();private cameraFocus=new THREE.Vector3();private cameraVisit='';private eventMarks:THREE.Group[]=[];private fxVisit='';
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private width = 14;
  private height = 8;
  private disposed = false;

  get assetStatus() {
    const actors=[...this.unitVisuals.values()].filter(a=>a.group.visible);
    const ready=actors.filter(a=>a.spine).length,failed=actors.filter(a=>a.loadFailed).length;
    return failed?`Spine ${ready}/${actors.length} · ${failed} 个加载失败`:ready===actors.length&&ready>0?'Spine 3.8 · 真实动画':`Spine 载入 ${ready}/${actors.length}`;
  }

  constructor(private host:HTMLElement) {
    this.stoneTexture=this.makeStoneTexture();
    this.renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.setClearColor(0x121c29);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label','斜视角战场：石板地面、双层高台与角色');
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    host.append(this.renderer.domElement);
    this.scene.add(this.damageFloats.group,this.directions.group,this.telegraphs.group,this.terrain,this.overlayGroup,this.effectsGroup,this.skillAreaGroup,this.structures,this.waveGroup,this.ambient,this.dungeonLantern);
    const key = new THREE.DirectionalLight(0xe6e8ee,2.8);
    key.position.set(-10,16,-8);
    key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-17;key.shadow.camera.right=17;key.shadow.camera.top=13;key.shadow.camera.bottom=-13;key.shadow.camera.near=.5;key.shadow.camera.far=55;key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=3;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8bbcff,.9);
    rim.position.set(7,5,-8);
    this.scene.add(rim);
    this.camera.position.set(0,28,22);
    this.camera.lookAt(0,0,0);
    this.observer = new ResizeObserver(()=>this.resize());
    this.observer.observe(host);
    this.resize();
  }

  private resize() {
    const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);
    this.resizeRenderer(w,h);
    if(this.state?.exploration)this.projectExplorationCamera(w,h);else this.fitTowerCamera(w,h);
    this.camera.updateProjectionMatrix();
  }
  private resizeRenderer(w:number,h:number){
    this.renderer.setSize(w,h,false);
  }
  private fitTowerCamera(w:number,h:number){Object.assign(this.camera,fitTowerProjection(w,h,this.width,this.height));}
  private projectExplorationCamera(w:number,h:number){Object.assign(this.camera,explorationProjection(w,h));}

  private key(p:Pos) {return `${p.x},${p.y}`;}
  private level(p:Pos) {return this.tileHeights.get(this.key({x:Math.round(p.x),y:Math.round(p.y)}))??0;}
  private world(p:Pos,extra=0) {return new THREE.Vector3(p.x-(this.width-1)/2,this.level(p)+extra,p.y-(this.height-1)/2);}
  project(pos:Pos):{x:number;y:number} {
    const p=this.world(pos,.02).project(this.camera),r=this.host.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  }
  pick(clientX:number,clientY:number):{tile:Pos|null;unitId:string|null} {
    const r=this.host.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);
    const groundHit=this.ray.intersectObjects(this.tileMeshes,false)[0];
    const tile:Pos|null=groundHit?{x:groundHit.point.x+(this.width-1)/2,y:groundHit.point.z+(this.height-1)/2}:null;
    if(tile&&this.state&&!positionKnown(this.state,tile))return {tile:null,unitId:null};
    const actors=[...this.unitVisuals.values()].filter(a=>a.group.visible).map(a=>a.sprite);
    const actorHit=this.ray.intersectObjects(actors,false).sort((a,b)=>b.object.renderOrder-a.object.renderOrder).find(hit=>{
      const sprite=hit.object as THREE.Sprite,canvas=sprite.material.map?.image as HTMLCanvasElement|undefined;
      const unit=this.unitVisuals.get(sprite.userData.unitId)?.unit;
      if(!unit||!tile||cell(tile).x!==cell(unit.pos).x||cell(tile).y!==cell(unit.pos).y)return false;
      if(!canvas||!hit.uv)return true;
      const x=Math.min(canvas.width-1,Math.max(0,Math.floor(hit.uv.x*canvas.width)));
      const y=Math.min(canvas.height-1,Math.max(0,Math.floor((1-hit.uv.y)*canvas.height)));
      return (canvas.getContext('2d')?.getImageData(x,y,1,1).data[3]??0)>24;
    });
    return {tile,unitId:actorHit?actorHit.object.userData.unitId as string:null};
  }

  update(state:GameState,overlay:UIOverlay,dt:number,visualDt=dt) {
    if(this.disposed)return;
    this.state=state;this.elapsed+=Math.min(dt,.1);
    const dungeon=state.exploration?.definition.victoryCondition==='exit';this.ambient.intensity=dungeon?.45:state.mode==='dark'||state.node===3?.5:1.2;this.renderer.setClearColor(dungeon?0x080c10:0x121c29);this.dungeonLantern.visible=!!dungeon;const hunter=state.units.find(u=>u.id==='hunter');if(hunter)this.dungeonLantern.position.copy(this.world(hunter.drawPos||hunter.pos,2.6));for(const light of this.scene.children)if(light instanceof THREE.DirectionalLight)light.visible=!dungeon;
    const signature=`${state.mode==='workbench'&&state.node===1?'workbench:'+getWorkbenchSample().source.revision+':':''}${state.width}x${state.height}:`+state.tiles.map(t=>`${t.layer}${+t.obstacle}`).join('')+JSON.stringify([state.goal,state.gate,state.spawns]);
    if(signature!==this.terrainKey){this.terrainKey=signature;this.buildTerrain(state);}
    this.fog.update(state);this.followCamera(state,visualDt,overlay.selectedId);
    for(const mark of this.eventMarks){const point=mark.userData.point;mark.visible=positionKnown(state,point.pos);for(const child of mark.children)if(child instanceof THREE.Sprite)child.visible=positionVisible(state,point.pos);if(point.kind==='resource'&&state.exploration?.memory.mechanisms.includes(point.id))mark.visible=false;}
    this.terrain.traverse(o=>{if(o instanceof THREE.PointLight){const p=o.getWorldPosition(new THREE.Vector3());o.visible=positionVisible(state,{x:p.x+(this.width-1)/2,y:p.z+(this.height-1)/2});}});
    this.updateActors(state,dt,overlay.selectedId);
    this.updateOverlay(overlay);
    this.updateStructures(state);
    this.updateWaves(state);
    this.damageFloats.update(state,(p,extra)=>this.world(p,extra),this.reducedMotion);this.fog.apply(this.damageFloats.group);this.updateEffects(state,dt);this.telegraphs.update(state,(p,extra)=>this.world(p,extra));this.directions.update(state,!!overlay.debugAutonomy,(p,extra)=>this.world(p,extra));this.fog.apply(this.directions.group);
    if(this.crystalGem){this.crystalGem.rotation.y=this.elapsed*.17;this.crystalGem.position.y=1.05+(this.reducedMotion?0:Math.sin(this.elapsed*1.6)*.055);}
    this.fog.apply(this.terrain);this.fog.apply(this.structures);this.fog.apply(this.overlayGroup);this.fog.apply(this.skillAreaGroup);this.fog.apply(this.effectsGroup);this.fog.apply(this.telegraphs.group);
    this.renderer.render(this.scene,this.camera);
  }

  private followCamera(state:GameState,dt:number,selectedId:string|null){
    const exploring=!!state.exploration&&state.phase==='battle',visit=exploring?state.attempt+':exploration':'tower',h=state.units.find(u=>u.id==='hunter');
    const target=exploring&&h?this.world(h.drawPos||h.pos):new THREE.Vector3();target.y=0;
    if(exploring&&isStandaloneExploration(state)){const focus=controlFocus(state);if(focus)target.copy(this.world(focus));else target.copy(this.cameraFocus);target.y=0;}
    else {const selected=state.units.find(u=>u.id===selectedId&&u.team==='ally'&&['active','downed'].includes(u.life));if(exploring&&selected&&h&&selected!==h){const offset=this.world(selected.drawPos||selected.pos).sub(target);offset.y=0;if(offset.length()>3)offset.setLength(3);target.add(offset);}}
    if(this.cameraVisit!==visit||this.reducedMotion){this.cameraVisit=visit;this.cameraFocus.copy(target);}else this.cameraFocus.lerp(target,1-Math.exp(-Math.max(0,dt)*8));
    this.camera.position.copy(this.cameraFocus).add(new THREE.Vector3(0,28,22));this.camera.lookAt(this.cameraFocus);this.camera.updateMatrixWorld();
  }
  private material(color:THREE.ColorRepresentation,extra:THREE.MeshStandardMaterialParameters={}) {
    return new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.02,...extra});
  }
  private makeStoneTexture() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(256,256);let seed=7219;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<pixels.data.length;i+=4){const shade=206+Math.floor(random()*22);pixels.data[i]=shade;pixels.data[i+1]=shade;pixels.data[i+2]=shade;pixels.data[i+3]=255;}
    ctx.putImageData(pixels,0,0);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const x=col*128,y=row*128;ctx.fillStyle='rgba(28,37,45,.55)';ctx.fillRect(x,y,128,128);
      const shade=180+Math.floor(random()*25);ctx.fillStyle='rgb('+shade+','+(shade+3)+','+(shade+5)+')';ctx.fillRect(x+3,y+3,122,122);
      ctx.strokeStyle='rgba(242,245,238,.30)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+4,y+124);ctx.lineTo(x+4,y+4);ctx.lineTo(x+124,y+4);ctx.stroke();
      for(let i=0;i<180;i++){ctx.fillStyle='rgba(36,43,49,'+(random()*.12)+')';ctx.fillRect(x+5+random()*116,y+5+random()*116,random()*3+1,1);}
    }
ctx.strokeStyle='rgba(52,63,70,.25)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(19,57);ctx.lineTo(40,68);ctx.lineTo(48,94);ctx.moveTo(40,68);ctx.lineTo(61,65);ctx.moveTo(201,235);ctx.lineTo(191,208);ctx.lineTo(209,187);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,244,.15)';ctx.lineWidth=3;ctx.strokeRect(5,5,246,246);
    for(let i=0;i<45;i++){ctx.fillStyle=`rgba(50,64,65,${.025+random()*.07})`;ctx.fillRect(random()*256,random()*256,random()*19+2,random()*3+1);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  private box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material|THREE.Material[]) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private clear(group:THREE.Group) {
    releaseDarkDungeon(group);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Sprite){if('geometry'in o)geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
    group.traverse(o=>{if(o instanceof THREE.Mesh)o.customDepthMaterial?.dispose();if(o instanceof THREE.Sprite&&o.material.map&&o.material.map!==this.stoneTexture&&!o.userData.borrowedMap)o.material.map.dispose();});
    group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }

  private buildTerrain(state:GameState) {
    this.renderer.shadowMap.needsUpdate=true;this.clear(this.terrain);this.terrain.userData={};this.tileMeshes=[];this.tileHeights.clear();
    this.crystal=null;this.crystalGem=null;this.eventMarks=[];
    this.width=state.width;this.height=state.height;this.resize();
    if(state.exploration?.definition.victoryCondition==='exit'){
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(state.width,state.height),new THREE.MeshBasicMaterial({visible:false}));ground.rotation.x=-Math.PI/2;this.terrain.add(ground);this.tileMeshes=[ground];
      for(const point of [{id:'exit',pos:state.goal,kind:'exit'},...state.exploration.definition.points]){const mark=this.groundMark(point.pos,point.kind==='exit'?P.cyan:P.copper,point.kind==='exit'?'出口 · 胜利':'篝火 · 恢复','gate');mark.userData.point=point;if(point.kind==='campfire')mark.add(campfireMesh());this.eventMarks.push(mark);}
      const signature=this.terrainKey;void loadDarkDungeon(this.terrain,()=>!this.disposed&&this.terrainKey===signature).catch(error=>{console.error(error);window.dispatchEvent(new CustomEvent('character-load-error',{detail:'暗牢地图：'+String(error)}));});this.overlayKey='';this.structuresKey='';this.waveKey='';return;
    }
    if(state.mode==='workbench'&&state.node===1){
      const sample=getWorkbenchSample();
      sample.tiles.forEach((tile,i)=>this.tileHeights.set(this.key(tile),sample.heights[i]));
      const mesh=workbenchMesh();this.terrain.add(mesh);this.tileMeshes=[mesh];
      state.spawns.forEach((p,i)=>this.groundMark(p,P.red,`侵入 ${i+1}`,'spawn'));
      this.createCrystal(state.goal);
      const signature=this.terrainKey;
      void addWorkbenchDecorations(this.terrain,()=>!this.disposed&&this.terrainKey===signature)
        .then(()=>{this.renderer.shadowMap.needsUpdate=true;})
        .catch(error=>console.error('地图工坊真实资产加载失败',error));
      this.overlayKey='';this.structuresKey='';this.waveKey='';
      return;
    }
    const side=this.material(0x35434c),edge=this.material(0x19272e),copper=this.material(P.copper,{metalness:.65,roughness:.5});
    this.box(this.terrain,0,-.4,0,this.width+.32,.72,this.height+.32,edge);
    this.box(this.terrain,0,-.05,0,this.width+.36,.08,this.height+.36,side);
    for(const z of [-(this.height+.25)/2,(this.height+.25)/2])this.box(this.terrain,0,-.045,z,this.width+.36,.035,.035,copper);
    for(const x of [-(this.width+.25)/2,(this.width+.25)/2])this.box(this.terrain,x,-.045,0,.035,.035,this.height+.36,copper);
    this.box(this.terrain,0,-.9,0,this.width+1.8,.18,this.height+1.8,this.material(0x25353f));
    for(const t of state.tiles){
      const h=t.layer*LAYER_HEIGHT;this.tileHeights.set(this.key(t),h);
      const n=((t.x*17+t.y*31)%9)/9;

      const top=this.material(new THREE.Color(t.obstacle?0x29343b:t.layer?0x8a9398:0x788791).multiplyScalar(.91+n*.15),{map:this.stoneTexture,bumpMap:this.stoneTexture,bumpScale:.025});
      const mat=top;
      const tile=this.box(this.terrain,t.x-(this.width-1)/2,h/2-.02,t.y-(this.height-1)/2,.966,h+.08,.966,mat);
      tile.userData.tile={x:t.x,y:t.y};this.tileMeshes.push(tile);
      // An inset top seam gives each cell a readable lip without a bright grid.
      if(t.layer){const trim=this.box(this.terrain,t.x-(this.width-1)/2,h-.035,t.y-(this.height-1)/2,.985,.08,.985,this.material(0x88969a));trim.userData.tile=tile.userData.tile;this.tileMeshes.push(trim);}
      if(t.obstacle){
        const p=this.world(t);
        // Central and southern ruins stay below street sightlines; full height
        // facades live on the northern boundary, behind the playable lanes.
        const north=t.y<=1,landmarkCutaway=(t.x<=2&&t.y===state.goal.y+1)||state.spawns.some(p=>Math.abs(t.x-p.x)<=1&&t.y===p.y+1);
        const wallHeight=north?(t.y===0?1.25:1.16):landmarkCutaway?.30:.72;
        const masonry=this.material(north?0x35424c:0x424d51,{map:this.stoneTexture});
        this.box(this.terrain,p.x,wallHeight/2,p.z,.96,wallHeight,.96,masonry);
        this.box(this.terrain,p.x,wallHeight+.025,p.z,.98,.055,.98,this.material(0x53616a,{map:this.stoneTexture,bumpMap:this.stoneTexture,bumpScale:.04}));
        if(!north&&(t.x+t.y)%5===0){const rubble=this.box(this.terrain,p.x+.13,wallHeight+.11,p.z-.12,.31,.17,.42,this.material(0x5b6569,{map:this.stoneTexture}));rubble.rotation.y=.24;}
        for(let band=.22;band<wallHeight;band+=.25)this.box(this.terrain,p.x,band,p.z+.489,.97,.018,.012,this.material(0x202c34));
        if(north&&t.y===1)this.facadeWindow(p.x,wallHeight,p.z+.498);
      }

    }
    this.terrain.add(streetDetails(state,LAYER_HEIGHT));
    this.roofline();
    // Low perimeter masonry and iron rails frame the board, never the routes.
    for(let x=-this.width/2;x<=this.width/2;x+=1){
      this.box(this.terrain,x,.02,-this.height/2-.5,.9,.27,.38,side);
      if(Math.round(x+this.width/2)%2===0){this.box(this.terrain,x,.53,-this.height/2-.5,.055,.78,.055,edge);const cap=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,4),copper);cap.position.set(x,.99,-this.height/2-.5);this.terrain.add(cap);}
    }
    this.box(this.terrain,0,.64,-this.height/2-.5,this.width,.045,.045,edge);
    // Broken pointed arches sit wholly behind the northern boundary.
    for(const x of [-5.5,5.5]){
      const z=-this.height/2-.72,archStone=this.material(0x3b4c54,{map:this.stoneTexture});
      for(const sideX of [-.67,.67]){this.box(this.terrain,x+sideX,.73,z,.19,1.52,.22,archStone);this.box(this.terrain,x+sideX,.08,z,.34,.18,.35,side);}
      const arch=new THREE.CurvePath<THREE.Vector3>();
      arch.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x-.67,1.45,z),new THREE.Vector3(x-.65,1.94,z),new THREE.Vector3(x,2.27,z)));
      arch.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x,2.27,z),new THREE.Vector3(x+.65,1.94,z),new THREE.Vector3(x+.67,1.45,z)));
      this.terrain.add(new THREE.Mesh(new THREE.TubeGeometry(arch,18,.085,6,false),archStone));
      this.box(this.terrain,x,2.29,z,.11,.23,.16,copper);
    }
    for(const p of [{x:1,y:2},{x:7,y:5},{x:17,y:6}]){const t=state.tiles.find(t=>t.x===p.x&&t.y===p.y);if(t?.obstacle)this.lamp(p.x-(this.width-1)/2,p.y-(this.height-1)/2);}
    for(const x of [-this.width/2-.5,this.width/2+.5])for(const z of [-this.height/2-.5,this.height/2+.5])this.lamp(x,z);
    for(const x of [-this.width/2-.6,this.width/2+.6]){
      this.box(this.terrain,x,.75,-1.5,.45,1.7,.52,side);
      this.box(this.terrain,x,1.57,-1.5,.62,.16,.68,this.material(0x77838a));
      this.box(this.terrain,x,.27,1.5,.48,.7,.48,side);
    }
    state.spawns.forEach((s,i)=>this.groundMark(s,P.red,`侵入 ${i+1}`,'spawn'));
    if(state.exploration){for(const point of [{id:'exit',pos:state.exploration.definition.exit,kind:'exit'},...state.exploration.definition.points]){const mark=this.groundMark(point.pos,point.kind==='exit'?P.cyan:P.copper,point.kind==='exit'?'出口':point.kind==='resource'?'生命力':'静钟','gate');mark.userData.point=point;this.eventMarks.push(mark);}}else this.createCrystal(state.goal);batchArchitecture(this.terrain,this.crystal);
    this.overlayKey='';this.structuresKey='';this.waveKey='';
  }

  private lamp(x:number,z:number) {
    const iron=this.material(0x18262d,{metalness:.6}),trim=this.material(P.copper,{metalness:.5});
    this.box(this.terrain,x,.02,z,.46,.22,.46,iron);
    this.box(this.terrain,x,.6,z,.07,1.15,.07,iron);
    this.box(this.terrain,x,1.26,z,.27,.38,.27,this.material(0xffd69a,{emissive:0xc9823c,emissiveIntensity:1.0}));
    for(const dx of [-.15,.15])for(const dz of [-.15,.15])this.box(this.terrain,x+dx,1.26,z+dz,.025,.42,.025,iron);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.26,.25,4),trim);roof.rotation.y=Math.PI/4;roof.position.set(x,1.56,z);this.terrain.add(roof);
    const glow=new THREE.PointLight(0xffbf76,10,4.5,2);glow.position.set(x,1.4,z);this.terrain.add(glow);
  }

  private facadeWindow(x:number,height:number,z:number) {
    const shape=new THREE.Shape();shape.moveTo(-.13,-.22);shape.lineTo(.13,-.22);shape.lineTo(.13,.08);shape.quadraticCurveTo(.1,.22,0,.29);shape.quadraticCurveTo(-.1,.22,-.13,.08);shape.closePath();
    const inset=new THREE.Mesh(new THREE.ShapeGeometry(shape),this.material(0x8d7045,{emissive:0xffb857,emissiveIntensity:.8}));inset.position.set(x,height*.54,z+.008);this.terrain.add(inset);
    const frame=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(12).map(p=>new THREE.Vector3(p.x,p.y,0))),new THREE.LineBasicMaterial({color:0x9b8b70}));frame.position.copy(inset.position);frame.position.z+=.007;this.terrain.add(frame);
    const stone=this.material(0x627177);
    this.box(this.terrain,x,height*.54-.23,z+.035,.34,.05,.10,stone);
    this.box(this.terrain,x,height*.54,z+.025,.026,.41,.025,this.material(0x645c4e));
  }

  private roofline() {
    const slate=this.material(0x202b39,{side:THREE.DoubleSide,metalness:.18,roughness:.8,map:this.stoneTexture}),rim=this.material(0x596974),iron=this.material(0x19242c,{metalness:.5});
    for(const tileX of [.5,5.5,10.5,15.5,20.5]){
      const deep=tileX!==2.5,d=deep?.96:.49,x=tileX-(this.width-1)/2,z=-(this.height-1)/2+(deep?.5:0);
      const v=[-.95,0,-d, .95,0,-d, 0,.64,-d, -.95,0,d, 0,.64,d, .95,0,d, -.95,0,-d,0,.64,-d,0,.64,d, -.95,0,-d,0,.64,d,-.95,0,d, .95,0,-d,.95,0,d,0,.64,d, .95,0,-d,0,.64,d,0,.64,-d];
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geometry.computeVertexNormals();
      const roof=new THREE.Mesh(geometry,slate);roof.position.set(x,1.31,z);this.terrain.add(roof);
      this.box(this.terrain,x,1.94,z,.055,.055,d*2+.05,rim);
      this.box(this.terrain,x+.57,1.76,z-.13,.16,.64,.16,this.material(0x3c474e));
      this.box(this.terrain,x+.57,2.08,z-.13,.22,.07,.22,rim);
      for(let dz=-d+.12;dz<d;dz+=.25){
        const seam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x-.93,1.33,z+dz),new THREE.Vector3(x,1.96,z+dz),new THREE.Vector3(x+.93,1.33,z+dz)]),new THREE.LineBasicMaterial({color:0x43505a,transparent:true,opacity:.7}));this.terrain.add(seam);
      }
    }
    // The centre is a ruined chapel foundation, not a tall occluding building.
    for(let tileX=9;tileX<=11;tileX++){
      const p=this.world({x:tileX,y:4});
      for(const dx of [-.34,0,.34])this.box(this.terrain,p.x+dx,1.17,p.z+.44,.025,.38,.025,iron);
      this.box(this.terrain,p.x,1.26,p.z+.44,.96,.025,.025,iron);
    }
    for(const p of [{x:9,y:3},{x:11,y:3},{x:10,y:4}]){
      const v=this.world(p);this.box(this.terrain,v.x,1.07,v.z,.44,.23,.7,this.material(0x313d46,{map:this.stoneTexture}));
      this.box(this.terrain,v.x,1.2,v.z,.5,.04,.77,this.material(0x647071,{map:this.stoneTexture}));
      this.box(this.terrain,v.x,1.23,v.z,.055,.014,.37,rim);this.box(this.terrain,v.x,1.23,v.z-.06,.24,.014,.05,rim);
    }
  }

  private groundMark(pos:Pos,color:number,label:string,kind:string) {
    const group=new THREE.Group();group.position.copy(this.world(pos,.065));this.terrain.add(group);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.4,kind==='gate'?4:32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;if(kind==='gate')ring.rotation.z=Math.PI/4;ring.renderOrder=12;group.add(ring);
    const tag=this.label(label,color);tag.position.set(0,.12,.42);tag.scale.set(1.05,.28,1);tag.material.depthTest=false;tag.renderOrder=13;group.add(tag);return group;
  }
  private label(text:string,color:number) {
    const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d')!;
    ctx.font='bold 27px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#111b20';ctx.shadowBlur=8;ctx.strokeStyle='#162129';ctx.lineWidth=5;ctx.strokeText(text,128,32);ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;ctx.fillText(text,128,32);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));
  }
  private createCrystal(pos:Pos) {
    const g=new THREE.Group();g.position.copy(this.world(pos));this.terrain.add(g);this.crystal=g;
    const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.38,.5,.23,8),this.material(0x263a42));plinth.position.y=.15;g.add(plinth);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.025,6,32),this.material(P.copper,{metalness:.8}));ring.rotation.x=Math.PI/2;ring.position.y=.29;g.add(ring);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.42),this.material(0xa5e0e4,{emissive:0x3a94a1,emissiveIntensity:.65,metalness:.25,roughness:.2}));gem.scale.set(.7,1.6,.7);gem.position.y=1.05;g.add(gem);this.crystalGem=gem;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const bar=this.box(g,Math.cos(a)*.38,.54,Math.sin(a)*.38,.045,.66,.045,this.material(P.copper));bar.rotation.z=Math.cos(a)*.2;}
    const glow=new THREE.PointLight(0x79d8e3,5,4);glow.position.y=1.1;g.add(glow);
    const tag=this.label('防守水晶',P.cyan);tag.position.set(0,.25,.52);tag.scale.set(1.35,.29,1);g.add(tag);
    // Crystal and extraction are a single ground landmark; keep the complete
    // silhouette readable behind the deliberate foreground wall cutaway.
    g.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Sprite){object.renderOrder=18;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.depthTest=false;material.depthWrite=false;}}});
  }

  private makeActor(unit:Unit):Actor {
    const group=new THREE.Group();
    // Billboards are UI-like character cutouts: their plane must not intersect
    // the platform behind their feet. Actor depth is handled explicitly below.
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthTest:false,depthWrite:false,alphaTest:.02}));
    sprite.visible=false;
    sprite.renderOrder=5;
    sprite.center.set(.5,.045);sprite.scale.set(1.04,1.47,1);sprite.userData.unitId=unit.id;group.add(sprite);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.32,24),new THREE.MeshBasicMaterial({color:0x061319,transparent:true,opacity:.5,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.65;shadow.position.y=.025;group.add(shadow);
    const barCanvas=document.createElement('canvas');barCanvas.width=256;barCanvas.height=72;
    const barTexture=new THREE.CanvasTexture(barCanvas);barTexture.colorSpace=THREE.SRGBColorSpace;
    const bar=new THREE.Sprite(new THREE.SpriteMaterial({map:barTexture,transparent:true,depthTest:false,depthWrite:false}));bar.scale.set(1.03,.29,1);bar.position.y=2.45;bar.renderOrder=10;group.add(bar);
    const buffCanvas=document.createElement('canvas');buffCanvas.width=320;buffCanvas.height=48;
    const buffTexture=new THREE.CanvasTexture(buffCanvas);buffTexture.colorSpace=THREE.SRGBColorSpace;
    const buff=new THREE.Sprite(new THREE.SpriteMaterial({map:buffTexture,transparent:true,depthTest:false,depthWrite:false}));buff.center.set(.5,0);buff.visible=false;group.add(buff);
    const triangle=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-.58),new THREE.Vector3(-.1,0,-.37),new THREE.Vector3(.1,0,-.37)]);
    const arrow=new THREE.Mesh(triangle,new THREE.MeshBasicMaterial({color:unit.team==='ally'?P.cyan:P.red,side:THREE.DoubleSide,transparent:true,opacity:.85}));arrow.position.y=.035;group.add(arrow);
    this.scene.add(group);
    const actor:Actor={group,sprite,bar,barCanvas,barTexture,buff,buffCanvas,buffTexture,lastBuff:'',buffMaximum:new Map(),arrow,lastBar:'',unit,animationDt:0,attackRemaining:0,attackRestart:false,previousPos:{...unit.drawPos},moving:false,hadPath:false,deathElapsed:0};
    const aliases:Record<string,string>={Galore0:'Galore',dustin:'Dustin',verlaine_bot:'Verlaine_bot'};
    const attach=(visual:SpineVisual)=>{
      if(this.disposed||actor.released){visual.dispose();return;}
      actor.spine=visual;actor.spineTexture=new THREE.CanvasTexture(visual.canvas);actor.spineTexture.colorSpace=THREE.SRGBColorSpace;
      actor.sprite.material.map=actor.spineTexture;actor.sprite.material.needsUpdate=true;
      const size=1.8*visual.displayScale;
      actor.sprite.center.set(.5,.12109375);actor.sprite.scale.set(size,size,1);
        actor.sprite.visible=true;
    };
    if(unit.basicProfileId==='hunter-v2'&&!unit.cloneOf){actor.referenceRequested=true;ReferenceBlueVisual.load().then(v=>{if(this.disposed||actor.released){v.dispose();return;}actor.reference=v;actor.spineTexture=new THREE.CanvasTexture(v.canvas);actor.spineTexture.colorSpace=THREE.SRGBColorSpace;actor.sprite.material.map=actor.spineTexture;actor.sprite.material.needsUpdate=true;actor.sprite.center.set(.5,.3);actor.sprite.scale.set(4,4,1);actor.sprite.visible=true;}).catch(error=>{if(actor.released||this.disposed)return;actor.loadFailed=true;window.dispatchEvent(new CustomEvent('character-load-error',{detail:'Hunter Reference assets unavailable: '+String(error)}));});return actor;}
    const asset=aliases[unit.asset]??unit.asset,prepared=SpineVisual.prepared(asset);
    if(prepared)attach(prepared);
    else SpineVisual.load(asset).then(attach).catch(error=>{if(actor.released||this.disposed)return;actor.loadFailed=true;window.dispatchEvent(new CustomEvent('character-load-error',{detail:asset+'：'+String(error)}));});
    return actor;
  }

  private updateActors(state:GameState,dt:number,selectedId:string|null) {
    const existing=new Set<string>();
    for(const unit of state.units){
      existing.add(unit.id);
      let actor=this.unitVisuals.get(unit.id);if(actor&&!!actor.referenceRequested!==(unit.basicProfileId==='hunter-v2'&&!unit.cloneOf)){this.releaseActor(actor);this.unitVisuals.delete(unit.id);actor=undefined;}if(!actor){actor=this.makeActor(unit);this.unitVisuals.set(unit.id,actor);}
      if(unit.life!=='active'&&unit.life!=='downed'){actor.group.visible=false;continue;}
      actor.unit=unit;actor.group.visible=unit.team==='ally'||visible(state,unit)||!state.exploration&&unit.reveal>0;
      const p=unit.drawPos??unit.pos;
      actor.group.position.set(p.x-(this.width-1)/2,this.level(unit.pos)+.065,p.y-(this.height-1)/2);
      const changedPosition=Math.abs(p.x-actor.previousPos.x)+Math.abs(p.y-actor.previousPos.y)>.00001;
      const startedPath=unit.path.length>0&&!actor.hadPath;
      const moving=unit.life==='active'&&(unit.path.length>0||!!unit.evasion?.action||!!unit.direct?.direction||!!unit.skillLanding||(!unit.cloneOf&&!!unit.skillStates?.[unit.skillId||'']?.run?.phase))&&(dt>0?(changedPosition||startedPath)&&!unit.attackPending:actor.moving);
      actor.previousPos={...p};actor.moving=moving;actor.hadPath=unit.path.length>0;
      const pending=unit.attackIntent||unit.attackPending;
      const formal=unit.basicAction?.definitionId==='hunter-basic-v1'?unit.basicAction:undefined;
      const newAttack=formal?formal!==actor.basicRef:!!pending&&pending!==actor.pendingRef;
      if(newAttack&&formal){actor.basicRef=formal;actor.basicClip=basicPresentation(formal.presentationId);actor.basicAcceptedAt=formal.acceptedAt;}
      else if(newAttack){actor.basicClip=undefined;actor.basicAcceptedAt=undefined;}
      if(!formal&&actor.basicRef&&!actor.basicRef.released){actor.attackRemaining=0;actor.basicClip=undefined;actor.basicAcceptedAt=undefined;}
      if(!formal)actor.basicRef=undefined;
      const cancelledWindup=!!actor.pendingRef&&!pending&&unit.attackFlash<=0&&unit.basicRelease?.pending!==actor.pendingRef;
      actor.pendingRef=pending;
      if(moving||unit.evasion?.action||unit.skillTime>0||unit.life==='downed'||cancelledWindup){actor.attackRemaining=0;actor.attackRestart=false;}
      else if(newAttack){actor.attackRemaining=actor.spine?.duration('attack')??unit.attackPeriod;actor.attackRestart=true;}
      else actor.attackRemaining=Math.max(0,actor.attackRemaining-dt);
      const bob=moving&&!this.reducedMotion?Math.abs(Math.sin(state.time*9))*.055:0;
      actor.sprite.position.y=unit.life==='downed'?-.055:bob;
      actor.sprite.material.color.set(unit.hitFlash>0?0xffb2ad:unit.cloneOf?0x718aab:unit.skillTime>0?0xc2efff:0xffffff);
      actor.sprite.material.opacity=unit.crossing?Math.max(.08,Math.abs(unit.crossing.elapsed/SPACE.crossSeconds*2-1)):1;
      actor.sprite.material.rotation=unit.life==='downed'?(actor.spine?-.62:-.9):0;
      const upProjection=Math.abs(this.camera.getWorldDirection(new THREE.Vector3()).z);
      actor.bar.position.y=(unit.life==='downed'?.94:1.5)/upProjection;
      const direction=unit.heading!==undefined&&Math.abs(Math.cos(unit.heading))>.05?(Math.cos(unit.heading)<0?-1:1):unit.facing==='west'?-1:unit.facing==='east'?1:actor.sprite.userData.facing??1;
      const facing=actor.sprite.userData.facing=direction;
      if(actor.reference){actor.reference.draw(unit,state,moving);actor.sprite.scale.set(4,4,1);actor.sprite.material.rotation=0;actor.spineTexture!.needsUpdate=true;}
      else if(actor.spine){
        const size=1.8*actor.spine.displayScale;actor.sprite.scale.set(size,size,1);
        actor.animationDt=dt;
        const firstDownedPose=unit.life==='downed'&&!actor.downPose;
        const frozenDowned=unit.life==='downed'&&actor.deathElapsed>=Math.max(.08,Math.min(.7,actor.spine.duration('dead')*.55));
        if(actor.group.visible&&((dt>0&&!frozenDowned)||firstDownedPose||!!formal)){
          const action=unit.life==='downed'?'dead':moving?'move':unit.skillTime>0?'skill':actor.attackRemaining>0?'attack':'idle';
          let animationDelta=actor.animationDt*movementAnimationRate(state,unit,action);
          if(action==='dead'){
            // Exported death clips eventually hide every slot. A rescueable body
            // must remain: hold the fall pose before the disappearance phase.
            const limit=Math.max(.08,Math.min(.7,actor.spine.duration('dead')*.55));
            // State may change while paused or load already downed. Sampling a
            // visual fall pose is not simulation time and must happen at dt=0.
            if(firstDownedPose&&dt===0)animationDelta=limit;
            animationDelta=Math.max(0,Math.min(animationDelta,limit-actor.deathElapsed));
            actor.deathElapsed+=animationDelta;
            if(!actor.downPose){actor.downPose=document.createElement('canvas');actor.downPose.width=actor.downPose.height=512;actor.downPose.getContext('2d')!.drawImage(actor.spine.canvas,0,0);}
          }else{actor.deathElapsed=0;actor.downPose=undefined;}
          actor.spine.update(animationDelta,action,facing,action==='attack'&&actor.attackRestart,unit.skillId,actor.basicClip,actor.basicClip&&actor.basicAcceptedAt!==undefined?state.time-actor.basicAcceptedAt:undefined);
          if(action==='dead'&&actor.downPose){
            const ctx=actor.spine.canvas.getContext('2d')!,alpha=ctx.getImageData(0,0,512,512).data;
            let solid=0;for(let i=3;i<alpha.length;i+=256)if(alpha[i]>80)solid++;
            if(solid>8){const saved=actor.downPose.getContext('2d')!;saved.clearRect(0,0,512,512);saved.drawImage(actor.spine.canvas,0,0);}
            else{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);ctx.drawImage(actor.downPose,0,0);}
          }
          actor.attackRestart=false;
          actor.animationDt=0;actor.spineTexture!.needsUpdate=true;
        }
      }else actor.sprite.scale.x=1.04*facing;
      actor.arrow.rotation.y=unit.heading!==undefined?-unit.heading-Math.PI/2:({north:0,east:-Math.PI/2,south:Math.PI,west:Math.PI/2})[unit.facing];
      actor.arrow.visible=unit.life==='active'&&!unit.cloneOf;
      const shield=unit.statuses.filter(s=>s.kind==='shield'&&s.remaining>0).reduce((n,s)=>n+s.power,0);
      const selected=state.units.find(a=>a.id===selectedId),showPosture=unit.team==='ally'||selectedId===unit.id||selected?.attackPending?.targetId===unit.id||unit.postureRecent>0||unit.posture<=0||unit.stagger>0;
      const pressure=unit.wallPin?'钉墙':unit.stagger>0?'硬直':unit.posture<=0?'破势':'';
      const weak=state.effects.some(e=>e.kind==='weakpoint'&&e.targetId===unit.id&&e.remaining>0);
      const tell=unit.enemyCombat?.reaction,ability=unit.attackIntent?.label;
      const pressureLabel=[weak?'弱点':'',pressure,ability||'',tell?(tell.phase==='pending'?REACTIONS[tell.id].label:tell.id==='front-brace'?'正面架防':tell.id==='backstep-evade'?'后撤':'侧移'):''].filter(Boolean).join(' · ');
      const stamp=`${showPosture}:${Math.ceil(unit.posture)}:${unit.maxPosture}:${Math.ceil(unit.grayHp)}:${pressureLabel}:${Math.ceil(unit.hp)}:${unit.maxHp}:${unit.life}:${Math.ceil(unit.downTimer)}:${Math.ceil(shield)}`;
      if(stamp!==actor.lastBar){
        actor.lastBar=stamp;const g=actor.barCanvas.getContext('2d')!;g.clearRect(0,0,256,72);
        g.fillStyle='#d8d4c7';g.textAlign='center';g.font='bold 24px "Microsoft YaHei",sans-serif';g.shadowColor='#0d151d';g.shadowBlur=5;
        g.fillText(unit.life==='downed'?`救援 ${Math.ceil(unit.downTimer)}s`:pressureLabel?pressureLabel:unit.team==='ally'?unit.name:'',128,26);g.shadowBlur=0;
        g.fillStyle='#111c25';g.fillRect(29,37,198,16);g.strokeStyle='#18232c';g.lineWidth=3;g.strokeRect(29,37,198,16);
        if(unit.team==='ally'&&unit.grayHp>0){g.fillStyle='#b9b6af';g.fillRect(32,40,192*Math.min(1,(unit.hp+unit.grayHp)/unit.maxHp),10);}
        g.fillStyle=unit.life==='downed'?'#c99066':unit.team==='ally'?'#86c7bd':'#b7656b';g.fillRect(32,40,192*Math.max(0,unit.hp/unit.maxHp),10);
        if(shield>0){g.fillStyle='#adddea';g.fillRect(32,55,192*Math.min(1,shield/unit.maxHp),4);}
        if(showPosture){g.fillStyle='#302d29';g.fillRect(32,62,192,5);g.fillStyle=pressureLabel?'#d98267':'#c8a366';g.fillRect(32,62,192*Math.max(0,unit.posture/unit.maxPosture),5);}
        actor.barTexture.needsUpdate=true;
      }
      this.updateBuffs(actor);
    }
    for(const [id,a]of this.unitVisuals)if(!existing.has(id)){this.releaseActor(a);this.unitVisuals.delete(id);}
    const towardCamera=this.camera.getWorldDirection(new THREE.Vector3()).negate();
    const ordered=[...this.unitVisuals.values()].filter(a=>a.group.visible).sort((a,b)=>
      Math.abs(a.group.position.dot(towardCamera)-b.group.position.dot(towardCamera))>.02?a.group.position.dot(towardCamera)-b.group.position.dot(towardCamera):state.units.indexOf(a.unit)-state.units.indexOf(b.unit)||a.unit.id.localeCompare(b.unit.id));
    ordered.forEach((a,i)=>{a.sprite.renderOrder=20+i;a.bar.renderOrder=1000+i;a.buff.renderOrder=2000+i;});
  }

  private releaseActor(actor:Actor){
    if(actor.released)return;actor.released=true;this.scene.remove(actor.group);actor.spine?.dispose();actor.reference?.dispose();
    const textures=new Set<THREE.Texture>([actor.barTexture,actor.buffTexture]);
    if(actor.spineTexture)textures.add(actor.spineTexture);
    actor.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}if(o instanceof THREE.Mesh||o instanceof THREE.Sprite){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    textures.forEach(t=>t.dispose());actor.barCanvas.width=actor.barCanvas.height=0;actor.buffCanvas.width=actor.buffCanvas.height=0;actor.group.clear();actor.buffMaximum.clear();actor.downPose=undefined;
  }

  private cell(pos:Pos,color:number,opacity:number,outline=false) {
    const p=this.world(pos,.095);
    const geometry=outline?new THREE.EdgesGeometry(new THREE.PlaneGeometry(.88,.88)):new THREE.PlaneGeometry(.9,.9);
    const mesh=outline?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false})):new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.copy(p);mesh.renderOrder=2;this.overlayGroup.add(mesh);
  }
  private updateBuffs(actor:Actor) {
    const statuses=actor.unit.statuses.filter(status=>status.remaining>0).map(s=>({...s,meter:false}));
    if((actor.unit.poisonMeter||0)>0)statuses.push({kind:'poison',remaining:actor.unit.poisonMeter!,power:0,name:'毒素积累',duration:100,meter:true});
    actor.buff.visible=statuses.length>0;
    if(!statuses.length){actor.lastBuff='';actor.buffMaximum.clear();return;}
    const worldPerPixel=(this.camera.top-this.camera.bottom)/Math.max(1,this.host.clientHeight);
    const width=Math.max(1.35,112*worldPerPixel);
    actor.buff.scale.set(width,width*statuses.length*48/320,1);
    const upProjection=this.camera.position.z/this.camera.position.length();
    actor.buff.position.set(0,actor.bar.position.y+.23/upProjection,0);
    const stamp=statuses.map((s,i)=>`${s.kind}:${i}:${s.remaining.toFixed(1)}:${Math.ceil(s.power)}`).join('|');
    if(stamp===actor.lastBuff)return;actor.lastBuff=stamp;
    const c=actor.buffCanvas;if(c.height!==statuses.length*48)c.height=statuses.length*48;
    const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);
    const names={attack:'攻击强化',guard:'闪避保护',poison:'持续中毒',defense:'减伤',stun:'眩晕',shield:'护盾',regen:'持续恢复',slow:'缓速',warding:'合契护纹',resistBreak:'削抗',crack:'裂纹'};
    const colors={attack:'#e1b47b',guard:'#86cedc',poison:'#bd9bda',defense:'#91bde6',stun:'#eed38b',shield:'#adddea',regen:'#85ceaa',slow:'#8aaed6',warding:'#9cd4c4',resistBreak:'#d4ab70',crack:'#d685bc'};
    statuses.forEach((s,i)=>{
      const key=`${s.kind}:${i}`,maximum=s.meter?100:Math.max(s.duration||0,actor.buffMaximum.get(key)||0,s.remaining);actor.buffMaximum.set(key,maximum);
      const y=i*48,color=colors[s.kind];
      ctx.fillStyle='rgba(10,19,27,.94)';ctx.fillRect(0,y,320,45);
      ctx.fillStyle=color;ctx.fillRect(0,y,4,45);
      ctx.fillStyle='#2d3a43';ctx.fillRect(10,y+35,300,6);
      ctx.fillStyle=color;ctx.fillRect(10,y+35,300*Math.min(1,s.remaining/Math.max(.01,maximum)),6);
      ctx.font='bold 29px "Microsoft YaHei",sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(s.name||names[s.kind],12,y+19);
      ctx.font='bold 30px Consolas,monospace';ctx.textAlign='right';ctx.fillText(s.meter?`${Math.round(s.remaining)}/100`:s.kind==='shield'?`${Math.ceil(s.power)} · ${s.remaining.toFixed(1)}s`:`${s.remaining.toFixed(1)}s`,309,y+19);
    });
    actor.buffTexture.needsUpdate=true;
  }

  private updateWaves(state:GameState) {
    const active=queryWavePreviews(state);
    const key=active.map(w=>`${w.id}:${w.previewAt}:${w.startAt}:${w.route.map(p=>this.key(p)).join(';')}`).join('|');
    if(key!==this.waveKey){
      this.waveKey=key;this.clear(this.waveGroup);this.wavePreviews=[];
      for(const [order,wave] of active.entries()){
        const points=wave.route.map(p=>this.world(p,.13+order*.035)),lengths:number[]=[];let total=0;
        const color=wave.route[0].y<state.height/2?0x96d9ec:0xffc39c;
        for(let i=1;i<points.length;i++){const length=points[i].distanceTo(points[i-1]);lengths.push(length);total+=length;}
        const rail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.4,depthTest:false,depthWrite:false}));rail.renderOrder=4;this.waveGroup.add(rail);
        const heads=Array.from({length:3},(_,i)=>{
          const shape=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.25,0,0),new THREE.Vector3(-.18,0,-.15),new THREE.Vector3(-.09,0,0),new THREE.Vector3(.25,0,0),new THREE.Vector3(-.09,0,0),new THREE.Vector3(-.18,0,.15)]);
          const head=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:1-i*.2,depthTest:false,depthWrite:false}));head.renderOrder=6;this.waveGroup.add(head);return head;
        });
        this.wavePreviews.push({id:wave.id,points,lengths,total,heads});
      }
    }
    for(const preview of this.wavePreviews){
      const wave=active.find(w=>w.id===preview.id)!;
      const fraction=Math.max(0,Math.min(1,(state.time-wave.previewAt)/Math.max(.1,wave.startAt-wave.previewAt)));
      preview.heads.forEach((head,index)=>{
        const progress=fraction*fraction*(3-2*fraction);
        let distance=(this.reducedMotion?(index+1)/4:progress)*preview.total-(this.reducedMotion?0:index*.53);head.visible=distance>=0;if(!head.visible)return;
        let segment=0;while(segment<preview.lengths.length-1&&distance>preview.lengths[segment])distance-=preview.lengths[segment++];
        const a=preview.points[segment],b=preview.points[segment+1],t=Math.min(1,distance/Math.max(.001,preview.lengths[segment]));
        head.position.copy(a).lerp(b,t);head.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
      });
    }
  }
  private updateOverlay(overlay:UIOverlay) {
    const stamp=JSON.stringify([overlay,overlay.debugAutonomy?this.state?.units.filter(u=>u.team==='ally'&&!u.cloneOf&&u.life==='active').map(u=>[u.pos,u.ai,u.companionCombat,this.state?.units.find(t=>t.id===u.ai?.targetId)?.pos]):undefined]);if(stamp===this.overlayKey)return;this.overlayKey=stamp;this.clear(this.overlayGroup);
    if(overlay.debugAutonomy&&this.state){for(const u of this.state.units.filter(a=>a.team==='ally'&&!a.cloneOf&&a.life==='active')){const combat=u.companionCombat;if(combat){
       for(const [p,r,color] of [[combat.point,.12,P.bone],...activeEncounters(this.state).map(e=>[e.center,e.tacticalRadius,P.copper] as const)] as const){if(!p)continue;const ring=new THREE.Mesh(new THREE.RingGeometry(r-.015,r+.015,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(this.world(p,.1));this.overlayGroup.add(ring);}
       const target=this.state.units.find(e=>e.id===combat.targetId);if(target)this.overlayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.world(u.pos,.14),this.world(target.pos,.14)]),new THREE.LineBasicMaterial({color:P.red,depthTest:false,depthWrite:false})));continue;
      }const ai=u.ai;if(!ai)continue;
      for(const [p,r,color] of [[ai.anchor,activityRadius(this.state),P.copper],[ai.anchor,comfortRadius(this.state),P.cyan],[ai.contributionPoint,.12,P.bone],[ai.followPoint,.45,P.cyan]] as const){if(!p)continue;const ring=new THREE.Mesh(new THREE.RingGeometry(r-.015,r+.015,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(this.world(p,.1));ring.renderOrder=14;this.overlayGroup.add(ring);}
      if(ai.anchor){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.world(u.pos,.13),this.world(ai.anchor,.13)]),new THREE.LineBasicMaterial({color:P.copper,depthTest:false,depthWrite:false}));this.overlayGroup.add(line);}
      const target=this.state.units.find(t=>t.id===ai.targetId&&t.life==='active');if(target){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.world(u.pos,.14),this.world(target.pos,.14)]),new THREE.LineBasicMaterial({color:P.red,depthTest:false,depthWrite:false}));this.overlayGroup.add(line);}
    }}
    overlay.deployTiles.forEach(p=>{this.cell(p,P.cyan,.09);this.cell(p,P.cyan,.35,true);});
    const rangeColor=overlay.rangeKind==='skill'?0x7adab7:P.copper;
    if(overlay.attackPreview)this.attackArea(overlay.attackPreview);else overlay.range.forEach(p=>{this.cell(p,rangeColor,.2);this.cell(p,rangeColor,.55,true);});
    overlay.path.forEach(p=>{this.cell(p,P.cyan,.23);});
    if(overlay.path.length>1){
      const points=overlay.path.map(p=>this.world(p,.16));
      const cyan=new THREE.MeshBasicMaterial({color:0x5fcde0,depthTest:false,depthWrite:false});
      const white=new THREE.MeshBasicMaterial({color:0xd6fbef,depthTest:false,depthWrite:false});
      for(let i=1;i<points.length;i++){
        const from=points[i-1],to=points[i],delta=to.clone().sub(from),length=delta.length();
        for(const [radius,material,order]of [[.045,cyan,7],[.015,white,8]] as const){
          const segment=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,6),material);
          segment.position.copy(from).add(to).multiplyScalar(.5);segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());segment.renderOrder=order;this.overlayGroup.add(segment);
        }
        const flat=new THREE.Vector3(delta.x,0,delta.z).normalize(),side=new THREE.Vector3(-flat.z,0,flat.x);
        const tip=to.clone().addScaledVector(flat,.16),tail=to.clone().addScaledVector(flat,-.12);
        const triangle=new THREE.BufferGeometry().setFromPoints([tip,tail.clone().addScaledVector(side,.14),tail.clone().addScaledVector(side,-.14)]);
        const arrow=new THREE.Mesh(triangle,new THREE.MeshBasicMaterial({color:0xc4f6ec,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));arrow.renderOrder=9;this.overlayGroup.add(arrow);
      }
      const end=new THREE.Mesh(new THREE.RingGeometry(.24,.29,24),new THREE.MeshBasicMaterial({color:0xb0f2eb,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));end.rotation.x=-Math.PI/2;end.position.copy(points.at(-1)!);end.renderOrder=8;this.overlayGroup.add(end);
    }
    if(overlay.hover){const ring=new THREE.Mesh(new THREE.RingGeometry(SPACE.radius,SPACE.radius+.045,32),new THREE.MeshBasicMaterial({color:overlay.hoverValid===false?P.red:P.cyan,side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(this.world(overlay.hover,.12));this.overlayGroup.add(ring);}
    const unit=this.state?.units.find(u=>u.id===overlay.selectedId);
    if(unit&&(unit.life==='active'||unit.life==='downed')){this.cell(unit.pos,P.cyan,.2);this.cell(unit.pos,P.cyan,1,true);}
  }

  private attackArea(preview:NonNullable<UIOverlay['attackPreview']>){
    const {vertices,outline}=rangeOverlay(this.state!,preview);
    const positions:number[]=[],colors:number[]=[],valid=new THREE.Color(P.copper),invalid=new THREE.Color(0x473d40);
    for(const p of vertices){positions.push(p.x-(this.width-1)/2,p.height,p.y-(this.height-1)/2);const c=p.valid?valid:invalid;colors.push(c.r,c.g,c.b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.24,side:THREE.DoubleSide,depthTest:true,depthWrite:false}));mesh.renderOrder=4;this.overlayGroup.add(mesh);
    const points=outline.map(p=>new THREE.Vector3(p.x-(this.width-1)/2,p.height,p.y-(this.height-1)/2));
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:P.copper,transparent:true,opacity:.9,depthTest:true,depthWrite:false}));this.overlayGroup.add(line);
  }

  private updateStructures(state:GameState) {
    const stamp=JSON.stringify([state.barricades,state.lights.map(l=>l.pos)]);if(stamp===this.structuresKey)return;this.structuresKey=stamp;this.renderer.shadowMap.needsUpdate=true;this.clear(this.structures);
    const wood=this.material(0x74634f),iron=this.material(0x23313b,{metalness:.5});
    for(const p of state.barricades){const v=this.world(p),group=new THREE.Group();group.position.copy(v);this.structures.add(group);for(const x of [-.28,.28])this.box(group,x,.32,0,.1,.66,.16,iron);this.box(group,0,.32,0,.84,.13,.11,wood);this.box(group,0,.54,0,.84,.13,.11,wood);}
    for(const l of state.lights){const p=this.world(l.pos,.15);const lantern=new THREE.Mesh(new THREE.OctahedronGeometry(.15),this.material(0xffdf9d,{emissive:0xd5aa62,emissiveIntensity:.8}));lantern.position.copy(p);this.structures.add(lantern);const light=new THREE.PointLight(0xffdbaa,7,4);light.position.copy(p).y+=.5;this.structures.add(light);}
  }
  private updateEffects(state:GameState,dt:number) {
    const areas=skillAreas(state),areaKey=JSON.stringify(areas);if(areaKey!==this.skillAreaKey){this.skillAreaKey=areaKey;this.clear(this.skillAreaGroup);for(const area of areas){
      const start=area.arc?(area.heading||0)-area.arc/2:0,arc=area.arc||Math.PI*2,points=[];for(let i=0;i<=64;i++){const a=start+arc*i/64;points.push(this.world({x:area.center.x+Math.cos(a)*area.radius,y:area.center.y+Math.sin(a)*area.radius},.15));}
      const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:area.color,transparent:true,opacity:.72,depthTest:false,depthWrite:false}));border.renderOrder=15;this.skillAreaGroup.add(border);
      const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.02,area.radius-.08),area.radius,64,1,start,arc),new THREE.MeshBasicMaterial({color:area.color,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=Math.PI/2;ring.position.copy(this.world(area.center,.12));this.skillAreaGroup.add(ring);
    }}

    const visit=state.attempt+':'+state.node+':'+state.phase;
    if(this.fxState!==state||this.fxVisit!==visit){this.fxVisit=visit;this.fxState=state;this.seenEffects.clear();this.fxCastTimes.clear();for(const fx of this.nativeEffects)this.removeFX(fx);this.nativeEffects=[];state.units.forEach(u=>SpineFX.preload(u.asset));}
    for(let i=this.nativeEffects.length-1;i>=0;i--){const fx=this.nativeEffects[i];if(state.phase!=='battle'||!fx.visual.update(dt,fx.facing)){this.removeFX(fx);this.nativeEffects.splice(i,1);}else{fx.sprite.visible=positionVisible(state,fx.pos);fx.texture.needsUpdate=true;}}
    for(const effect of state.effects){
      if(this.seenEffects.has(effect.id))continue;this.seenEffects.add(effect.id);
      if(!positionVisible(state,effect.from)||!positionVisible(state,effect.to))continue;
      if(effect.kind==='loot'||!effect.sourceId||!effect.asset||!effect.action)continue;
      const key=effect.sourceId+':'+effect.action;if(state.time-(this.fxCastTimes.get(key)??-10)<.12)continue;this.fxCastTimes.set(key,state.time);
      const facing=effect.to.x<effect.from.x?-1:1;
      this.spawnFX(state,effect.asset,effect.action,effect.from,facing,effect.action==='skill'?2.2:1.5);
      if(effect.kind==='shot')this.spawnFX(state,effect.asset,'hit',effect.to,facing,.95);
    }
    if(this.seenEffects.size>2000)this.seenEffects=new Set(state.effects.map(e=>e.id));
    this.clear(this.effectsGroup);
    for(const effect of state.effects){
      if(effect.kind==='loot'||!positionVisible(state,effect.from)||!positionVisible(state,effect.to))continue;
      if(effect.kind==='evade'){
        const actor=this.unitVisuals.get(effect.sourceId!);
        if(actor&&!this.reducedMotion){const ghost=new THREE.Sprite(new THREE.SpriteMaterial({map:actor.sprite.material.map,color:effect.color,transparent:true,opacity:.28*effect.remaining/.18,depthTest:false,depthWrite:false}));ghost.userData.borrowedMap=true;ghost.center.copy(actor.sprite.center);ghost.scale.copy(actor.sprite.scale);ghost.position.copy(this.world(effect.from,.065));ghost.renderOrder=4;this.effectsGroup.add(ghost);}
        continue;
      }
      if(effect.kind==='blink'||effect.kind==='deploy'||effect.kind==='recall'){
        const duration=effect.kind==='blink'?.24:effect.kind==='deploy'?.4:.32;
        const t=THREE.MathUtils.clamp(1-effect.remaining/duration,0,1),ease=1-(1-t)**3;
        const opacity=(1-t)*.8;
        const ring=(pos:Pos,radius:number,height:number)=>{
          const mesh=new THREE.Mesh(new THREE.RingGeometry(Math.max(.01,radius-.035),radius,32),new THREE.MeshBasicMaterial({color:effect.color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
          mesh.rotation.x=-Math.PI/2;mesh.position.copy(this.world(pos,height));this.effectsGroup.add(mesh);
        };
        if(this.reducedMotion){ring(effect.to,.4,.12);continue;}
        if(effect.kind==='blink'){
          ring(effect.from,.38*(1-ease)+.05,.12);ring(effect.to,.2+.4*ease,.12);
          const points=[this.world(effect.from,.45),this.world(effect.to,.45)];
          this.effectsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:effect.color,transparent:true,opacity,depthWrite:false})));
        }else{
          const radius=effect.kind==='deploy'?.12+.48*ease:.6*(1-t*t)+.02;
          ring(effect.to,radius,.12);ring(effect.to,radius*.75,.15+.7*(effect.kind==='deploy'?ease:1-ease));
          const points:THREE.Vector3[]=[];
          for(let i=0;i<6;i++){const angle=i*Math.PI/3,p={x:effect.to.x+Math.cos(angle)*radius,y:effect.to.y+Math.sin(angle)*radius};points.push(this.world(p,.15),this.world(p,.15+.45*(1-t)));}
          this.effectsGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:effect.color,transparent:true,opacity:opacity*.6,depthWrite:false})));
        }
        continue;
      }
      if(effect.kind==='weakpoint'){const t=THREE.MathUtils.clamp(1-effect.remaining/.65,0,1),mesh=new THREE.Mesh(new THREE.RingGeometry(.33,.39,24),new THREE.MeshBasicMaterial({color:effect.color,transparent:true,opacity:.7*(1-t),side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(this.world(effect.to,.18));mesh.scale.setScalar(this.reducedMotion?1:1+.15*(1-(1-t)**3));this.effectsGroup.add(mesh);}
      else if(effect.kind==='shot'){const a=this.world(effect.from,.75),b=this.world(effect.to,.7);this.effectsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:effect.color,transparent:true,opacity:.75})));}
      else {const mesh=new THREE.Mesh(new THREE.RingGeometry(.28,.34,32),new THREE.MeshBasicMaterial({color:effect.color,transparent:true,opacity:Math.min(.8,effect.remaining*2),side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(this.world(effect.to,.18));const scale=1+Math.max(0,.5-effect.remaining)*3;mesh.scale.setScalar(scale);this.effectsGroup.add(mesh);}
    }
  }

  private spawnFX(state:GameState,asset:string,action:'attack'|'skill'|'hit',pos:Pos,facing:number,size:number){
    if(this.nativeEffects.length+this.fxPending>=24||!positionVisible(state,pos))return;this.fxPending++;const visit=this.fxVisit;
    void SpineFX.load(asset,action).then(visual=>{
      if(!visual)return;if(this.disposed||this.fxState!==state||visit!==this.fxVisit||state.phase!=='battle'||!positionVisible(state,pos)){visual.dispose();return;}
      const texture=new THREE.CanvasTexture(visual.canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.copy(this.world(pos,.85));sprite.scale.set(size,size,1);sprite.renderOrder=900;this.scene.add(sprite);this.nativeEffects.push({visual,sprite,texture,facing,pos:{...pos}});
    }).catch(()=>{/* Source failure keeps existing geometric feedback. */}).finally(()=>this.fxPending--);
  }
  private removeFX(fx:{visual:SpineFX;sprite:THREE.Sprite;texture:THREE.CanvasTexture}){this.scene.remove(fx.sprite);fx.sprite.material.dispose();fx.texture.dispose();fx.visual.dispose();}
  dispose() {
    this.damageFloats.dispose();this.directions.dispose();this.telegraphs.dispose();this.disposed=true;this.observer.disconnect();this.nativeEffects.forEach(fx=>this.removeFX(fx));this.nativeEffects=[];
    this.unitVisuals.forEach(a=>this.releaseActor(a));this.unitVisuals.clear();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Sprite||o instanceof THREE.Line){if('geometry'in o)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);const map=(m as THREE.MeshBasicMaterial).map;if(map)textures.add(map);}}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    this.fog.dispose();this.stoneTexture.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
