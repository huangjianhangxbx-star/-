const http=require('http'), fs=require('fs'), path=require('path');
const {chromium}=require('E:/WORLDCREATOR/XingHaiHuiLang/Origin/game/node_modules/@playwright/test');
const root=path.resolve(__dirname,'..');
const three='E:/WORLDCREATOR/XingHaiHuiLang/Origin/game/node_modules/three';
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#202930;color:white;font:16px sans-serif}header{padding:16px}canvas{display:block}</style><header>体块工作台 · 独立 Three.js 导出检查</header><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three'; import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1100,650);document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x202930);const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xcde6ff,0x413725,2));const light=new THREE.DirectionalLight(0xffecd4,3);light.position.set(3,6,4);scene.add(light);
const camera=new THREE.PerspectiveCamera(40,1100/650,.01,1000);const file=new URLSearchParams(location.search).get('file');
new GLTFLoader().load('/artifacts/'+file,g=>{scene.add(g.scene);const box=new THREE.Box3().setFromObject(g.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const distance=Math.max(...size.toArray())*2.2;camera.position.copy(center).add(new THREE.Vector3(distance*.6,distance*.6,distance));camera.lookAt(center);renderer.render(scene,camera);let meshes=0,triangles=0,materials=[];g.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push({color:m.color.toArray(),texture:!!m.map,minFilter:m.map?.minFilter,magFilter:m.map?.magFilter})}});window.result={meshes,triangles,size:size.toArray(),materials};},undefined,e=>{window.failure=String(e)});
</script>`;
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;
if(p==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
let base=p.startsWith('/three/')?three:root;let relative=p.startsWith('/three/')?p.slice(7):p.slice(1);
let target=path.resolve(base,relative);if(!target.startsWith(path.resolve(base)+path.sep)){res.writeHead(403);res.end();return;}
try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:720}}),results={};
for(const mode of ['material','palette']){await page.goto('http://127.0.0.1:'+server.address().port+'/?file=wall/example.wall.'+mode+'.glb');await page.waitForFunction(()=>window.result||window.failure);results[mode]=await page.evaluate(()=>window.result||window.failure);if(typeof results[mode]==='string')throw Error(results[mode]);await page.screenshot({path:path.join(root,'artifacts','wall','three-'+mode+'.png')});}
fs.writeFileSync(path.join(root,'artifacts','wall','three-validation.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
