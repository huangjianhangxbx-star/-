import { StructureEdgeDomain } from '../core/structure-edge-domain.ts';
import { generateEdgeBands, type EdgeBandOptions } from '../core/edge-band-plan.ts';
let domain:StructureEdgeDomain|null=null,source:any;
const port=self as any;
port.onmessage=(event:MessageEvent)=>{
 const {id,kind,model,objectId,geometry,options}=event.data;
 try{
  const started=performance.now();
  if(kind==='init'){
   domain=new StructureEdgeDomain(model,objectId,geometry);source=model.canvases.find((c:any)=>c.canvasId===domain!.canvasId)?.paintSource;
   port.postMessage({id,value:{fingerprint:domain.fingerprint,edges:domain.edges,diagnostics:domain.diagnostics},elapsed:performance.now()-started});
  }else{
   if(!domain)throw Error('结构分析尚未就绪');
   port.postMessage({id,value:generateEdgeBands(domain,options,source),elapsed:performance.now()-started});
  }
 }catch(e){port.postMessage({id,error:(e as Error).message});}
};
