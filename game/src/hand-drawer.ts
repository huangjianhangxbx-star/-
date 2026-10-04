/** Presentation only: opening the hand never changes the camera or simulation speed. */
export class HandDrawer{
 private pinned=false;private until=0;private hovered=false;
 private panel:HTMLElement;private button:HTMLButtonElement;
 constructor(host:HTMLElement){
  this.panel=host.querySelector('.cards-section')!;this.panel.id='tactical-hand';
  host.insertAdjacentHTML('beforeend','<button id="hand-toggle" aria-controls="tactical-hand" aria-expanded="false">战术手牌 <kbd>Tab</kbd></button><div id="hand-edge" aria-hidden="true"></div>');
  this.button=host.querySelector('#hand-toggle')!;this.button.addEventListener('click',()=>this.toggle());
  for(const el of [this.panel,this.button,host.querySelector<HTMLElement>('#hand-edge')!]){el.addEventListener('pointerenter',()=>{this.hovered=true;});el.addEventListener('pointerleave',()=>{this.hovered=false;this.until=performance.now()+300;});}
 }
 toggle(){this.pinned=!this.pinned;this.hovered=false;this.until=0;}
 update(active:boolean,locked:boolean){const open=active&&(this.pinned||this.hovered||performance.now()<this.until||locked);this.panel.classList.toggle('hand-open',open);this.panel.inert=!open;this.panel.setAttribute('aria-hidden',String(!open));this.button.hidden=!active;this.button.setAttribute('aria-expanded',String(open));this.button.classList.toggle('pinned',this.pinned);if(!active){this.pinned=false;this.hovered=false;this.until=0;}}
}
