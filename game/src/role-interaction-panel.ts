import type {GameState,Pos} from './core/types';
import {ROLE_ACTIONS,nearbyRole,roleAccess,roleProfile,roleSession,validRoleSession,type RoleAction} from './core/role-interaction';
import {cancelMoveOrder} from './core/move-order';
import {clearMotion} from './core/personal';
import './role-interaction.css';

const icons:Record<RoleAction,string>={shop:'M3 10h18L19 4H5z M5 11v10h14V11 M9 21v-7h6v7',dialogue:'M3 4h18v13H9l-5 4v-4H3z M7 8h10 M7 12h7',gift:'M3 10h18v4H3z M5 14v7h14v-7 M12 10v11 M12 10C2 9 5 0 12 10C22 9 19 0 12 10',equipment:'M8 3l4 3 4-3 6 5-4 5-2-2v10H8V11l-2 2-4-5z'};
export class RoleInteractionPanel{
 private root:HTMLElement;private menu:HTMLElement;private prompt:HTMLButtonElement;private switchHint:HTMLButtonElement;
 private session:ReturnType<typeof roleSession>|null=null;
 get open(){return this.session!==null;}
 constructor(host:HTMLElement,private state:()=>GameState,private release:()=>void,private allowed:()=>boolean,private shop:(id:string)=>void,private switchBody:()=>void,private dialogue:(id:string)=>void){
  this.root=document.createElement('div');this.root.className='role-interactions';
  this.root.innerHTML=`<button data-role-prompt hidden><kbd>F</kbd><span></span></button><button data-role-switch hidden><kbd>Z</kbd>切换</button><section data-role-menu hidden aria-label="角色交互"><svg class="role-arc" viewBox="0 0 220 300" aria-hidden="true"><path d="M208 8 C12 32 12 268 208 292 L199 245 C84 224 84 76 199 55 Z"/></svg><h3 data-role-name></h3>${ROLE_ACTIONS.map(a=>`<button data-role-action="${a.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[a.id]}"/></svg><span>${a.label}</span></button>`).join('')}<p data-role-message role="status"></p></section>`;
  host.append(this.root);this.menu=this.root.querySelector('[data-role-menu]')!;this.prompt=this.root.querySelector('[data-role-prompt]')!;this.switchHint=this.root.querySelector('[data-role-switch]')!;
  this.prompt.addEventListener('click',()=>this.interact());this.switchHint.addEventListener('click',()=>this.switchBody());
  this.root.addEventListener('pointerdown',e=>e.stopPropagation());
  this.root.addEventListener('click',e=>{e.stopPropagation();const action=(e.target as HTMLElement).closest<HTMLElement>('[data-role-action]')?.dataset.roleAction as RoleAction|undefined;if(action)this.act(action);});
  window.addEventListener('pointerdown',e=>{if(this.open&&!this.root.contains(e.target as Node)){this.close();e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('keydown',e=>{if(!this.open)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape')this.close();},true);
  window.addEventListener('blur',()=>this.close());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.close();});
 }
 interact(){const target=nearbyRole(this.state());return !!target&&this.openTarget(target.id);}
 openTarget(id:string){const s=this.state();if(!this.allowed()||!roleAccess(s,id))return false;this.release();const actor=s.units.find(u=>u.id===s.controlledBodyId)!;cancelMoveOrder(s,actor,'role-interaction');clearMotion(actor,s,'role-interaction');this.session=roleSession(s,id);this.menu.hidden=false;this.prompt.hidden=true;this.switchHint.hidden=true;const target=s.units.find(u=>u.id===id)!,profile=roleProfile(s,target)!;this.menu.querySelector('[data-role-name]')!.textContent=target.name;this.menu.querySelector('[data-role-message]')!.textContent='';for(const b of this.menu.querySelectorAll<HTMLButtonElement>('[data-role-action]')){b.disabled=!profile.actions.includes(b.dataset.roleAction as RoleAction);b.title=b.disabled?'暂未开放':'';}return true;}
 close(){if(!this.open)return;this.session=null;this.menu.hidden=true;this.release();}
 private act(action:RoleAction){const s=this.state(),session=this.session;if(!session||!validRoleSession(s,session)){this.close();return;}const target=s.units.find(u=>u.id===session.target)!;if(!roleProfile(s,target)?.actions.includes(action))return;if(action==='dialogue'){this.close();this.dialogue(target.id);return;}if(action==='shop'){this.close();this.shop(target.id);return;}this.menu.querySelector('[data-role-message]')!.textContent=ROLE_ACTIONS.find(a=>a.id===action)!.label+' · 后续开放';}
 validate(){if(this.session&&!validRoleSession(this.state(),this.session))this.close();}
 update(project:(p:Pos)=>Pos){const s=this.state();this.validate();
  const target=this.session?s.units.find(u=>u.id===this.session!.target):this.allowed()?nearbyRole(s):undefined;
  this.prompt.hidden=this.open||!target;
  if(target){const p=project(target.pos);this.prompt.querySelector('span')!.textContent=target.name+' · 交互';this.place(this.prompt,p.x+36,p.y-14,180,36);if(this.open){const right=p.x<240;this.menu.dataset.side=right?'right':'left';this.place(this.menu,right?p.x+32:p.x-232,p.y-162,220,320);const label=this.menu.querySelector<HTMLElement>('[data-role-name]')!;label.style.left=p.x-Number.parseFloat(this.menu.style.left)-35+'px';label.style.top=p.y-Number.parseFloat(this.menu.style.top)-87+'px';}}
  const actor=s.units.find(u=>u.id===s.controlledBodyId);this.switchHint.hidden=this.open||!this.allowed()||!actor||!roleProfile(s,actor)||!!actor.npc||actor.life!=='active';if(!this.switchHint.hidden&&actor){const p=project(actor.pos);this.switchHint.hidden=p.x<0||p.x>innerWidth||p.y<0||p.y>innerHeight;if(!this.switchHint.hidden)this.place(this.switchHint,p.x+35,p.y+26,104,36);}
 }
 private place(el:HTMLElement,x:number,y:number,width:number,height:number){el.style.left=Math.max(8,Math.min(innerWidth-width-8,x))+'px';el.style.top=Math.max(8,Math.min(innerHeight-height-8,y))+'px';}
}
