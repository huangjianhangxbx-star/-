import {gameRoute} from './core/game-session';
import {TitleScreen} from './title-screen';
import {gameAudio} from './game-audio';
import {AudioMonitor} from './game-audio/monitor';
import './style.css';
import {mountHomeDiagnostics} from './view/scene2d/home-diagnostics';
const route=gameRoute(location.search),app=document.querySelector<HTMLElement>('#app')!;
const debugPage=new URLSearchParams(location.search).get('debugStart')==='1';
const sound=gameAudio();if(debugPage)sound.setSessionSilent(true);
let runtime:typeof import('./exploration-app')|undefined;
let loading:Promise<typeof import('./exploration-app')>|undefined;
const load=()=>loading??=(import('./exploration-app').then(value=>runtime=value));
if(route.retired){
 app.innerHTML='<section class="exploration-ended"><h2>旧塔防入口已退休</h2><p>卡牌、影庭与旧节点入口已退场。正式暗牢与独立动作验证仍可使用。</p><a href="/">进入正式探索</a> · <a href="/action-lab.html">Action Lab</a></section>';
}else if(debugPage||route.developer){
 void load().catch(error=>{const banner=document.createElement('div');banner.className='error-banner';banner.textContent='场景启动失败：'+String(error);app.append(banner);});
 if(debugPage)window.addEventListener('keydown',e=>{if(e.code!=='F10')return;e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(window.parent!==window)window.parent.postMessage({type:'title-close-debug'},location.origin);else{const url=new URL(location.href);url.searchParams.delete('debugStart');location.replace(url.href);}},true);
}else{
 const title=new TitleScreen(async()=>{const game=await load();if(!await game.startFromTitle())throw new Error('当前世界暂时无法进入');},()=>{void sound.unlockFromGesture().catch(()=>{});});
 let debug:HTMLElement|null=null,monitor:AudioMonitor|null=null,resume:(()=>void)|undefined,closeSpatial:(()=>void)|undefined;
 const closeDebug=()=>{if(!debug)return;closeSpatial?.();closeSpatial=undefined;monitor?.dispose();monitor=null;debug.remove();debug=null;resume?.();resume=undefined;window.focus();};
 const toggleDebug=()=>{
  if(debug){closeDebug();return;}
  if(title.element.hasAttribute('aria-busy'))return;
  debug=document.createElement('div');debug.className='audio-monitor-shell';debug.innerHTML='<button data-old-debug style="position:fixed;right:7vw;bottom:5vh;z-index:11003">进入旧独立调试会话</button>';document.body.append(debug);
  const h=(window as any).prototype?.home;if(h){const info=document.createElement('pre');info.dataset.homeDiagnostic='';info.style.cssText='position:fixed;left:6vw;bottom:4vh;z-index:11004;background:#071015;color:#d6e8e9;padding:12px;max-width:36vw;max-height:42vh;overflow:auto;pointer-events:auto';const refreshHome=()=>info.textContent='NPC-HOME-02 · 只读快照 / stand-placeholder\n'+JSON.stringify((window as any).prototype?.home,null,2);refreshHome();debug.append(info);
    const phase=document.createElement('label');phase.style.cssText='position:fixed;left:6vw;bottom:49vh;z-index:11005;background:#071015;color:#d6e8e9;padding:8px';phase.textContent='原型日相位（仅本会话） ';
    const select=document.createElement('select');select.dataset.homePhase='';for(const value of ['morning','daytime','evening','night']){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}select.value=h.activity?.schedule?.phase??'daytime';select.onchange=()=>{(window as any).prototype.setHomeSchedulePhase(select.value);refreshHome();};phase.append(select);debug.append(phase);}
  monitor=new AudioMonitor(sound);monitor.mount();monitor.onClose(closeDebug);
  const game=(window as any).prototype;if(game?.state?.exploration?.definition?.sceneLayout){const b=document.createElement('button');b.textContent='家园空间诊断 · 只读';b.dataset.homeSpatialOpen='';b.style.cssText='position:fixed;right:7vw;bottom:10vh;z-index:11005';debug.append(b);b.onclick=()=>{monitor!.element.hidden=true;debug!.hidden=true;const restore=()=>{closeSpatial?.();closeSpatial=undefined;if(monitor)monitor.element.hidden=false;if(debug)debug.hidden=false;};closeSpatial=mountHomeDiagnostics(game.state,(p)=>game.project(p),restore);};}
  debug.querySelector<HTMLButtonElement>('[data-old-debug]')!.onclick=()=>{monitor?.dispose();monitor=null;resume=runtime?.suspendForTitleDebug();debug!.innerHTML='<section class="title-debug-overlay"><header><span>F10 原型调试 · 独立静音会话</span><button>返回 · F10</button></header><iframe data-title-debug title="旧世界配置与调试入口"></iframe></section>';const url=new URL(location.href);url.searchParams.set('debugStart','1');url.searchParams.set('scene2d','1');debug!.querySelector('iframe')!.src=url.href;debug!.querySelector('button')!.addEventListener('click',closeDebug);};
 };
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===debug?.querySelector('iframe')?.contentWindow&&e.data?.type==='title-close-debug')closeDebug();});
 window.addEventListener('keydown',e=>{if(e.code==='F10'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleDebug();return;}if(debug){e.stopImmediatePropagation();return;}title.handleKey(e);},true);
}
