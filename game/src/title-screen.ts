import './title-screen.css';
/** Owns only the pre-game view; world state remains in the runtime. */
export class TitleScreen {
 readonly element=document.createElement('section');
 private menu=false;
 private loading=false;
 constructor(private start:()=>Promise<void>){
  this.element.className='title-screen';this.element.dataset.titleScreen='';this.element.setAttribute('aria-label','星骸回廊 标题画面');
  this.element.innerHTML=`<img class="title-logo" src="/title/title-logo.svg" alt="星骸回廊"><button class="title-prompt">点击屏幕开始</button><nav class="title-menu" aria-label="主菜单" hidden><button data-title-start aria-label="开始游戏">开始游戏</button><button disabled aria-label="读取游戏">读取游戏<small>暂未开放</small></button><button disabled aria-label="画廊">画廊<small>暂未开放</small></button></nav><p class="title-status" role="status"></p><footer>星骸回廊 · 原型版本</footer><span class="title-debug-hint">F10 · 调试入口</span>`;
  document.body.append(this.element);
  this.element.addEventListener('click',()=>{if(!this.menu&&!this.loading)this.setMenu(true);});
  this.element.querySelector<HTMLButtonElement>('[data-title-start]')!.addEventListener('click',e=>{e.stopPropagation();void this.begin();});
 }
 get visible(){return !this.element.hidden;}
 handleKey(e:KeyboardEvent){
  if(!this.visible||e.ctrlKey||e.metaKey||e.altKey||!['Escape','Enter','Space','ArrowUp','ArrowDown'].includes(e.code))return false;
  if(!e.repeat&&!this.loading){
   if(e.code==='Escape')this.setMenu(false);
   if(['Enter','Space'].includes(e.code)){if(this.menu)void this.begin();else this.setMenu(true);}
   if(['ArrowUp','ArrowDown'].includes(e.code)&&this.menu)this.element.querySelector<HTMLButtonElement>('[data-title-start]')!.focus();
  }
  e.preventDefault();e.stopImmediatePropagation();return true;
 }
 private setMenu(value:boolean){this.menu=value;this.element.classList.toggle('is-menu',value);this.element.querySelector<HTMLElement>('.title-menu')!.hidden=!value;this.element.querySelector<HTMLElement>('.title-prompt')!.hidden=value;if(value)this.element.querySelector<HTMLButtonElement>('[data-title-start]')!.focus();else this.element.querySelector<HTMLButtonElement>('.title-prompt')!.focus();}
 private async begin(){
  if(this.loading)return;this.loading=true;this.element.setAttribute('aria-busy','true');
  const status=this.element.querySelector<HTMLElement>('.title-status')!;status.textContent='正在进入回廊…';
  try{await this.start();this.element.hidden=true;}catch(error){status.textContent='启动失败，请刷新重试：'+String(error);}finally{this.loading=false;this.element.removeAttribute('aria-busy');}
 }
}
