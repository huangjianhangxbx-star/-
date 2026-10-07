import {resolve} from 'node:path';
import {createReadStream,existsSync} from 'node:fs';
import type {Plugin} from 'vite';
const files=new Set(['blue/unit.json','blue/unit.atlas','blue/小蓝.png','zombie/unit.json','zombie/unit.atlas','zombie/僵尸1.png','vendor/spine-webgl-4.1.56.js','vendor/LICENSE','audio/release.wav','audio/hit.wav','audio/hurt.wav']);
export function assetPath(url:string,remote:string|undefined):string|null {
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote??''))return null;
 let name:string;try{name=decodeURIComponent(url.slice('/__al01-assets/'.length));}catch{return null;}
 if(!url.startsWith('/__al01-assets/')||!files.has(name))return null;
 return resolve(import.meta.dirname,'../work/AL-01/assets',name);
}
export function actionLabAssets():Plugin {return {name:'al01-local-evaluation-assets',apply:'serve',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(!req.url?.startsWith('/__al01-assets/'))return next();const path=assetPath(req.url,req.socket.remoteAddress);
 if(!path||!existsSync(path)){res.statusCode=404;res.end('Local evaluation resource unavailable');return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.json')?'application/json':path.endsWith('.png')?'image/png':path.endsWith('.wav')?'audio/wav':'text/plain');
 createReadStream(path).on('error',()=>res.destroy()).pipe(res);
 });}};}
