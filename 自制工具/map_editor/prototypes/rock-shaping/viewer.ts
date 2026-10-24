import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { meshMap } from '../../core/mesher';
import { shapeRock, type RockOptions, type RockCell } from '../../core/rock-shaping';
import { FIXTURES, createFixture, presetSampleOptions } from './fixtures';

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const preset=element<HTMLSelectElement>('preset');
const fixture=element<HTMLSelectElement>('fixture');
const seed=element<HTMLSelectElement>('seed');
const unit=element<HTMLSelectElement>('cellSize');
const canvas=element<HTMLCanvasElement>('viewport');
for(const item of FIXTURES) fixture.add(new Option(item.name,item.id));

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x1d2228);
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,0.1,2000);
camera.up.set(0,0,1);
const controls=new OrbitControls(camera,canvas);
controls.mouseButtons={LEFT:null as any,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
controls.screenSpacePanning=true;
controls.enableDamping=false;
canvas.addEventListener('contextmenu',event=>event.preventDefault());
scene.add(new THREE.HemisphereLight(0xffffff,0xb8bec7,2));
const light=new THREE.DirectionalLight(0xffffff,1.6);
light.position.set(70,-100,130);scene.add(light);
const fill=new THREE.DirectionalLight(0xffffff,0.6);
fill.position.set(-90,60,50);scene.add(fill);
const material=new THREE.MeshStandardMaterial({color:0x92969b,roughness:1,metalness:0,side:THREE.DoubleSide});
let mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);scene.add(mesh);
const grid=new THREE.GridHelper(160,40,0x424a54,0x303740);
grid.rotation.x=Math.PI/2;grid.position.z=-0.06;scene.add(grid);
let source:RockCell[]=createFixture('block');
let options:RockOptions=presetSampleOptions('columnar-wall');
let result:ReturnType<typeof shapeRock>;
let showingOriginal=false;
let quads=0;
let timings={computeMs:0,meshMs:0,displayMs:0};

function draw(){const start=performance.now();renderer.render(scene,camera);timings.displayMs=performance.now()-start;}
controls.addEventListener('change',draw);
new ResizeObserver(()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();draw();}).observe(canvas);

