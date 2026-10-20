import {Vector3} from 'three';
import type {MapView} from './view.ts';

/** Model coordinates are X right, Y forward, Z up; render coordinates are X, Z, -Y. */
export function attachAxisNavigation(view:MapView,beforeSelect:()=>void){
 const host=document.createElement('div');host.className='ortho-nav';host.id='ortho-nav';
 host.setAttribute('role','group');host.setAttribute('aria-label','三轴正交视角');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 112 112');host.append(svg);
 const definitions=[
  ['right','left','X',1,0,0,'#ed6578'],['left','right','',-1,0,0,'#ed6578'],
  ['back','front','Y',0,0,-1,'#97cc43'],['front','back','',0,0,1,'#97cc43'],
  ['top','bottom','Z',0,1,0,'#549ee9'],['bottom','top','',0,-1,0,'#549ee9'],
 ] as const;
 const items=definitions.map(([axis,opposite,label,x,y,z,color])=>{
  const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1','56');line.setAttribute('y1','56');line.setAttribute('stroke',color);svg.append(line);
  const button=document.createElement('button');button.type='button';button.dataset.ortho=axis;
  button.style.setProperty('--axis-color',color);button.dataset.positive=String(!!label);
  const names={right:'右',left:'左',back:'后',front:'前',top:'上',bottom:'下'};
  button.title=`${names[axis]}方正交视角；再次点击切到对面`;button.setAttribute('aria-label',button.title);
  button.onclick=()=>{beforeSelect();view.orthographicAxis(view.host.dataset.viewAxis===axis?opposite:axis);};
  host.append(button);return {axis,label,line,button,vector:new Vector3(x,y,z)};
 });
 const update=()=>{
  const inverse=view.camera.quaternion.clone().invert();
  for(const item of items){
   const p=item.vector.clone().applyQuaternion(inverse),x=56+p.x*36,y=56-p.y*36;
   item.button.style.left=`${x}px`;item.button.style.top=`${y}px`;
   item.button.style.zIndex=String(10+Math.round((p.z+1)*10));
   item.button.style.opacity=p.z<-.01?'.55':'1';
   item.button.textContent=item.label||(p.z>.98?`−${item.axis==='left'?'X':item.axis==='front'?'Y':'Z'}`:'');
   item.button.setAttribute('aria-pressed',String(view.host.dataset.viewAxis===item.axis));
   item.line.setAttribute('x2',String(x));item.line.setAttribute('y2',String(y));
   item.line.setAttribute('opacity',p.z<0?'.35':'.85');
  }
 };
 view.host.parentElement!.append(host);view.controls.addEventListener('change',update);update();
 return ()=>{view.controls.removeEventListener('change',update);host.remove();};
}
