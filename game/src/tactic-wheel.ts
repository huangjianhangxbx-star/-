import type {GameState,Pos,Unit} from './core/types';
import {focusCandidate,focusTargetLegal,queryPartyTactic,type PartyTacticKind,type PartyTacticRequest} from './core/party-tactics';
import {isPartyBody,isStandaloneExploration} from './core/exploration-party';

export type WheelSession=PartyTacticRequest&{center:Pos;origin:Pos;radius:number;selected?:PartyTacticKind};
const labels:Record<PartyTacticKind,string>={rally:'集合',focus:'集火我的目标',cautious:'保守',free:'自由行动'};
/** Presentation owns a temporary request; accepted tactics live solely in the core. */
export class TacticWheel{
 session?:WheelSession;held=false;private serial=0;
 readonly element:HTMLElement;
 readonly status:HTMLElement;
 readonly marker:HTMLElement;
 constructor(host:HTMLElement){this.element=document.createElement('div');this.element.id='tactic-wheel';this.element.hidden=true;this.element.setAttribute('role','group');this.element.setAttribute('aria-label','战术指令轮盘');
 this.element.innerHTML='<div class="wheel-ring"></div>'+(['rally','focus','cautious','free'] as PartyTacticKind[]).map(k=>'<div class="wheel-sector '+k+'" data-tactic="'+k+'"><b>'+labels[k]+'</b><small>'+({rally:'靠近当前主控',focus:'锁定打开时的目标',cautious:'稳健贡献',free:'恢复原有 AI'}[k])+'</small></div>').join('')+'<div class="wheel-center"><span class="wheel-recipient"></span><small class="wheel-target"></small><kbd>松开 G 下令</kbd></div>';
 host.append(this.element);this.status=document.createElement('div');this.status.id='tactic-status';this.status.setAttribute('aria-live','polite');host.append(this.status);this.marker=document.createElement('div');this.marker.id='tactic-target-marker';this.marker.hidden=true;host.append(this.marker);}
 get scale(){return this.session?.1:1;}
 open(s:GameState,cursor:Pos,viewport:Pos,hoverId?:string):boolean{
 if(this.held)return false;this.held=true;
 const issuer=s.units.find(u=>u.id===s.controlledBodyId),recipient=s.units.find(u=>u.id!==issuer?.id&&isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident);
 if(!issuer||!recipient)return false;
 const request:PartyTacticRequest={issuerId:issuer.id,recipientId:recipient.id,kind:'free',requestId:++this.serial,expectedControlRevision:s.controlRevision??0,targetId:focusCandidate(s,hoverId)};
 if(!queryPartyTactic(s,request).ok)return false;
 const radius=Math.min(130,Math.max(55,(Math.min(viewport.x,viewport.y)-24)/2)),center={x:Math.max(radius+12,Math.min(viewport.x-radius-12,cursor.x)),y:Math.max(radius+12,Math.min(viewport.y-radius-12,cursor.y))};
 this.session={...request,center,origin:{...cursor},radius};this.element.style.cssText=`left:${center.x-radius}px;top:${center.y-radius}px;width:${radius*2}px;height:${radius*2}px`;this.element.hidden=false;
 this.element.querySelector('.wheel-recipient')!.textContent=recipient.name;this.element.querySelector('.wheel-target')!.textContent=request.targetId?'目标 · '+s.units.find(e=>e.id===request.targetId)!.name:'没有可用集火目标';this.refreshSelection();return true;
 }
 move(p:Pos){const t=this.session;if(!t||Math.hypot(p.x-t.origin.x,p.y-t.origin.y)<2)return;
 const x=p.x-t.center.x,y=p.y-t.center.y;if(Math.hypot(x,y)<=Math.min(30,t.radius*.25)){t.selected=undefined;}else{const kind:PartyTacticKind=Math.abs(x)>Math.abs(y)?x>0?'focus':'free':y>0?'cautious':'rally';t.selected=kind==='focus'&&!t.targetId?undefined:kind;}this.refreshSelection();}
 private refreshSelection(){this.element.querySelector('.focus small')!.textContent=this.session?.targetId?'锁定指定目标':'无有效目标';for(const e of this.element.querySelectorAll<HTMLElement>('[data-tactic]')){e.classList.toggle('selected',e.dataset.tactic===this.session?.selected);e.classList.toggle('unavailable',e.dataset.tactic==='focus'&&!this.session?.targetId);e.setAttribute('aria-disabled',String(e.dataset.tactic==='focus'&&!this.session?.targetId));}}
 release():PartyTacticRequest|undefined{const t=this.session;this.held=false;this.cancel();return t?.selected?{issuerId:t.issuerId,recipientId:t.recipientId,kind:t.selected,targetId:t.targetId,requestId:t.requestId,expectedControlRevision:t.expectedControlRevision}:undefined;}
 cancel(){this.session=undefined;this.element.hidden=true;}
 valid(s:GameState){return !this.session||queryPartyTactic(s,{...this.session,kind:'free'}).ok;}
 render(s:GameState,project:(p:Pos)=>Pos){const recipient=s.units.find(u=>u.id!==s.controlledBodyId&&isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident);const t=recipient&&s.partyTactics?.[recipient.id];this.status.hidden=!isStandaloneExploration(s)||!recipient||s.phase!=='battle';const ordered=recipient&&s.explorationControl?.moveOrders?.[recipient.id];this.status.textContent=recipient?recipient.name+' · '+(t?labels[t.kind]+' / '+({active:'执行中','pending-body':'待动作结束',blocked:'路径受阻'}[t.execution])+(t.reason?' · '+t.reason:''):'自由行动')+(ordered?' · 先完成移动订单':'')+'　G 战术':'';
 const targetId=this.session?.targetId||(t?.kind==='focus'?t.targetId:undefined),target=s.units.find(e=>e.id===targetId);this.marker.hidden=!target||!focusTargetLegal(s,targetId);if(!this.marker.hidden){const p=project(target!.drawPos||target!.pos);this.marker.style.left=p.x+'px';this.marker.style.top=(p.y-32)+'px';this.marker.textContent='⌖ '+target!.name;}}
}
