import {referenceOpacity,type PngReference} from '../core/references.ts';
/** Drag previews stay outside document history; release commits one value. */
export function referenceOpacityControl(reference:PngReference,options:{scene?:boolean;disabled?:boolean;preview:(opacity:number)=>void;commit:(opacity:number)=>void}){
 const label=document.createElement('label');label.className='reference-opacity-control';label.append('透明度');
 const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round(referenceOpacity(reference)*100));slider.disabled=!!options.disabled;slider.setAttribute('aria-label',`参考透明度 ${reference.name}`);
 const value=document.createElement('output');value.value=slider.value+'%';
 if(options.scene){slider.dataset.sceneReferenceOpacity=reference.id;value.dataset.sceneReferenceOpacityValue=reference.id;}else{slider.dataset.referenceOpacity=reference.id;value.dataset.referenceOpacityValue=reference.id;}
 slider.oninput=()=>{value.value=slider.value+'%';options.preview(Number(slider.value)/100);};
 slider.onchange=()=>{const opacity=Number(slider.value)/100;if(opacity!==referenceOpacity(reference))options.commit(opacity);else options.preview(opacity);};
 slider.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();slider.value=String(Math.round(referenceOpacity(reference)*100));value.value=slider.value+'%';options.preview(referenceOpacity(reference));}};
 label.append(slider,value);return label;
}
