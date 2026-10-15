import {solveInventoryPack,type PackInput} from './core/inventory-pack';
self.onmessage=(e:MessageEvent<{id:number;input:PackInput}>)=>{self.postMessage({id:e.data.id,result:solveInventoryPack(e.data.input)});};
