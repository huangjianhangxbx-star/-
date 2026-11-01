const fs=require('node:fs'),path=require('node:path');
function safeWindowState(raw,displays){
 const areas=displays.map(d=>d.workArea).filter(a=>a&&[a.x,a.y,a.width,a.height].every(Number.isFinite)&&a.width>0&&a.height>0),primary=areas[0]??{x:0,y:0,width:1920,height:1080};
 const valid=raw?.version===1&&raw.bounds&&['x','y','width','height'].every(k=>Number.isFinite(raw.bounds[k]));
 const b=valid?raw.bounds:{x:primary.x+Math.max(0,(primary.width-1500)/2),y:primary.y+Math.max(0,(primary.height-940)/2),width:1500,height:940};
 const overlap=a=>Math.max(0,Math.min(b.x+b.width,a.x+a.width)-Math.max(b.x,a.x))*Math.max(0,Math.min(b.y+b.height,a.y+a.height)-Math.max(b.y,a.y));
 const area=areas.reduce((best,a)=>overlap(a)>overlap(best)?a:best,primary),width=Math.min(area.width,Math.max(1000,Math.round(b.width))),height=Math.min(area.height,Math.max(700,Math.round(b.height)));
 return {bounds:{x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,b.x))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,b.y))),width,height},maximized:valid&&raw.maximized===true};
}
function createWindowState(file){
 let raw=null;try{if(fs.statSync(file).size<65536)raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 return {restore:displays=>safeWindowState(raw,displays),bind(win){let timer;const flush=()=>{clearTimeout(timer);if(win.isDestroyed()||win.isMinimized())return;const state={version:1,bounds:win.getNormalBounds(),maximized:win.isMaximized()};try{fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(state));fs.renameSync(temp,file);}catch{}};const queue=()=>{clearTimeout(timer);timer=setTimeout(flush,150);};for(const event of ['move','resize','maximize','unmaximize'])win.on(event,queue);win.on('close',flush);return flush;}};
}
module.exports={safeWindowState,createWindowState};
