import {RESOURCE_NAMES} from './core/resource-label';
import type {Command,GameState} from './core/types';
import {sampleEventRequest,sampleEventView,querySampleEventTrigger,type EventRequest} from './core/sample-event';
/** Only dialog/input ownership lives here; offered/result state and payments live in the world. */
export class SampleEventPanel{
 private root:HTMLElement;private token:EventRequest|null=null;private key='';private previous:HTMLElement|null=null;private held=new Set<string>();
 get open(){return this.token!==null;}
 constructor(host:HTMLElement,private state:()=>GameState,private release:()=>void,private send:(c:Command)=>boolean,private notice:(s:string)=>void,private allowed:()=>boolean){
  host.insertAdjacentHTML('beforeend','<div id="sample-event-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="sample-event-title"><section class="event-window"><header><div><small>奇闻</small><h2 id="sample-event-title">异常回响</h2></div><button data-event-close aria-label="关闭奇闻">关闭 · Esc</button></header><div data-event-content></div><p data-event-feedback role="status" aria-live="polite"></p><footer>实验奇闻 · SAMPLE</footer></section></div>');this.root=host.querySelector('#sample-event-dialog')!;
  window.addEventListener('keydown',e=>{
   if(!this.open){if(this.held.has(e.code)){e.preventDefault();e.stopImmediatePropagation();}return;}
   this.held.add(e.code);e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
   if(e.key==='Escape'){this.close();return;}if(e.key==='Enter'){(document.activeElement as HTMLButtonElement)?.click();return;}
   if(['Tab','ArrowUp','ArrowDown'].includes(e.key)){const bs=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=bs.indexOf(document.activeElement as HTMLButtonElement),d=e.shiftKey||e.key==='ArrowUp'?-1:1;bs[(i+d+bs.length)%bs.length]?.focus();}
  },true);
  window.addEventListener('keyup',e=>{const captured=this.held.delete(e.code);if(this.open||captured){e.preventDefault();e.stopImmediatePropagation();}},true);
  for(const name of ['pointerdown','pointerup','contextmenu'] as const)window.addEventListener(name,e=>{if(!this.open)return;e.preventDefault();e.stopImmediatePropagation();},true);
  window.addEventListener('click',e=>{if(!this.open)return;e.preventDefault();e.stopImmediatePropagation();const b=(e.target as HTMLElement).closest<HTMLButtonElement>('#sample-event-dialog button');if(!b||b.disabled)return;
   if(b.hasAttribute('data-event-close')||b.hasAttribute('data-event-continue')){this.close();return;}
   const choice=b.dataset.eventChoice;if(!['salvage','listen'].includes(choice??'')||!this.valid()||!this.allowed())return;
   if(this.send({type:'chooseSampleEvent',...this.token!,choiceId:choice as 'salvage'|'listen'})){this.token=sampleEventRequest(this.state())!;this.render(this.state());this.root.querySelector<HTMLButtonElement>('[data-event-continue]')!.focus();}else this.root.querySelector('[data-event-feedback]')!.textContent=this.state().notice;
  },true);
  window.addEventListener('blur',()=>{this.held.clear();this.close();});
 }
 show(){const s=this.state(),r=sampleEventRequest(s);if(!this.allowed()||!r)return;const q=querySampleEventTrigger(s,r);if(!q.ok){this.notice(q.reason!);return;}this.previous=document.activeElement as HTMLElement;this.release();const fresh=sampleEventRequest(this.state())!;if(!this.send({type:'triggerSampleEvent',...fresh}))return;this.token=sampleEventRequest(this.state())!;this.root.hidden=false;this.key='';this.render(this.state());this.root.querySelector<HTMLButtonElement>('[data-event-close]')!.focus();}
 close(){if(!this.open)return;this.token=null;this.root.hidden=true;this.release();if(this.previous?.isConnected)this.previous.focus();this.previous=null;}
 private valid(){const s=this.state(),r=sampleEventRequest(s),t=this.token;return !!t&&!!r&&s.phase==='battle'&&!!s.world?.visit.active&&t.worldId===r.worldId&&t.visit===r.visit&&t.placeId===r.placeId&&t.actorId===r.actorId&&t.controlRevision===r.controlRevision&&t.expectedRevision===r.expectedRevision;}
 render(s:GameState){if(!this.open)return;if(!this.valid()){this.close();return;}const e=sampleEventView(s)!;const key=e.status+e.choiceId;if(key===this.key)return;this.key=key;this.root.querySelector('[data-event-feedback]')!.textContent='';
  this.root.querySelector('[data-event-content]')!.innerHTML=e.status==='resolved'?`<p class="event-speaker">回响</p><p class="event-narration">${e.choiceId==='salvage'?'你轻轻掀开铁匣。一瓶仍完好的药剂藏在残破的绒布中。':'你回应了石壁中的低语。声音渐渐散去，一缕微光落入掌心。'}</p><p data-event-result>${e.choiceId==='salvage'?'团队实验缓回药 +1':`随身${RESOURCE_NAMES.vitality} +10`}</p><button data-event-continue>继续探索</button>`:`<p class="event-speaker">回响</p><p class="event-narration">${e.narration}</p><div class="event-choices"><button data-event-choice="salvage"><span>打开铁匣，寻找补给</span><small>团队实验缓回药 ×1</small></button><button data-event-choice="listen"><span>回应神秘的低语</span><small>随身${RESOURCE_NAMES.vitality} +10</small></button></div>`;
 }
}
