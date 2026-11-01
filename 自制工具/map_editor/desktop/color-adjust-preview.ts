import {CanvasSession} from '../core/workshop-canvases.ts';
import type {EditingMap} from '../core/workshop-adapter.ts';
/** Reuse normal canvas ownership/palette conversion on a detached session. */
export function colorAdjustmentPreview(session:CanvasSession,document:EditingMap){
 const draft=new CanvasSession(session.model);
 draft.activeId=session.activeId;draft.editObjectId=session.editObjectId;
 draft.editor.restore(document);
 return draft.sync();
}
