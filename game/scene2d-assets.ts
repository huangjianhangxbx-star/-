import {resolve} from 'node:path';
import {createReadStream,existsSync} from 'node:fs';
import type {Plugin} from 'vite';
export function scene2DAssetPath(url:string,remote?:string){if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote??''))return null;let name:string;try{name=decodeURIComponent(url.slice('/__scene2d-assets/'.length));}catch{return null;}
 if(!url.startsWith('/__scene2d-assets/')||!(/^(manifest\.json|ground\/[123]\.png|wall\/([1-9]|[1-3][0-9]|4[0-7])\.png)$/.test(name)))return null;return resolve(import.meta.dirname,'../work/SCENE-2D-01/assets',name);}
export function scene2DAssets():Plugin{return {name:'scene2d-local-whitelist',apply:'serve',configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__scene2d-assets/'))return next();const path=scene2DAssetPath(req.url,req.socket.remoteAddress);if(!path||!existsSync(path)){res.statusCode=404;res.end('本机指定场景素材不可用');return;}res.setHeader('Content-Type',path.endsWith('.png')?'image/png':'application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');createReadStream(path).on('error',()=>res.destroy()).pipe(res);});}};}
