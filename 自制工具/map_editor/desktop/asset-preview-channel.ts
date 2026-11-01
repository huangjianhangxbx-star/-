import type {AssetDocument} from '../core/workshop-documents.ts';
type Listener=(assetId:string,document:AssetDocument|null)=>void;
type Active={source:string;assetId:string;document:AssetDocument};
/** One display-only override. Sources should include a session/gesture nonce.
 * Published documents are detached snapshots owned by the caller; listeners
 * treat them as read-only. The channel never alters documents or revisions.
 */
export class AssetPreviewChannel {
 private active:Active|null=null;
 private listeners=new Set<Listener>();
 subscribe(listener:Listener){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 publish(source:string,assetId:string,document:AssetDocument|null){
  if(document===null){if(this.active?.source!==source||this.active.assetId!==assetId)return false;this.clear();return true;}
  if(document.assetId!==assetId)throw Error('预览资产身份不匹配');
  if(this.active?.source===source&&this.active.assetId===assetId&&this.active.document===document)return false;
  if(this.active&&this.active.assetId!==assetId)this.clear();
  this.active={source,assetId,document};this.emit(assetId,document);return true;
 }
 clear(){const previous=this.active;if(!previous)return;this.active=null;this.emit(previous.assetId,null);}
 private emit(assetId:string,document:AssetDocument|null){for(const listener of [...this.listeners])listener(assetId,document);}
}
