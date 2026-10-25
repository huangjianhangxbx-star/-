import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAsset} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';

test('a covered generated layer replacement remains an author transaction even when the visible composite is unchanged',()=>{
 const asset=createAsset('covered-edge');asset.cells=[{x:0,y:0,z:0,color:0}];
 const session=new CanvasSession(asset);session.setEditObject(session.model.objects![0].objectId);
 const generated={id:'edge',name:'结构描边',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#123456'}}};
 const handpaint={id:'handpaint',name:'手绘',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#abcdef'}}};
 session.paint(composeLayers([generated,handpaint]),true);
 const revision=session.model.revision,history=session.past.length,before=structuredClone(session.active.paintSource);
 session.paint(composeLayers([{...generated,faces:{'0,0,0,4':{'0':'#654321'}}},handpaint]),true);
 assert.equal(session.model.revision,revision+1);assert.equal(session.past.length,history+1);
 assert.equal(session.active.paintSource!.layers![0].faces['0,0,0,4']['0'],'#654321');
 assert.deepEqual(session.active.paintSource!.faces,before!.faces);
 session.undo();assert.deepEqual(session.active.paintSource,before);
});