function makeGeometry(cells:RockCell[]){
  const start=performance.now();
  const faces=meshMap({cells});quads=faces.length;
  const vertices:number[]=[];
  for(const face of faces){
    const axes=[0,1,2].filter(a=>a!==face.axis);
    const corner=(a:number,b:number)=>{const point=[0,0,0];point[face.axis]=face.plane;point[axes[0]]=a;point[axes[1]]=b;return point;};
    const corners=[corner(face.a,face.b),corner(face.a+face.w,face.b),corner(face.a+face.w,face.b+face.h),corner(face.a,face.b+face.h)];
    // Ordered axes have cross-product +X, -Y, +Z respectively.
    const forward=(face.axis===1?-1:1)===face.sign;
    for(const index of forward?[0,1,2,0,2,3]:[0,2,1,0,3,2]) vertices.push(...corners[index]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  mesh.geometry.dispose();mesh.geometry=geometry;
  timings.meshMs=performance.now()-start;
}

function resetCamera(){
  const box=new THREE.Box3();for(const cell of source){box.expandByPoint(new THREE.Vector3(cell.x,cell.y,cell.z));box.expandByPoint(new THREE.Vector3(cell.x+1,cell.y+1,cell.z+1));}
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  controls.target.copy(center);
  const span=Math.max(size.x,size.y,size.z),distance=span*2.55;
  camera.position.copy(center).add(new THREE.Vector3(0.95,-1.25,0.85).normalize().multiplyScalar(distance));
  controls.minDistance=span*.4;controls.maxDistance=span*10;
  camera.near=.05;camera.far=span*30;camera.updateProjectionMatrix();controls.update();draw();
}

const columnControls:[string,string,number,number,number,boolean?][]=[
 ['maxDepth','起伏深度',0,8,1,true],['minWidth','最小岩柱宽',2,10,1,true],['maxWidth','最大岩柱宽',2,14,1,true],
 ['continuity','竖向延续',6,36,1,true],['breakStrength','断阶变化',0,1,.05],['regularity','规整程度',0,1,.05],['chips','局部缺损',0,.3,.01],
];
const terraceControls:[string,string,number,number,number,boolean?][]=[
 ['bandWidth','边缘带宽',0,14,1,true],['layers','主层段数',2,6,1],['contourScale','轮廓段大小',6,32,1,true],
 ['layerVariation','层间错落',0,1,.05],
];

function reasonText(reason:string){
  if(reason.startsWith('Terraces require'))return '层阶预设需要平底实心平台；悬挑、分层空隙或不平底暂不支持。';
  if(reason.startsWith('Platform is too thin'))return '平台厚度不足，请减少层数或换用较厚模型。';
  if(reason.startsWith('Joint carving'))return '削切会破坏最小厚度或原有连通性，本次保持原形。';
  if(reason.startsWith('Invalid parameters'))return '参数或格尺寸不受支持。';
  if(reason.startsWith('Target is hidden'))return '目标已隐藏或锁定。';
  if(reason.startsWith('Empty target'))return '没有可处理的体素。';
  if(reason.startsWith('Perimeter cannot'))return '周长无法容纳当前岩柱宽度范围。';
  if(reason.includes('budget exceeded'))return '模型超过本轮原型的计算规模限制。';
  return reason;
}

function buildParameters(){
  element('parameters').replaceChildren();
  const column=options.preset==='columnar-wall';
  element('parameter-title').textContent=(column?'柱状结构':'层阶结构')+' · SAMPLE';
  element('side-section').hidden=!column;
  for(const [key,title,min,max,step,physical] of column?columnControls:terraceControls){
    const label=document.createElement('label'),heading=document.createElement('span');
    heading.append(document.createTextNode(title));
    const output=document.createElement('output');output.id=key+'Value';heading.append(output);
    const input=document.createElement('input');input.type='range';input.id=key;input.min=String(key==='continuity'?Math.max(min,options.maxWidth*2):min);input.max=String(max);input.step=String(step);input.value=String(options[key as keyof RockOptions]);
    const update=()=>{const value=Number(input.value);output.value=physical?`${value} 格 / ${(value*Number(unit.value)).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')} m`:String(value);};
    update();input.addEventListener('input',()=>{(options as any)[key]=Number(input.value);
      if(key==='minWidth'&&options.minWidth>options.maxWidth){options.maxWidth=options.minWidth;const sibling=element<HTMLInputElement>('maxWidth');sibling.value=String(options.maxWidth);sibling.dispatchEvent(new Event('input'));return;}
      if(key==='maxWidth'&&options.maxWidth<options.minWidth){options.minWidth=options.maxWidth;const sibling=element<HTMLInputElement>('minWidth');sibling.value=String(options.minWidth);sibling.dispatchEvent(new Event('input'));return;}
      if(key==='maxWidth'){
        options.continuity=Math.max(options.continuity,options.maxWidth*2);
        const continuation=element<HTMLInputElement>('continuity');continuation.min=String(options.maxWidth*2);continuation.value=String(options.continuity);
        element<HTMLOutputElement>('continuityValue').value=`${options.continuity} 格 / ${options.continuity*Number(unit.value)} m`;
      }
      update();regenerate();});
    label.append(heading,input);element('parameters').append(label);
  }
}

function updateView(){
  makeGeometry(showingOriginal?source:result.cells);
  element('original').setAttribute('aria-pressed',String(showingOriginal));
  element('original').textContent=showingOriginal?'返回结果':'查看原形';
  element('view-label').textContent=`${showingOriginal?'原形':'塑形结果'} · ${options.preset==='columnar-wall'?'柱状岩壁':'层阶崖岸'} · 种子 ${options.seed}`;
  element('stats').textContent=`${source.length.toLocaleString()} → ${result.cells.length.toLocaleString()} 体素　削去 ${result.removedCellKeys.length.toLocaleString()}　${quads.toLocaleString()} 表面片`;
  const diagnostic=result.diagnostics;
  const limited=Math.max(0,diagnostic.requested-diagnostic.applied-diagnostic.protected);
  element('diagnostic').textContent=diagnostic.blockingReasons.length?'保持原形：'+diagnostic.blockingReasons.map(reasonText).join('；'):
    (limited||diagnostic.protected?`候选 ${diagnostic.requested.toLocaleString()} · 保护保留 ${diagnostic.protected.toLocaleString()} · 厚度等限制保留 ${limited.toLocaleString()}`:'');
  draw();
  element('timing').textContent=`计算 ${timings.computeMs.toFixed(1)} ms · 网格 ${timings.meshMs.toFixed(1)} ms · 显示 ${timings.displayMs.toFixed(1)} ms`;
}
function regenerate(){const start=performance.now();result=shapeRock(source,options);timings.computeMs=performance.now()-start;updateView();}

preset.addEventListener('change',()=>{
  options={...presetSampleOptions(preset.value as RockOptions['preset']),seed:Number(seed.value),cellSize:Number(unit.value)};
  fixture.value=options.preset==='columnar-wall'?'block':'platform';
  source=createFixture(fixture.value);options.sides=[0,1,2,3];
  document.querySelectorAll<HTMLInputElement>('.side-list input').forEach(input=>input.checked=true);
  showingOriginal=false;buildParameters();regenerate();resetCamera();
});
fixture.addEventListener('change',()=>{source=createFixture(fixture.value);options.sides=fixture.value==='wall'?[3]:[0,1,2,3];document.querySelectorAll<HTMLInputElement>('.side-list input').forEach(input=>input.checked=options.sides!.includes(Number(input.value)));regenerate();resetCamera();});
seed.addEventListener('change',()=>{options.seed=Number(seed.value);regenerate();});
unit.addEventListener('change',()=>{options.cellSize=Number(unit.value);buildParameters();regenerate();});
document.querySelectorAll<HTMLInputElement>('.side-list input').forEach(input=>input.addEventListener('change',()=>{options.sides=[...document.querySelectorAll<HTMLInputElement>('.side-list input:checked')].map(input=>Number(input.value));regenerate();}));
element('original').addEventListener('click',()=>{showingOriginal=!showingOriginal;updateView();});
element('reset').addEventListener('click',resetCamera);
element('download').addEventListener('click',()=>{
  const data={schema:'xinghai-rock-prototype-1',scope:'R0–R3; Gate R-A pending; not workshop integration',fixture:fixture.value,source:{cells:source},result,options,timings};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`rock-${options.preset}-${options.seed}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

/** Read-only state for reproducible review, timing reports and external validation. */
(window as any).rockPrototype={getState:()=>({source,result,options:{...options},timings:{...timings},fixture:fixture.value,showingOriginal,visibleCellCount:showingOriginal?source.length:result.cells.length,quads})};
buildParameters();regenerate();resetCamera();
