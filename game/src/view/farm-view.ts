import * as THREE from 'three';
import type {GameState,Pos} from '../core/types';
import {farmView,farmAt,queryFarmAction} from '../core/farming';
import {positionVisible} from '../core/visibility';

/** Two reusable, depth-tested world markers. Presentation never changes plots or stock. */
export class FarmView {
 readonly group=new THREE.Group();
 private rows=new Map<string,{root:THREE.Group;soil:THREE.Mesh;plant:THREE.Group;label:THREE.Sprite;canvas:HTMLCanvasElement;texture:THREE.CanvasTexture;key:string}>();
 private worldId='';
 update(s:GameState,hover:Pos|null,world:(p:Pos,alt:number)=>THREE.Vector3){
  if(this.worldId!==(s.world?.id??'')){this.dispose();this.worldId=s.world?.id??'';}
  const views=farmView(s);this.group.visible=views.length>0;
  for(const f of views){
   let row=this.rows.get(f.id);if(!row){const root=new THREE.Group(),soil=new THREE.Mesh(new THREE.BoxGeometry(.84,.035,.84),new THREE.MeshBasicMaterial({color:0x493d2c}));root.add(soil);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(soil.geometry),new THREE.LineBasicMaterial({color:0xa18b61}));root.add(edge);
    for(const z of [-.24,0,.24]){const furrow=new THREE.Mesh(new THREE.BoxGeometry(.68,.016,.032),new THREE.MeshBasicMaterial({color:0x211f1a}));furrow.position.set(0,.024,z);root.add(furrow);}
    const plant=new THREE.Group();for(const x of [-.23,.23])for(const z of [-.2,.2]){const stem=new THREE.Mesh(new THREE.BoxGeometry(.045,.3,.045),new THREE.MeshBasicMaterial({color:0x92a56d}));stem.position.set(x,.17,z);plant.add(stem);const top=new THREE.Mesh(new THREE.OctahedronGeometry(.115),new THREE.MeshBasicMaterial({color:0xd4b76b}));top.position.set(x,.35,z);plant.add(top);}root.add(plant);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false,transparent:true}));label.position.set(0,.75,0);label.scale.set(2.5,.55,1);root.add(label);row={root,soil,plant,label,canvas,texture,key:''};this.rows.set(f.id,row);this.group.add(root);}
   row.root.position.copy(world(f.pos,.065));row.root.visible=positionVisible(s,f.pos);row.plant.visible=f.state==='planted'||f.state==='mature';row.plant.scale.y=f.state==='mature'?1:.45;
   const hit=farmAt(s,hover)?.id===f.id,b=s.world?.backpack,slot=b?.selectedSlot,itemId=slot==null?null:b?.hotbar[slot];const check=slot==null||!itemId?{ok:false,reason:'数字栏选择农具/种子'}:queryFarmAction(s,{worldId:s.world!.id,visit:s.world!.visit.generation,plotId:f.id,expectedRevision:f.revision,actorId:s.controlledBodyId!,slot,itemId});
   const action=f.state==='raw'?'农具 · 开垦':f.state==='tilled'?'种子 · 播种':f.state==='mature'?'农具 · 收获':`还需 ${Math.ceil(f.remaining)} 模拟秒`;
   const text=`${f.id} · ${action}`,note=hit&&!check.ok?check.reason!:'SAMPLE · 靠近后左键';const key=text+'|'+note+'|'+hit+'|'+check.ok;
   (row.soil.material as THREE.MeshBasicMaterial).color.setHex(hit?(check.ok?0x6d7850:0x715047):f.state==='raw'?0x493d2c:0x675137);
   if(row.key!==key){row.key=key;const c=row.canvas.getContext('2d')!;c.clearRect(0,0,512,112);c.fillStyle='rgba(8,13,16,.9)';c.fillRect(0,0,512,112);c.strokeStyle=hit?(check.ok?'#93c39d':'#c58e80'):'#a18b61';c.strokeRect(2,2,508,108);c.textAlign='center';c.fillStyle='#ecdfb8';c.font='26px sans-serif';c.fillText(text,256,38);c.fillStyle='#b4c2ba';c.font='20px sans-serif';c.fillText(note,256,78,488);row.texture.needsUpdate=true;}
  }
 }
 dispose(){for(const row of this.rows.values()){row.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}if(o instanceof THREE.Sprite)o.material.dispose();});row.texture.dispose();}this.rows.clear();this.group.clear();}
}
