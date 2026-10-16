import {gameRoute} from './core/game-session';
import {TitleScreen} from './title-screen';
import './style.css';
const route=gameRoute(location.search),app=document.querySelector<HTMLElement>('#app')!;
const debugPage=new URLSearchParams(location.search).get('debugStart')==='1';
let runtime:typeof import('./exploration-app')|undefined;
let loading:Promise<typeof import('./exploration-app')>|undefined;
const load=()=>loading??=(import('./exploration-app').then(value=>runtime=value));
if(route.retired){
 app.innerHTML='<section class="exploration-ended"><h2>旧塔防入口已退休</h2><p>卡牌、影庭与旧节点入口已退场。正式暗牢与独立动作验证仍可使用。</p><a href="/">进入正式探索</a> · <a href="/action-lab.html">Action Lab</a></section>';
}else if(debugPage||route.developer){
 void load().catch(error=>{const banner=document.createElement('div');banner.className='error-banner';banner.textContent='场景启动失败：'+String(error);app.append(banner);});
 if(debugPage)window.addEventListener('keydown',e=>{if(e.code!=='F10')return;e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(window.parent!==window)window.parent.postMessage({type:'title-close-debug'},location.origin);else{const url=new URL(location.href);url.searchParams.delete('debugStart');location.replace(url.href);}},true);
}else{
 const title=new TitleScreen(async()=>{const game=await load();if(!game.startFromTitle())throw new Error('当前世界暂时无法进入');});
 let debug:HTMLElement|null=null,resume:(()=>void)|undefined;
 const closeDebug=()=>{if(!debug)return;debug.remove();debug=null;resume?.();resume=undefined;window.focus();};
 const toggleDebug=()=>{
  if(debug){closeDebug();return;}
  if(title.element.hasAttribute('aria-busy'))return;
  resume=runtime?.suspendForTitleDebug();
  debug=document.createElement('section');debug.className='title-debug-overlay';debug.setAttribute('aria-label','原型调试入口');
  debug.innerHTML='<header><span>F10 原型调试 · 独立会话，关闭后返回</span><button>返回 · F10</button></header><iframe data-title-debug title="旧世界配置与调试入口"></iframe>';
  const url=new URL(location.href);url.searchParams.set('debugStart','1');debug.querySelector('iframe')!.src=url.href;
  debug.querySelector('button')!.onclick=closeDebug;document.body.append(debug);
 };
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===debug?.querySelector('iframe')?.contentWindow&&e.data?.type==='title-close-debug')closeDebug();});
 window.addEventListener('keydown',e=>{if(e.code==='F10'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleDebug();return;}if(debug){e.stopImmediatePropagation();return;}title.handleKey(e);},true);
}
