import {gameRoute} from './core/game-session';
import './style.css';
const route=gameRoute(location.search),app=document.querySelector<HTMLElement>('#app')!;
if(route.retired){
 app.innerHTML='<section class="exploration-ended"><h2>旧塔防入口已退休</h2><p>卡牌、影庭与旧节点入口已退场。正式暗牢与独立动作验证仍可使用。</p><a href="/">进入正式探索</a> · <a href="/action-lab.html">Action Lab</a></section>';
}else{
 void import('./exploration-app').catch(error=>{const banner=document.createElement('div');banner.className='error-banner';banner.textContent='场景启动失败：'+String(error);app.append(banner);});
}
