import type {SceneLayout,SceneProp,ActivityAnchor} from './scene-layout';
// Positions are image foot anchors. Bases extend north from that ground baseline.
const prop=(id:string,asset:string,x:number,y:number,w:number,h:number,tall=false,solid=true,scale=1,ground=false):SceneProp=>({id,asset,pos:{x,y},scale,ground,base:{x:-w/2,y:-h,width:w,height:h},blocksLight:tall,blocksMovement:solid,blocksSight:tall,blocksProjectile:tall});
const anchor=(id:string,ownerObject:string,x:number,y:number,tags:string[],facing:ActivityAnchor['facing']='north'):ActivityAnchor=>({id,ownerObject,tags,approach:{x,y},facing,capacity:1,mode:'anchor-only'});
export const HOME_LAYOUT:SceneLayout={revision:'home02-1',chest:{x:13.2,y:7.4},merchant:{x:13.2,y:9},props:[
 prop('kitchen-stove','stove',3,3.2,.9,.65,true),
 prop('kitchen-prep','prep-counter',5.3,3.2,1.8,.55),
 prop('kitchen-sink','sink',7.3,3.2,1,.65),
 prop('reading-shelf','bookshelf',12.6,3.2,1.5,.7,true),
 prop('dining-table','dining-table',7.5,8.1,2,.65),
 prop('dining-north-chair','chair-front',7.5,6.9,.55,.45,false,true,.75),
 prop('dining-south-chair','chair-back',7.5,9.3,.55,.45,false,true,.75),
 prop('living-seat','living-seat',11,9.4,2,.65),
 prop('living-table','small-table',11,8,.85,.5),
 prop('storage-cabinet','low-cabinet',4.7,9.4,1.8,.55),
 prop('vegetables','vegetable-basket',3,4.5,.3,.3,false,false,.8),
 prop('garden-a','garden-bed',2,5.6,2,.7,false,false,1,true),
 prop('garden-b','garden-bed',2,7.8,2,.7,false,false,1,true),
 prop('cabbage-a','crop-cabbage',1.5,5.3,.2,.2,false,false,.65),
 prop('cabbage-b','crop-cabbage',2.4,5.3,.2,.2,false,false,.65),
 prop('carrot-a','crop-carrot',1.5,7.5,.2,.2,false,false,.65),
 prop('carrot-b','crop-carrot',2.4,7.5,.2,.2,false,false,.65)
],activities:[
 anchor('cook','kitchen-stove',3,3.6,['cook']),
 anchor('prepare','kitchen-prep',5.3,3.6,['prepare']),
 anchor('wash','kitchen-sink',7.3,3.6,['wash']),
 anchor('read','reading-shelf',12.6,3.65,['read']),
 anchor('dine','dining-table',6.1,8,['dine'],'east'),
 anchor('rest','living-seat',9.6,9,['rest'],'east'),
 anchor('store','storage-cabinet',3.5,9,['store'],'east'),
 anchor('garden','garden-a',3.4,5.3,['garden'],'west')
]};
