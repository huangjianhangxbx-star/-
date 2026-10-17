import {bindHomeJoinGuard,homeJoinRequest,joinHomeParty,queryHomeJoin} from './core/home-resident';
import type {GameState} from './core/types';
/** Only presents a domain request. Existing world, control and modal owners retain authority. */
export class HomePartyPanel{
 readonly button=document.createElement('button');
 constructor(host:HTMLElement,private state:()=>GameState,private blocked:()=>boolean){
  this.button.dataset.homeParty='';this.button.hidden=true;this.button.style.cssText='position:fixed;right:24px;z-index:18;width:154px;height:46px;background:#071015ee;color:#d6e8e9;border:1px solid #8fb0b8;border-radius:2px;font:16px "Microsoft YaHei";pointer-events:auto';host.append(this.button);
  this.button.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();});
  this.button.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();if(this.blocked())return;const s=this.state(),q=joinHomeParty(s,homeJoinRequest(s));if(!q.ok)s.notice=q.reason!;this.render();});
 }
 render(){const s=this.state(),h=s.world?.homeResident,b=this.button;bindHomeJoinGuard(s,this.blocked);b.hidden=!h||s.phase!=='battle';if(!h||b.hidden)return;const q=queryHomeJoin(s);b.textContent=h.mode==='party'?'已组队':s.world!.visit.placeId===h.home?'组队':'回家后可组队';b.disabled=h.mode==='party'||this.blocked()||!q.ok;b.title=h.mode==='party'?'芙蕾茜娅已随队':q.reason??'邀请芙蕾茜娅同行';b.style.opacity=b.disabled?'.65':'1';
  const hints=document.querySelector('.action-hints')?.getBoundingClientRect(),skills=document.getElementById('skill-cluster')?.getBoundingClientRect();const top=Math.min(hints?.top??innerHeight-260,skills?.top??innerHeight-260);b.style.top=Math.max(100,top-58)+'px';
 }
}
